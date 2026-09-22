-- El candado del staff también cubre a quién y qué servicio pertenece un turno.
--
-- Con el programa de fidelidad, `client_id` y `service_id` pasaron a mover dinero:
-- los sellos se cuentan por `client_id` y la comisión de un canje se paga sobre el precio
-- de `service_id`. `authenticated` tiene UPDATE sobre toda la tabla, así que por la API un
-- barbero podía pasar turnos completados a la ficha de un amigo (sellos regalados) o subir
-- el servicio antes de canjear (comisión inflada sobre un corte gratis).
--
-- La app nunca cambia estas columnas: su única escritura directa es el status en
-- cancelAppointment. Se bloquean para `authenticated` y `anon`; las funciones security
-- definer siguen escribiendo como su dueño.

create or replace function public.guard_appointment_staff_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.is_reward then
      raise exception 'APPOINTMENT_REWARD_LOCKED' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_reward is distinct from old.is_reward then
    raise exception 'APPOINTMENT_REWARD_LOCKED' using errcode = '42501';
  end if;

  if new.client_id is distinct from old.client_id
     or new.service_id is distinct from old.service_id
     or new.barber_id is distinct from old.barber_id
     or new.business_id is distinct from old.business_id then
    raise exception 'APPOINTMENT_FIELD_LOCKED' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status in ('cancelled', 'no_show')) then
    raise exception 'APPOINTMENT_TRANSITION_LOCKED' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_appointment_staff_write() from public, anon, authenticated;
