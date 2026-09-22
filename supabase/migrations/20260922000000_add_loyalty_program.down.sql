-- Vuelta atrás del programa de fidelidad.
--
-- Se puede correr entera mientras no haya ningún premio canjeado. Si lo hay, ABORTA y
-- dice cuántos: revertir con premios ya entregados significa decidir qué pasa con ese
-- dinero, y eso no lo decide un script.

do $$
declare
  v_rewards integer;
begin
  select count(*) into v_rewards from public.payments where payment_method = 'reward';

  if v_rewards > 0 then
    raise exception
      'FIDELIDAD (rollback): hay % pago(s) de premio registrados. Revertir dejaría el '
      'check de amount imposible de cumplir para esas filas. Decidir primero qué se hace '
      'con ellos (anularlos o recobrarlos) y volver a correr esto.', v_rewards;
  end if;
end $$;

-- complete_appointment nunca se tocó, así que no hay nada que restaurar de ella.
drop function if exists public.complete_appointment_reward(uuid);
drop function if exists public.staff_client_loyalty(uuid[]);
drop function if exists public.public_loyalty_progress(uuid, text);
drop function if exists public.loyalty_progress(uuid);

alter table public.payments drop constraint if exists payments_amount_check;
alter table public.payments
  add constraint payments_amount_check check (amount > 0);

alter table public.payments drop constraint if exists payments_payment_method_check;
alter table public.payments
  add constraint payments_payment_method_check
  check (payment_method in ('cash', 'transfer'));

drop index if exists public.appointments_client_completed_idx;
alter table public.appointments drop column if exists is_reward;

alter table public.businesses drop constraint if exists businesses_loyalty_cycle_check;
alter table public.businesses drop column if exists loyalty_cycle;
alter table public.businesses drop column if exists loyalty_enabled;
