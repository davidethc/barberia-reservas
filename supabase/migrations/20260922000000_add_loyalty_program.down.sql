-- Vuelta atrás de 20260922000000_add_loyalty_program.sql.
--
-- ORDEN: primero se revierte el código desplegado (que llama a estas funciones y lee
-- estas columnas) y recién después se corre esto.
--
-- Se niega a correr si ya hay premios canjeados: revertir con premios entregados es
-- decidir qué pasa con esos pagos de $0 (y sus comisiones), y eso no lo decide un script.

do $$
declare
  v_rewards integer;
begin
  select count(*) into v_rewards from public.payments where payment_method = 'reward';
  if v_rewards > 0 then
    raise exception
      'FIDELIDAD_DOWN: hay % premio(s) canjeado(s). Decidir qué hacer con esos pagos antes de revertir.',
      v_rewards;
  end if;
end $$;

drop trigger if exists appointments_guard_staff_write on public.appointments;
drop function if exists public.guard_appointment_staff_write();

drop function if exists public.complete_appointment_reward(uuid);
drop function if exists public.staff_client_loyalty(uuid[]);
drop function if exists public.public_loyalty_progress(uuid, text);
drop function if exists public.loyalty_progress(uuid);

-- Los checks vuelven exactamente a como estaban antes de la migración.
alter table public.payments drop constraint if exists payments_amount_check;
alter table public.payments drop constraint if exists payments_payment_method_check;
alter table public.payments
  add constraint payments_amount_check check (amount > 0);
alter table public.payments
  add constraint payments_payment_method_check
  check (payment_method = any (array['cash'::text, 'transfer'::text]));

drop index if exists public.appointments_client_completed_idx;
alter table public.appointments drop column if exists is_reward;

-- Borrar la columna también borra su grant a anon.
alter table public.businesses drop constraint if exists businesses_loyalty_cycle_check;
alter table public.businesses drop column if exists loyalty_cycle;
alter table public.businesses drop column if exists loyalty_enabled;
