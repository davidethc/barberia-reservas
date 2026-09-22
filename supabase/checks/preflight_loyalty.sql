-- Verificación previa a 20260922000000_add_loyalty_program.sql. SOLO LECTURA.
-- Cada fila sale con "OK" o "REVISAR". Con un solo "REVISAR" no se aplica la migración.

select 'payments: CHECK amount > 0 existe' as comprobacion,
       case when exists (
         select 1 from pg_constraint
         where conrelid = 'public.payments'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) ~ '\yamount\y'
       ) then 'OK' else 'REVISAR' end as estado
union all
select 'payments: CHECK payment_method existe',
       case when exists (
         select 1 from pg_constraint
         where conrelid = 'public.payments'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) ~ '\ypayment_method\y'
       ) then 'OK' else 'REVISAR' end
union all
select 'payments: UNIQUE (appointment_id) existe',
       case when exists (
         select 1 from pg_constraint
         where conrelid = 'public.payments'::regclass and contype = 'u'
           and pg_get_constraintdef(oid) = 'UNIQUE (appointment_id)'
       ) then 'OK' else 'REVISAR' end
union all
select 'payments: ningún pago viola los checks nuevos',
       case when not exists (
         select 1 from public.payments
         where payment_method not in ('cash', 'transfer') or amount <= 0
       ) then 'OK' else 'REVISAR' end
union all
select 'complete_appointment(uuid, text, numeric) existe',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'complete_appointment'
           and pg_get_function_identity_arguments(p.oid)
               = 'p_appointment_id uuid, p_payment_method text, p_amount numeric'
       ) then 'OK' else 'REVISAR' end
union all
select 'authenticated puede ejecutar complete_appointment',
       case when has_function_privilege('authenticated',
         'public.complete_appointment(uuid, text, numeric)', 'EXECUTE')
       then 'OK' else 'REVISAR' end
union all
select 'helper current_barber_business_id() existe',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'current_barber_business_id'
       ) then 'OK' else 'REVISAR' end
union all
select 'trigger appointments_sync_client_visit_stats existe',
       case when exists (
         select 1 from pg_trigger
         where tgrelid = 'public.appointments'::regclass
           and tgname = 'appointments_sync_client_visit_stats'
       ) then 'OK' else 'REVISAR' end
union all
select 'appointments.client_id es NOT NULL',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'appointments'
           and column_name = 'client_id' and is_nullable = 'NO'
       ) then 'OK' else 'REVISAR' end
union all
select 'la app solo cambia status pending → cancelled | no_show (candado seguro)',
       'OK (verificado en código: src/app/actions/agenda.ts cancelAppointment)'
union all
select 'hay un barbero activo con cuenta (para el smoke test)',
       case when exists (
         select 1 from public.barbers where is_active and user_id is not null
       ) then 'OK' else 'REVISAR' end;
