-- Programa de fidelidad: el corte número `loyalty_cycle` va por la casa.
--
-- El progreso no se guarda en un contador: se deriva de las citas, igual que ya hace
-- `clients.visit_count` con el trigger appointments_sync_client_visit_stats. Se marca el
-- turno canjeado y el resto es aritmética, así que un cancelled, un no_show o un borrado
-- bajan el progreso solos, sin compensaciones ni jobs.
--
--   pagadas   P = citas completed con is_reward = false
--   canjeadas R = citas completed con is_reward = true
--   progreso    = max(P - R * (ciclo - 1), 0)
--   elegible    = progreso >= ciclo - 1
--
-- TRES REGLAS QUE ESTA MIGRACIÓN SE IMPONE
--
--   1. `complete_appointment` NO SE TOCA. Es por donde entra todo el dinero del negocio
--      y hoy funciona. El canje vive en una función hermana,
--      `complete_appointment_reward`, así que el camino de cobro que ya existe no se
--      borra, no se reemplaza y no cambia de firma: si lo nuevo falla, se sigue
--      cobrando igual que ayer.
--   2. Ningún nombre de constraint se da por supuesto. Se descubren desde
--      `pg_constraint` y, si no aparecen, la migración ABORTA en vez de seguir de largo.
--   3. El check de `amount` no se relaja: se vuelve MÁS estricto. Hoy dice
--      `amount > 0`; pasa a exigir que un pago 'reward' valga exactamente 0 y que
--      cualquier otro siga siendo > 0. Un cobro normal en $0 era imposible antes y
--      sigue siéndolo.
--
-- Todo el archivo es idempotente: volver a aplicarlo no rompe nada.

-- ---------------------------------------------------------------------------
-- 1. Configuración por negocio. Nace apagada: hasta que el dueño la encienda, nada
--    cambia en ninguna pantalla.
-- ---------------------------------------------------------------------------

alter table public.businesses
  add column if not exists loyalty_enabled boolean not null default false;

alter table public.businesses
  add column if not exists loyalty_cycle integer not null default 6;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.businesses'::regclass
      and conname = 'businesses_loyalty_cycle_check'
  ) then
    alter table public.businesses
      add constraint businesses_loyalty_cycle_check
      check (loyalty_cycle between 2 and 20);
  end if;
end $$;

-- `anon` tiene SELECT sobre businesses columna por columna (ver la migración
-- restrict_column_and_table_privileges_for_anon), así que las nuevas no se leen sin esto.
grant select (loyalty_enabled, loyalty_cycle) on public.businesses to anon;

-- ---------------------------------------------------------------------------
-- 2. La marca del turno canjeado: única fuente de verdad del canje.
-- ---------------------------------------------------------------------------

alter table public.appointments
  add column if not exists is_reward boolean not null default false;

create index if not exists appointments_client_completed_idx
  on public.appointments (client_id) where status = 'completed';

-- ---------------------------------------------------------------------------
-- 3. Los checks de `payments`, descubiertos y no adivinados.
--
--    El orden importa: primero se permite el método 'reward', y solo después se exige
--    que un pago 'reward' valga 0. Al revés, la segunda constraint sería imposible de
--    satisfacer mientras la primera siga prohibiendo el método.
--
--    `\y` es un borde de palabra: hace que el patrón case con `amount` pero NO con
--    `commission_amount`, que también tiene su propio check en esta tabla.
-- ---------------------------------------------------------------------------

do $$
declare
  v_found integer := 0;
  v_conname text;
begin
  for v_conname in
    select conname from pg_constraint
    where conrelid = 'public.payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\ypayment_method\y'
  loop
    execute format('alter table public.payments drop constraint %I', v_conname);
    v_found := v_found + 1;
  end loop;

  if v_found = 0 then
    raise exception
      'FIDELIDAD: no se encontró ningún CHECK sobre payments.payment_method. '
      'La tabla no es la que esta migración espera: revisar a mano antes de seguir.';
  end if;
end $$;

alter table public.payments
  add constraint payments_payment_method_check
  check (payment_method in ('cash', 'transfer', 'reward'));

do $$
declare
  v_found integer := 0;
  v_conname text;
