-- Comprobación previa, SOLO LECTURA. Correr antes de aplicar la migración de fidelidad.
--
-- Contesta las preguntas que la migración da por ciertas. Si alguna fila sale en rojo
-- ("REVISAR"), parar: la migración aborta sola, pero es mejor saberlo antes.

select 'checks de payments' as que,
       conname as nombre,
       pg_get_constraintdef(oid) as definicion,
       case
         when pg_get_constraintdef(oid) ~ '\yamount\y' then 'lo reemplaza la migración'
         when pg_get_constraintdef(oid) ~ '\ypayment_method\y' then 'lo reemplaza la migración'
         else 'se queda como está'
       end as que_pasa
from pg_constraint
where conrelid = 'public.payments'::regclass and contype = 'c'

union all

select 'firma de complete_appointment',
       p.proname,
       pg_get_function_identity_arguments(p.oid),
       case when pg_get_function_identity_arguments(p.oid)
                 = 'p_appointment_id uuid, p_payment_method text, p_amount numeric'
            then 'OK · la migración no la toca'
            else 'REVISAR · no es la firma esperada' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'complete_appointment'

union all

select 'nombres que la migración va a crear',
       nombre, '',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = nombre
       ) then 'REVISAR · ya existe una función con ese nombre'
         else 'OK · libre' end
from (values ('loyalty_progress'), ('public_loyalty_progress'),
             ('staff_client_loyalty'), ('complete_appointment_reward')) t(nombre)

union all

select 'columnas que la migración va a crear',
       tabla || '.' || columna, '',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = tabla and column_name = columna
       ) then 'REVISAR · ya existe' else 'OK · libre' end
from (values ('businesses', 'loyalty_enabled'), ('businesses', 'loyalty_cycle'),
             ('appointments', 'is_reward')) t(tabla, columna)

union all

select 'helpers que la migración necesita',
       nombre, '',
       case when exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = nombre
       ) then 'OK · existe' else 'REVISAR · falta' end
from (values ('current_barber_business_id'), ('is_admin')) t(nombre);
