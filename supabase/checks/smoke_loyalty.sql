-- Ensayo de punta a punta del programa de fidelidad. Correr DESPUÉS de aplicar la migración
-- (o pegado detrás de ella, en la misma llamada, como ensayo en seco).
--
-- NUNCA deja rastro: todo vive dentro de un único DO que termina SIEMPRE en excepción, así
-- que Postgres deshace cada turno, cliente y pago que creó, sin depender de que quien lo
-- ejecute respete un BEGIN/ROLLBACK.
--
--   Éxito  → ERROR: SMOKE_OK 12/12 (todo se deshizo)
--   Fallo  → ERROR: SMOKE <n>: <qué no cuadró>
--
-- Los turnos de ensayo van en el año 2000 para no chocar con idx_no_double_booking
-- (barber_id, date, start_time) ni con ningún turno real.

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
  v_appt3 uuid;
  v_appt4 uuid;
  v_payment uuid;
  v_cycle integer;
  v_progress integer;
  v_eligible boolean;
  v_amount numeric;
  v_method text;
  v_commission numeric;
  v_is_reward boolean;
  v_status text;
  v_phone constant text := '0000000001';
  v_unknown_phone constant text := '0000000002';
begin
  -- ---------- semilla ----------
  select b.id, b.user_id, b.commission_pct, b.business_id
    into v_barber, v_barber_user, v_pct, v_business
  from public.barbers b
  where b.is_active and b.user_id is not null
  order by b.created_at
  limit 1;

  if v_barber is null then
    raise exception 'SMOKE 0: no hay ningún barbero activo con cuenta';
  end if;

  select id, price into v_service, v_price
  from public.services where business_id = v_business and is_active
  order by price desc limit 1;

  if v_service is null then
    raise exception 'SMOKE 0: el negocio no tiene servicios activos';
  end if;

  if exists (select 1 from public.clients
             where business_id = v_business and phone in (v_phone, v_unknown_phone)) then
    raise exception 'SMOKE 0: los teléfonos de ensayo ya existen; elegir otros';
  end if;

  update public.businesses
     set loyalty_enabled = true, loyalty_cycle = 6
   where id = v_business;

  insert into public.clients (business_id, name, phone)
  values (v_business, 'Cliente de ensayo', v_phone)
  returning id into v_client;

  -- Cinco cortes pagados y completados.
  for i in 1..5 loop
    insert into public.appointments
      (business_id, barber_id, service_id, client_id, date, start_time, end_time, status)
    values
      (v_business, v_barber, v_service, v_client,
       date '2000-01-01' + i, '10:00', '10:45', 'completed');
  end loop;

  -- ---------- 1. el progreso se ve desde el lado público ----------
  select cycle, progress, eligible into v_cycle, v_progress, v_eligible
  from public.public_loyalty_progress(v_business, v_phone);

  if v_cycle <> 6 or v_progress <> 5 or not v_eligible then
    raise exception 'SMOKE 1: esperaba ciclo 6, progreso 5, elegible; obtuve %, %, %',
      v_cycle, v_progress, v_eligible;
  end if;

  -- ---------- 2. un teléfono desconocido no revela nada ----------
  select progress, eligible into v_progress, v_eligible
  from public.public_loyalty_progress(v_business, v_unknown_phone);

  if v_progress <> 0 or v_eligible then
    raise exception 'SMOKE 2: un teléfono desconocido devolvió progreso % / elegible %',
      v_progress, v_eligible;
  end if;

  -- ---------- 3. el canje ----------
  insert into public.appointments
    (business_id, barber_id, service_id, client_id, date, start_time, end_time, status)
  values
    (v_business, v_barber, v_service, v_client, date '2000-02-01', '11:00', '11:45', 'pending')
  returning id into v_appt;

  -- auth.uid() resuelve al barbero, como en una sesión real del staff.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_barber_user, 'role', 'authenticated')::text,
                     true);

  v_payment := public.complete_appointment_reward(v_appt);

  select p.amount, p.payment_method, p.commission_amount
    into v_amount, v_method, v_commission
  from public.payments p where p.id = v_payment;

  select a.is_reward, a.status into v_is_reward, v_status
  from public.appointments a where a.id = v_appt;

  if v_amount <> 0 or v_method <> 'reward' then
    raise exception 'SMOKE 3: el pago del premio quedó en % / %', v_amount, v_method;
  end if;

  if v_commission <> round(v_price * v_pct / 100, 2) then
    raise exception 'SMOKE 3: la comisión del premio es % y esperaba %',
      v_commission, round(v_price * v_pct / 100, 2);
  end if;

  if not v_is_reward or v_status <> 'completed' then
    raise exception 'SMOKE 3: la cita quedó is_reward=% status=%', v_is_reward, v_status;
  end if;

  -- ---------- 4. doble clic: no hay segundo premio ----------
  if public.complete_appointment_reward(v_appt) <> v_payment then
    raise exception 'SMOKE 4: un segundo canje sobre el mismo turno creó otro pago';
  end if;

  -- ---------- 5. la tarjeta vuelve a cero ----------
  select progress, eligible into v_progress, v_eligible
  from public.public_loyalty_progress(v_business, v_phone);

  if v_progress <> 0 or v_eligible then
    raise exception 'SMOKE 5: tras canjear, progreso % / elegible %', v_progress, v_eligible;
  end if;

  -- ---------- 6. sin sellos no hay premio ----------
  insert into public.appointments
    (business_id, barber_id, service_id, client_id, date, start_time, end_time, status)
  values
    (v_business, v_barber, v_service, v_client, date '2000-02-01', '12:00', '12:45', 'pending')
  returning id into v_appt2;

  begin
    perform public.complete_appointment_reward(v_appt2);
    raise exception 'SMOKE 6: dejó canjear a un cliente sin sellos';
  exception
    when sqlstate '22023' then
      if sqlerrm not like '%COMPLETE_REWARD_NOT_ELIGIBLE%' then
        raise exception 'SMOKE 6: falló con el error equivocado: %', sqlerrm;
      end if;
  end;

  -- ---------- 7. el cobro normal sigue funcionando igual que ayer ----------
  v_payment := public.complete_appointment(v_appt2, 'cash', v_price);

  select p.amount, p.payment_method, p.commission_amount
    into v_amount, v_method, v_commission
  from public.payments p where p.id = v_payment;

  if v_amount <> v_price or v_method <> 'cash'
     or v_commission <> round(v_price * v_pct / 100, 2) then
    raise exception 'SMOKE 7: el cobro normal quedó en % / % / comisión %',
      v_amount, v_method, v_commission;
  end if;

  -- ---------- 8. un cobro normal en $0 sigue siendo imposible ----------
  begin
    insert into public.payments (appointment_id, barber_id, amount, payment_method, commission_amount)
    values (v_appt, v_barber, 0, 'cash', 0);
    raise exception 'SMOKE 8: se aceptó un pago cash de $0';
  exception
    when check_violation then null;
  end;

  -- ---------- 12. un turno cancelado con pago de premio no revive ----------
  insert into public.appointments
    (business_id, barber_id, service_id, client_id, date, start_time, end_time, status)
  values
    (v_business, v_barber, v_service, v_client, date '2000-02-01', '13:00', '13:45', 'cancelled')
  returning id into v_appt4;

  insert into public.payments (appointment_id, barber_id, amount, payment_method, commission_amount)
  values (v_appt4, v_barber, 0, 'reward', 0);

  begin
    perform public.complete_appointment_reward(v_appt4);
    raise exception 'SMOKE 12: el canje revivió un turno cancelado';
  exception
    when sqlstate '22023' then
      if sqlerrm not like '%COMPLETE_NOT_PENDING%' then
        raise exception 'SMOKE 12: falló con el error equivocado: %', sqlerrm;
      end if;
  end;

  -- ---------- 9 a 11: el candado, visto como el barbero por la API ----------
  insert into public.appointments
    (business_id, barber_id, service_id, client_id, date, start_time, end_time, status)
  values
    (v_business, v_barber, v_service, v_client, date '2000-02-01', '14:00', '14:45', 'pending')
  returning id into v_appt3;

  execute 'set local role authenticated';

  -- 9. no puede marcarse un canje
  begin
    update public.appointments set is_reward = false where id = v_appt;
    raise exception 'SMOKE 9: authenticated pudo cambiar is_reward';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%APPOINTMENT_REWARD_LOCKED%' then
        raise exception 'SMOKE 9: falló con el error equivocado: %', sqlerrm;
      end if;
  end;

  -- 10. no puede completar sin cobrar
  begin
    update public.appointments set status = 'completed' where id = v_appt3;
    raise exception 'SMOKE 10: authenticated pudo completar un turno sin cobrar';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%APPOINTMENT_TRANSITION_LOCKED%' then
        raise exception 'SMOKE 10: falló con el error equivocado: %', sqlerrm;
      end if;
  end;

  -- 11. cancelar sigue funcionando igual que hoy
  update public.appointments set status = 'cancelled' where id = v_appt3;
  if not found then
    raise exception 'SMOKE 11: authenticated no pudo cancelar su propio turno pendiente';
  end if;

  execute 'reset role';

  select status into v_status from public.appointments where id = v_appt3;
  if v_status <> 'cancelled' then
    raise exception 'SMOKE 11: el turno quedó en % en vez de cancelled', v_status;
  end if;

  raise exception 'SMOKE_OK 12/12 (todo se deshizo)';
end $$;