begin
  for v_conname in
    select conname from pg_constraint
    where conrelid = 'public.payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ '\yamount\y'
  loop
    execute format('alter table public.payments drop constraint %I', v_conname);
    v_found := v_found + 1;
  end loop;

  if v_found = 0 then
    raise exception
      'FIDELIDAD: no se encontró ningún CHECK sobre payments.amount. '
      'La tabla no es la que esta migración espera: revisar a mano antes de seguir.';
  end if;
end $$;

-- Más estricto que el `amount > 0` de antes, no más laxo: el $0 queda reservado al
-- premio, y un premio no puede colarse con otro importe.
alter table public.payments
  add constraint payments_amount_check
  check (
    (payment_method = 'reward' and amount = 0)
    or (payment_method <> 'reward' and amount > 0)
  );

-- Aserción de cierre: si quedara vivo cualquier otro check que prohíba el 0, el canje
-- reventaría recién en producción al insertar el pago. Que falle aquí, dentro de la
-- transacción de la migración, y no allá.
do $$
declare
  v_def text;
begin
  for v_def in
    select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.payments'::regclass
      and contype = 'c'
      and conname <> 'payments_amount_check'
      and pg_get_constraintdef(oid) ~ '\yamount\y'
  loop
    raise exception
      'FIDELIDAD: sigue habiendo otro CHECK sobre amount que puede prohibir el 0: %', v_def;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Helper interno. Sin grants: solo lo llaman las funciones de abajo.
-- ---------------------------------------------------------------------------

create or replace function public.loyalty_progress(p_client_id uuid)
returns table (cycle integer, progress integer, eligible boolean)
language sql
security definer
set search_path = ''
as $$
  select
    b.loyalty_cycle,
    case when b.loyalty_enabled then prog.progress else 0 end,
    b.loyalty_enabled and prog.progress >= b.loyalty_cycle - 1
  from public.clients c
  join public.businesses b on b.id = c.business_id
  cross join lateral (
    select greatest(
      count(*) filter (where a.status = 'completed' and not a.is_reward)
        - count(*) filter (where a.status = 'completed' and a.is_reward) * (b.loyalty_cycle - 1),
      0)::integer as progress
    from public.appointments a
    where a.client_id = c.id
  ) prog
  where c.id = p_client_id;
$$;

