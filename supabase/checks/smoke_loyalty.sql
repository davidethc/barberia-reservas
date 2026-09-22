-- Ensayo completo del canje, de punta a punta, dentro de una transacción que se deshace.
--
-- Está pensado para correrse en una rama de Supabase (donde puede quedarse aplicado) o
-- contra producción tal cual está: termina en ROLLBACK, así que no deja ni un turno, ni un
-- cliente, ni un pago. Si algo no cuadra, levanta excepción con el número que falló.
--
-- Correr DESPUÉS de aplicar la migración.

begin;

do $$
declare
  v_business uuid;
  v_barber uuid;
  v_barber_user uuid;
  v_pct numeric;
  v_service uuid;
  v_price numeric;
  v_client uuid;
  v_appt uuid;
  v_appt2 uuid;
  v_payment uuid;
  v_cycle integer;
  v_progress integer;
  v_eligible boolean;
  v_amount numeric;
  v_method text;
  v_commission numeric;
  v_is_reward boolean;
  v_phone constant text := '0999000001';   -- teléfono que no existe en la base real
begin
  -- ---------- semilla ----------
  select b.id, b.user_id, b.commission_pct, b.business_id
    into v_barber, v_barber_user, v_pct, v_business
  from public.barbers b
  where b.is_active and b.user_id is not null
  limit 1;

  if v_barber is null then
    raise exception 'SMOKE: no hay ningún barbero activo con cuenta; no se puede ensayar';
  end if;

  select id, price into v_service, v_price
  from public.services where business_id = v_business and is_active
  order by price desc limit 1;

  update public.businesses
     set loyalty_enabled = true, loyalty_cycle = 6
   where id = v_business;

  insert into public.clients (business_id, name, phone)
  values (v_business, 'Cliente de ensayo', v_phone)
  returning id into v_client;

  -- Cinco cortes pagados y completados, en días pasados.
  for i in 1..5 loop
    insert into public.appointments
      (business_id, barber_id, service_id, client_id, date, start_time, end_time, status)
    values
      (v_business, v_barber, v_service, v_client,
       current_date - i, '10:00', '10:45', 'completed');
  end loop;

  -- ---------- 1. el progreso se ve desde el lado público ----------
  select cycle, progress, eligible into v_cycle, v_progress, v_eligible
  from public.public_loyalty_progress(v_business, v_phone);

  if v_cycle <> 6 or v_progress <> 5 or not v_eligible then
    raise exception 'SMOKE 1: esperaba ciclo 6, progreso 5, elegible; obtuve %, %, %',
      v_cycle, v_progress, v_eligible;
  end if;
  raise notice 'SMOKE 1 OK · progreso 5 de 6, elegible';

  -- ---------- 2. un teléfono desconocido no revela nada ----------
  select progress, eligible into v_progress, v_eligible
  from public.public_loyalty_progress(v_business, '0999999999');

  if v_progress <> 0 or v_eligible then
    raise exception 'SMOKE 2: un teléfono desconocido devolvió progreso % / elegible %',
      v_progress, v_eligible;
  end if;
  raise notice 'SMOKE 2 OK · teléfono desconocido responde como cliente nuevo';

  -- ---------- 3. el canje ----------
  insert into public.appointments
    (business_id, barber_id, service_id, client_id, date, start_time, end_time, status)
  values
    (v_business, v_barber, v_service, v_client, current_date, '11:00', '11:45', 'pending')
  returning id into v_appt;

  -- Hacer que auth.uid() resuelva al barbero, como en una sesión real del staff.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_barber_user, 'role', 'authenticated')::text,
                     true);

  v_payment := public.complete_appointment_reward(v_appt);

  select p.amount, p.payment_method, p.commission_amount
    into v_amount, v_method, v_commission
  from public.payments p where p.id = v_payment;

  select a.is_reward into v_is_reward from public.appointments a where a.id = v_appt;

  if v_amount <> 0 or v_method <> 'reward' then
    raise exception 'SMOKE 3: el pago del premio quedó en % / %', v_amount, v_method;
  end if;

  if v_commission <> round(v_price * v_pct / 100, 2) then
    raise exception 'SMOKE 3: la comisión del premio es % y esperaba % (precio % × %%)',
      v_commission, round(v_price * v_pct / 100, 2), v_price, v_pct;
  end if;

  if not v_is_reward then
    raise exception 'SMOKE 3: la cita no quedó marcada como is_reward';
  end if;
  raise notice 'SMOKE 3 OK · pago $0, método reward, comisión % sobre precio %',
    v_commission, v_price;

  -- ---------- 4. doble clic: no hay segundo premio ----------
  if public.complete_appointment_reward(v_appt) <> v_payment then
    raise exception 'SMOKE 4: un segundo canje sobre el mismo turno creó otro pago';
  end if;
  raise notice 'SMOKE 4 OK · el doble clic devuelve el mismo pago';

  -- ---------- 5. la tarjeta vuelve a cero ----------
  select progress, eligible into v_progress, v_eligible
  from public.public_loyalty_progress(v_business, v_phone);

  if v_progress <> 0 or v_eligible then
    raise exception 'SMOKE 5: tras canjear, progreso % / elegible %', v_progress, v_eligible;
  end if;
  raise notice 'SMOKE 5 OK · la tarjeta se reinició';

  -- ---------- 6. sin sellos no hay premio ----------
  insert into public.appointments
    (business_id, barber_id, service_id, client_id, date, start_time, end_time, status)
  values
    (v_business, v_barber, v_service, v_client, current_date, '12:00', '12:45', 'pending')
  returning id into v_appt2;

  begin
    perform public.complete_appointment_reward(v_appt2);
    raise exception 'SMOKE 6: dejó canjear a un cliente sin sellos';
  exception
    when sqlstate '22023' then
      if sqlerrm not like '%COMPLETE_REWARD_NOT_ELIGIBLE%' then
        raise exception 'SMOKE 6: falló con el error equivocado: %', sqlerrm;
      end if;
      raise notice 'SMOKE 6 OK · rechazado con COMPLETE_REWARD_NOT_ELIGIBLE';
  end;

  -- ---------- 7. el cobro normal sigue funcionando igual que ayer ----------
  v_payment := public.complete_appointment(v_appt2, 'cash', v_price);

  select p.amount, p.payment_method into v_amount, v_method
  from public.payments p where p.id = v_payment;

  if v_amount <> v_price or v_method <> 'cash' then
    raise exception 'SMOKE 7: el cobro normal quedó en % / %', v_amount, v_method;
  end if;
  raise notice 'SMOKE 7 OK · complete_appointment cobra como siempre';

  -- ---------- 8. un cobro normal en $0 sigue siendo imposible ----------
  begin
    insert into public.payments (appointment_id, barber_id, amount, payment_method, commission_amount)
    values (v_appt, v_barber, 0, 'cash', 0);
    raise exception 'SMOKE 8: se aceptó un pago cash de $0';
  exception
    when check_violation then
      raise notice 'SMOKE 8 OK · el $0 sigue reservado al premio';
  end;

  raise notice '--- TODO OK: 8 de 8 ---';
end $$;

rollback;
