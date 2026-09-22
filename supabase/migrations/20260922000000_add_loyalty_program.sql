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

-- 1. Configuración por negocio. Nace apagado: hasta que el dueño lo encienda, nada cambia.
alter table public.businesses
  add column if not exists loyalty_enabled boolean not null default false,
  add column if not exists loyalty_cycle   integer not null default 6
    check (loyalty_cycle between 2 and 20);

-- `anon` tiene SELECT sobre businesses columna por columna (ver la migración
-- restrict_column_and_table_privileges_for_anon), así que las nuevas no se leen sin esto.
grant select (loyalty_enabled, loyalty_cycle) on public.businesses to anon;

-- 2. La marca del turno canjeado, única fuente de verdad del canje.
alter table public.appointments
  add column if not exists is_reward boolean not null default false;

create index if not exists appointments_client_completed_idx
  on public.appointments (client_id) where status = 'completed';

-- 3. Dejar entrar el $0. Hoy hay dos topes que lo impiden.
-- OJO: los dos nombres de constraint de abajo son los que Postgres genera por defecto, pero
-- no se pudieron verificar contra la base al escribir esto. Con `drop ... if exists`, un
-- nombre equivocado no falla: deja el check viejo en pie y el canje revienta al insertar el
-- pago de $0. Antes de aplicar, comprobar con:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.payments'::regclass and contype = 'c';
alter table public.payments drop constraint if exists payments_amount_check;
alter table public.payments add  constraint payments_amount_check check (amount >= 0);

-- El método 'reward' lo pone el servidor, nunca el barbero: así `payments` sigue siendo la
-- tabla del dinero y la vista barber_commissions cuadra sola (ingreso_total no sube,
-- comision_total sí, que es lo que se decidió).
alter table public.payments drop constraint if exists payments_payment_method_check;
alter table public.payments add  constraint payments_payment_method_check
  check (payment_method in ('cash', 'transfer', 'reward'));

-- 4. Helper interno. Sin grants: se llama solo desde las funciones de abajo.
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

-- 5. Lectura pública, por teléfono. Devuelve solo números: un teléfono desconocido responde
-- lo mismo que un cliente nuevo, así que no confirma si un número es cliente ni revela
-- nombres, y nunca devuelve el client_id.
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
grant execute on function public.public_loyalty_progress(uuid, text) to anon, authenticated, service_role;

-- 6. Lectura del staff, por lote de clientes. Tiene que ser definer: un barbero solo ve sus
-- propias citas por RLS, y el progreso cuenta las visitas del cliente con todos los barberos.
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

-- 7. El canje, dentro de la misma transacción que ya cierra el turno y cobra.
-- La versión de tres argumentos se borra en vez de dejarla como sobrecarga: dos candidatas
-- con los mismos nombres de parámetro dejan a PostgREST sin saber cuál llamar.
drop function if exists public.complete_appointment(uuid, text, numeric);

create or replace function public.complete_appointment(
  p_appointment_id uuid,
  p_payment_method text,
  p_amount numeric,
  p_redeem_reward boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- A turn is charged at the service price give or take a tip or a discount; anything past
  -- this is a typo or a forged amount, and it would inflate the barber's own commission.
  v_max_amount_factor constant numeric := 10;
  v_redeem boolean := coalesce(p_redeem_reward, false);
  v_barber_id uuid;
  v_commission_pct numeric;
  v_status text;
  v_service_price numeric;
  v_client_id uuid;
  v_eligible boolean;
  v_amount numeric;
  v_method text;
  v_commission numeric;
  v_payment_id uuid;
begin
  select b.id, b.commission_pct
    into v_barber_id, v_commission_pct
  from public.barbers b
  where b.user_id = (select auth.uid())
  limit 1;

  if v_barber_id is null then
    raise exception 'COMPLETE_NOT_STAFF' using errcode = '42501';
  end if;

  -- En un canje el método lo pone el servidor, así que no se exige al llamante.
  if not v_redeem and (p_payment_method is null or p_payment_method not in ('cash', 'transfer')) then
    raise exception 'COMPLETE_INVALID_INPUT' using errcode = '22023';
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

  -- A payment already on record means the money was taken. Finish the turn around it
  -- instead of inserting a second one and tripping the unique constraint.
  select p.id into v_payment_id
  from public.payments p
  where p.appointment_id = p_appointment_id;

  if v_payment_id is not null then
    if v_status not in ('pending', 'completed') then
      raise exception 'COMPLETE_NOT_PENDING' using errcode = '22023';
    end if;

    if v_status <> 'completed' then
      update public.appointments
         set status = 'completed'
       where id = p_appointment_id;
    end if;

    return v_payment_id;
  end if;

  if v_status <> 'pending' then
    raise exception 'COMPLETE_NOT_PENDING' using errcode = '22023';
  end if;

  if v_redeem then
    select lp.eligible into v_eligible
    from public.loyalty_progress(v_client_id) lp;

    if not coalesce(v_eligible, false) then
      raise exception 'COMPLETE_REWARD_NOT_ELIGIBLE' using errcode = '22023';
    end if;

    v_amount := 0;
    v_method := 'reward';
    -- El local absorbe el premio: la comisión se calcula sobre el precio del servicio,
    -- no sobre lo cobrado, para que el barbero no pague parte del regalo.
    v_commission := round(v_service_price * v_commission_pct / 100, 2);

    update public.appointments
       set status = 'completed',
           is_reward = true
     where id = p_appointment_id;
  else
    v_amount := round(coalesce(p_amount, 0), 2);
    if v_amount <= 0 or v_amount > v_service_price * v_max_amount_factor then
      raise exception 'COMPLETE_INVALID_INPUT' using errcode = '22023';
    end if;

    v_method := p_payment_method;
    v_commission := round(v_amount * v_commission_pct / 100, 2);

    update public.appointments
       set status = 'completed'
     where id = p_appointment_id;
  end if;

  insert into public.payments (
    appointment_id, barber_id, amount, payment_method, commission_amount
  )
  values (p_appointment_id, v_barber_id, v_amount, v_method, v_commission)
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.complete_appointment(uuid, text, numeric, boolean) from public, anon;
grant execute on function public.complete_appointment(uuid, text, numeric, boolean) to authenticated, service_role;