revoke all on function public.loyalty_progress(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Lectura pública, por teléfono.
--
--    Devuelve solo números. Un teléfono desconocido responde lo mismo que un cliente
--    nuevo, así que la función no confirma si un número es cliente ni revela nombres,
--    y nunca devuelve el client_id.
-- ---------------------------------------------------------------------------

create or replace function public.public_loyalty_progress(p_business_id uuid, p_phone text)
returns table (cycle integer, progress integer, eligible boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle integer;
  v_enabled boolean;
  v_client_id uuid;
begin
  select b.loyalty_cycle, b.loyalty_enabled
    into v_cycle, v_enabled
  from public.businesses b
  where b.id = p_business_id;

  if v_cycle is null then
    raise exception 'LOYALTY_BUSINESS_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not v_enabled then
    return query select v_cycle, 0, false;
    return;
  end if;

  select c.id into v_client_id
  from public.clients c
  where c.business_id = p_business_id
    and c.phone = p_phone;

  if v_client_id is null then
    return query select v_cycle, 0, false;
    return;
  end if;

  return query
    select lp.cycle, lp.progress, lp.eligible
    from public.loyalty_progress(v_client_id) lp;
end;
$$;

revoke all on function public.public_loyalty_progress(uuid, text) from public;
grant execute on function public.public_loyalty_progress(uuid, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Lectura del staff, por lote de clientes.
--
--    Tiene que ser definer: un barbero solo ve sus propias citas por RLS
--    (appointments_staff_select) y el progreso debe contar las visitas del cliente con
--    TODOS los barberos. Una vista con security_invoker daría números mal.
-- ---------------------------------------------------------------------------

create or replace function public.staff_client_loyalty(p_client_ids uuid[])
returns table (client_id uuid, cycle integer, progress integer, eligible boolean)
language sql
security definer
set search_path = ''
as $$
  select c.id, lp.cycle, lp.progress, lp.eligible
  from public.clients c
  cross join lateral public.loyalty_progress(c.id) lp
  where c.id = any(p_client_ids)
    and c.business_id = public.current_barber_business_id();
$$;

revoke all on function public.staff_client_loyalty(uuid[]) from public, anon;
grant execute on function public.staff_client_loyalty(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. El canje, en su propia función.
--
--    Hermana de complete_appointment, NO un reemplazo: aquella queda intacta, con su
--    firma de tres argumentos, y sigue cobrando como hoy. Repite a propósito los mismos
--    guards, en el mismo orden y con los mismos tokens de error, para que el barbero
--    reciba el mismo mensaje se canjee o se cobre. Si un día cambian las reglas de
--    cierre de un turno, hay que tocar las dos (lo cubre una prueba que compara ambas).
-- ---------------------------------------------------------------------------

create or replace function public.complete_appointment_reward(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barber_id uuid;
  v_commission_pct numeric;
  v_status text;
  v_service_price numeric;
  v_client_id uuid;
  v_eligible boolean;
  v_payment_id uuid;
  v_payment_method text;
begin
  select b.id, b.commission_pct
    into v_barber_id, v_commission_pct
  from public.barbers b
  where b.user_id = (select auth.uid())
  limit 1;

  if v_barber_id is null then
    raise exception 'COMPLETE_NOT_STAFF' using errcode = '42501';
  end if;

  -- Scoped to the caller's own barber row: another barber's turn reads as not found.
  select a.status, s.price, a.client_id
    into v_status, v_service_price, v_client_id
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.id = p_appointment_id
    and a.barber_id = v_barber_id
  for update of a;

  if not found then
    raise exception 'COMPLETE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select p.id, p.payment_method
    into v_payment_id, v_payment_method
  from public.payments p
  where p.appointment_id = p_appointment_id;

  if v_payment_id is not null then
    -- Doble clic sobre el mismo canje: se devuelve el pago que ya existe en vez de
    -- intentar un segundo, igual que hace complete_appointment.
    if v_payment_method = 'reward' then
      if v_status <> 'completed' then
        update public.appointments
           set status = 'completed', is_reward = true
         where id = p_appointment_id;
      end if;
      return v_payment_id;
    end if;

    -- Ya se cobró dinero por este turno: no se regala encima de un cobro.
    raise exception 'COMPLETE_NOT_PENDING' using errcode = '22023';
  end if;

  if v_status <> 'pending' then
    raise exception 'COMPLETE_NOT_PENDING' using errcode = '22023';
  end if;

  select lp.eligible into v_eligible
  from public.loyalty_progress(v_client_id) lp;

  if not coalesce(v_eligible, false) then
    raise exception 'COMPLETE_REWARD_NOT_ELIGIBLE' using errcode = '22023';
  end if;

  update public.appointments
     set status = 'completed', is_reward = true
   where id = p_appointment_id;

  -- El local absorbe el premio: la comisión se calcula sobre el precio del servicio, no
  -- sobre lo cobrado, para que el barbero no pague parte del regalo.
  insert into public.payments (
    appointment_id, barber_id, amount, payment_method, commission_amount
  )
  values (
    p_appointment_id, v_barber_id, 0, 'reward',
    round(v_service_price * v_commission_pct / 100, 2)
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.complete_appointment_reward(uuid) from public, anon;
grant execute on function public.complete_appointment_reward(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Aserción final: complete_appointment tiene que haber quedado exactamente como
--    estaba, con su firma de tres argumentos y su grant. Si algo la tocó, abortar.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_appointment'
      and pg_get_function_identity_arguments(p.oid)
          = 'p_appointment_id uuid, p_payment_method text, p_amount numeric'
  ) then
    raise exception
      'FIDELIDAD: complete_appointment ya no tiene su firma de tres argumentos. '
      'El camino de cobro que existe no debe cambiar en esta migración.';
  end if;

  if not has_function_privilege('authenticated', 'public.complete_appointment(uuid, text, numeric)', 'EXECUTE') then
    raise exception 'FIDELIDAD: authenticated perdió el EXECUTE sobre complete_appointment.';
  end if;
end $$;
