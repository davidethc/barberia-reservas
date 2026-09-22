# Tarjeta de sellos: el 6to corte va por la casa

> Plan de implementación para MONKY BARBER · programa de fidelidad configurable
> Rama: `claude/peaceful-mccarthy-wr3837`

---

## Respuestas directas a lo que preguntaste

### ¿Es seguro? ¿Rompe algo?

Los tres riesgos que te señalé en la versión anterior **ya no existen**: no se mitigan
con cuidado al aplicar, se eliminaron cambiando el diseño. Uno por uno:

1. **~~Tocar `complete_appointment`~~ → no se toca.**
   La versión anterior borraba la función de tres argumentos y creaba una de cuatro. Eso
   ponía el camino del dinero en juego para conseguir una rama nueva. Ahora el canje vive
   en una **función hermana**, `complete_appointment_reward(p_appointment_id)`, y
   `complete_appointment` queda byte a byte como está: misma firma, mismo grant, mismo
   código. Si lo nuevo falla, **se sigue cobrando exactamente igual que ayer**. Como
   nunca se borra nada, tampoco hay ambigüedad de PostgREST ni ventana de despliegue.
   La migración termina con una aserción que aborta si alguien cambió esa firma.
   El precio: los guards de cierre de turno quedan repetidos en dos funciones. Es a
   propósito y está comentado en ambas; una prueba del paso 8 compara que las dos cierren
   un turno igual, para que no se separen con el tiempo.

2. **~~Nombres de constraint adivinados~~ → se descubren, y si no aparecen aborta.**
   Ya no hay ningún `drop constraint payments_amount_check` escrito a mano. La migración
   busca los checks en `pg_constraint` por su definición (con `\yamount\y`, un borde de
   palabra, para no confundirse con `commission_amount`), los borra por su nombre real y
   **levanta excepción si no encuentra ninguno**. Al final vuelve a mirar: si quedara
   vivo cualquier otro check capaz de prohibir el 0, falla ahí mismo, dentro de la
   transacción. El modo de fallo silencioso desapareció.

3. **~~Relajar `amount > 0`~~ → el check queda más estricto, no más laxo.**
   En vez de bajarlo a `amount >= 0` para todos, ahora es condicional:
   ```sql
   check ( (payment_method =  'reward' and amount =  0)
        or (payment_method <> 'reward' and amount >  0) )
   ```
   Un cobro normal en $0 era imposible antes y **sigue siéndolo**. Y encima se gana una
   garantía que antes no había: un pago marcado como premio no puede colarse con otro
   importe. La barrera no se baja; se sube.

Y para que no dependa de que yo tenga razón, el paso 1 se aplica con red:

- **`supabase/checks/preflight_loyalty.sql`** — solo lectura. Contesta antes de tocar
  nada si los nombres, las firmas y los helpers son los que la migración espera. Cada
  fila sale con "OK" o "REVISAR".
- **Rama de Supabase primero.** La migración se aplica en una rama descartable
  (`mcp__Supabase__create_branch`), se ensaya ahí y recién después va a producción.
- **`supabase/checks/smoke_loyalty.sql`** — 8 comprobaciones de punta a punta
  (progreso, privacidad del teléfono, canje, doble clic, reinicio de la tarjeta, rechazo
  sin sellos, **que el cobro normal siga cobrando**, y que el $0 siga prohibido fuera del
  premio). Termina en `rollback`: no deja ni un turno, ni un cliente, ni un pago.
- **`...add_loyalty_program.down.sql`** — la vuelta atrás, escrita antes de necesitarla.
  Si hay premios ya canjeados, se niega a correr y dice cuántos: revertir con premios
  entregados es decidir qué pasa con ese dinero, y eso no lo decide un script.

Fuera de eso, el diseño está hecho para no romper nada:

- **Nace apagado.** `loyalty_enabled` por defecto es `false`. Con el programa apagado,
  todo el código nuevo queda inerte y la app se comporta exactamente como hoy: ni una
  pantalla cambia. Eso además es lo que hace posible desplegar sin ventana de riesgo.
- **No se añade ningún paso al wizard.** Los cinco pasos siguen siendo cinco.
- **No se toca `ConfirmedBooking`.** Añadir un campo validado en `isConfirmedBooking`
  invalidaría las reservas ya guardadas en los teléfonos de tus clientes. Por eso el
  progreso se vuelve a pedir en la confirmación en vez de guardarse.
- **Si la lectura del progreso falla, no se muestra nada.** Un premio que no se pudo
  leer no puede estorbar una reserva. Mismo criterio que el `catch {}` de localStorage
  y el fail-open de `openDays` que ya tiene el código.
- **El progreso no es un contador que se pueda desincronizar.** Se deriva de las citas,
  así que una cancelación o un borrado lo corrigen solos.

### ¿El cliente sabe y ve la fidelización?

Sí, en tres momentos, sin pantallas nuevas:

| Dónde | Qué ve |
| --- | --- |
| Home (paso 6) | Una píldora *"El 6to corte va por la casa"* — se entera **antes** de reservar |
| Paso de datos del wizard | La tira de sellos en cuanto su celular es válido: *"Vas 4 de 6"*. Y como el teléfono viene precargado de `eb_client_phone`, el que repite la ve sin escribir nada |
| Cita confirmada | La tira otra vez, ya actualizada: *"Tu próximo corte es gratis · recuérdalo al llegar"* |

Lo que **no** ve nunca es un `$0` en el wizard, porque el canje lo aplica el barbero al
cobrar. Decir "gratis" y luego cobrarle sería peor que no decir nada.

### ¿Se va a ver limpio cuando se lo vendas a otros barberos?

Eso no sale solo de escribir el código, así que el plan incorpora dos pasos que antes no
tenía: **Paso 7 (estándar visual)** y **Paso 8 (pruebas con Playwright)**. Hoy el repo
tiene **cero tests** — ni Playwright, ni Vitest, ni Jest, y `package.json` solo trae
`dev/build/start/lint`. Si esto va a ser producto que se demuestra, esa es la deuda que
hay que pagar aquí.

---

## Contexto

Hoy un cliente reserva, va, paga y se olvida. Nada le da una razón para volver *a esta*
barbería y no a la de la esquina, y el local no tiene forma de premiar al que ya vino
cinco veces. La idea es un programa tipo tarjeta de sellos —"corta 5 veces, el 6to es
gratis"— con el umbral configurable desde `/admin`, sin añadir pasos al flujo de reserva
y sin romper el lenguaje visual del tema `monky`.

Lo que hace esto barato es que **media función ya existe**: `clients.visit_count` y
`clients.last_visit` los mantiene Postgres con el trigger
`appointments_sync_client_visit_stats` → `refresh_client_visit_stats()`, recalculando
desde las citas `completed`. La visita se suma al **completar** el turno, no al
reservarlo, que es exactamente donde debe avanzar un sello.

## Cómo funciona, en una frase

El progreso **no se guarda en un contador**: se deriva de las citas, igual que
`visit_count`. Se marca cada turno canjeado (`appointments.is_reward`) y entonces:

```
pagadas   P = citas completed con is_reward = false
canjeadas R = citas completed con is_reward = true
progreso    = max(P - R * (ciclo - 1), 0)      -- ciclo = 6 → 5 pagadas por premio
elegible    = progreso >= ciclo - 1
```

Un `cancelled`, un `no_show` o un turno borrado bajan el progreso solos, sin
compensaciones ni jobs. Si el dueño cambia el ciclo, el progreso se recalcula para todos
(por eso el `max(..., 0)`).

## Decisiones ya tomadas

| Decisión | Elegido |
| --- | --- |
| Quién aplica el corte gratis | El barbero al cobrar, en `/agenda`. El wizard no cobra ni descuenta nada. |
| Qué cuenta como visita | Cualquier servicio completado. |
| Comisión en un corte gratis | Se le paga igual, sobre el precio del servicio: el local absorbe el premio. |
| Dónde lo ve el cliente | Al escribir su celular en el paso de datos y en la cita confirmada. |

---

## Paso 1 — Migración SQL

**Estado: escrita, versionada y con red. Sin aplicar.**

| Archivo | Qué es |
| --- | --- |
| `supabase/migrations/20260922000000_add_loyalty_program.sql` | La migración |
| `supabase/migrations/20260922000000_add_loyalty_program.down.sql` | La vuelta atrás |
| `supabase/checks/preflight_loyalty.sql` | Verificación previa, solo lectura |
| `supabase/checks/smoke_loyalty.sql` | Ensayo de punta a punta, termina en `rollback` |

Contenido de la migración:

1. `businesses` gana `loyalty_enabled boolean not null default false` y
   `loyalty_cycle integer not null default 6 check (between 2 and 20)`.
2. `appointments` gana `is_reward boolean not null default false` + índice parcial
   `appointments_client_completed_idx on (client_id) where status = 'completed'`.
3. `payments`: los dos checks se **descubren** desde `pg_constraint` y se reemplazan por
   `payment_method in ('cash','transfer','reward')` y el check condicional de `amount`
   (premio = exactamente 0, todo lo demás > 0). Si no se encuentran, aborta.
   El método `'reward'` lo pone el servidor, nunca el barbero: así `payments` sigue
   siendo la tabla del dinero y la vista `barber_commissions` cuadra sola
   (`ingreso_total` no sube, `comision_total` sí).
4. `loyalty_progress(p_client_id)` — helper interno, `security definer`,
   `search_path = ''`, **sin grants**: solo lo llaman las funciones de abajo.
5. `public_loyalty_progress(p_business_id, p_phone)` → `anon`. Sigue el patrón de
   nombre y grants de `public_bookable_barbers`.
   **Privacidad:** devuelve solo números; un teléfono desconocido responde igual que un
   cliente nuevo, así que no confirma si un número es cliente ni revela nombres.
6. `staff_client_loyalty(p_client_ids uuid[])` → `authenticated`, filtrando por
   `current_barber_business_id()`. Tiene que ser `definer`: un barbero solo ve sus
   propias citas por RLS y el progreso debe contar las visitas con **todos** los
   barberos.
7. `complete_appointment_reward(p_appointment_id)` → `authenticated`. **Función nueva,
   no un reemplazo**: `complete_appointment` no se toca (ver respuesta 1 arriba).
8. `grant select (loyalty_enabled, loyalty_cycle) on businesses to anon` — obligatorio:
   `anon` tiene SELECT **columna por columna** sobre `businesses`.
9. Aserción final: si `complete_appointment` perdió su firma de tres argumentos o su
   grant, la migración aborta.

### Cómo se aplica (en este orden, sin saltarse ninguno)

```
1. preflight_loyalty.sql contra producción  → todo "OK", ningún "REVISAR"
2. create_branch  → rama descartable de Supabase
3. apply_migration en la rama
4. smoke_loyalty.sql en la rama             → "TODO OK: 8 de 8"
5. delete_branch
6. apply_migration en producción
7. smoke_loyalty.sql en producción          → 8 de 8, y termina en rollback: no deja nada
8. get_advisors (security + performance)    → sin avisos nuevos
9. generate_typescript_types                → sobrescribir src/types/database.ts
```

Si el plan de Supabase no permite ramas, se salta del 1 al 6 y el seguro pasa a ser el
`down.sql` más el smoke test, que ya de por sí no deja rastro.

## Paso 2 — Datos y acciones

- **`src/lib/repositories/business.ts` (nuevo)** — no existe repo de `businesses`.
  `get()` y `updateLoyalty({ enabled, cycle })`, con la forma de `business-hours.ts`.
- **`src/lib/repositories/clients.ts`** — `getLoyaltyForClients(ids)` → RPC
  `staff_client_loyalty`.
- **`src/lib/repositories/appointments.ts`** — `getForAgenda` (L34-44) y `getForRange`
  (L48-60): `clients(name, phone)` → `clients(id, name, phone)`. Hoy el `client_id` no
  llega a la agenda.
- **`src/lib/repositories/payments.ts`** — `completeAppointment` recibe `redeemReward` y
  **elige la función**: con `true` llama a `complete_appointment_reward(p_appointment_id)`;
  con `false` llama a `complete_appointment(...)` exactamente como hoy, con los mismos
  tres argumentos. La rama de cobro que ya existe no cambia ni una letra.
- **`src/app/actions/booking.ts`**
  - `getCachedBookingData` (L120): el select de `businesses` pasa a
    `"name, phone, address, loyalty_enabled, loyalty_cycle"`. El tag `BOOKING_DATA_TAG`
    y el `revalidate: 45` ya existen, así que el cambio del admin se propaga solo.
  - Nueva acción `getLoyaltyProgress(phone)` → `ActionResult<{cycle, progress, eligible}>`,
    validando con el mismo regex `/^0\d{9}$/` de `CreateAppointmentSchema`.
    **Fuera de `unstable_cache`**: es un dato por cliente, no compartido.
- **`src/lib/schemas/booking.ts`** — `CompleteAppointmentSchema` suma
  `redeemReward: z.boolean().default(false)`; `amount` pasa de `.positive()` a
  `.nonnegative()` con `.refine(d => d.redeemReward || d.amount > 0)`.
- **`src/lib/schemas/admin.ts`** — `LoyaltySettingsSchema`.
- **`src/app/actions/admin.ts`** — `updateLoyaltySettings` con el gate de siempre
  (`isCurrentUserAdmin()`) y cierre `revalidatePath("/admin")` + `updateTag(BOOKING_DATA_TAG)`,
  como `updateBusinessHours` (L477-489). `getAdminData` suma `businessRepo.get()`.
- **`src/app/actions/agenda.ts`** — `completeAppointment` reenvía `redeemReward` al repo;
  `COMPLETE_ERROR_MESSAGES` suma
  `COMPLETE_REWARD_NOT_ELIGIBLE: "Este cliente ya no tiene un corte gratis disponible."`.
  `getAgendaForDate` pide el progreso de los `client_id` del día en una sola llamada.

## Paso 3 — Admin: pestaña "Fidelidad"

- **`src/components/admin/loyalty-panel.tsx` (nuevo)**, calcado de `hours-panel.tsx`:
  estado local + `isDirty` + `useTransition`, botón que pasa a `variant="default"` con
  cambios y muestra `"Guardando..."`, `toast.success` / `toast.error`, alturas
  `h-11 sm:h-9`.
  - `Switch` "Programa activo".
  - Campo numérico "Un corte gratis cada N cortes" (2–20), con ayuda calculada en vivo:
    *"el cliente paga 5 y el 6to va por la casa"*.
  - Aviso de que cambiar el ciclo mueve el progreso de los clientes en curso.
  - Nota de que la comisión del barbero se paga igual, para que el dueño sepa qué firma.
- **`src/components/admin/admin-tabs.tsx`** — sexto `TabsTrigger` + `TabsContent`.
- **Limpiezas honestas** (arreglan cosas que hoy mienten):
  - `clients-panel.tsx` L37: `LOYAL_MIN_VISITS = 5` está duro; pasa a derivarse de
    `loyalty_cycle`. El badge "Fiel" se vuelve progreso real (`4/6`, o "Corte gratis").
  - `clients-panel.tsx` L337-340: el empty state dice *"Cada reserva… le suma una
    visita"*, que es **falso** — la visita se suma al completar.

## Paso 4 — Agenda: el canje

`src/components/agenda/agenda-view.tsx`:

- **`AppointmentCard` (L1254-1375)** — si es elegible y está `pending`, `Badge` mustard
  junto al nombre: "6to corte · gratis". Sin tocar la jerarquía de los botones.
- **`CompleteDialog` (L1379-1486)** — interruptor "Aplicar corte gratis" arriba.
  Encendido: importe bloqueado en `$0`, selector `cash|transfer` oculto, `isValid`
  (hoy `amountValue > 0`) acepta 0 solo en ese caso, y la línea de comisión se calcula
  sobre el precio del servicio con el rótulo *"Comisión $2,80 · sobre $7, la absorbe el
  local"*, para que el barbero vea en el acto que no pierde plata.
- **`handleCompleted` (L419-438)** — sin cambios de forma. El Realtime del canal
  `agenda-${barberId}` ya reacciona al `UPDATE` de status.
- **`DaySummary`** — `cobrado` sale de `payments.amount`, así que un canje suma $0 solo.

## Paso 5 — Cliente: el sello, sin pasos nuevos

- **`src/components/monky/loyalty-stamps.tsx` (nuevo)** — copia la mecánica de
  `step-progress.tsx` (L11-51): `role="progressbar"` con `aria-valuemin/max/now`,
  `motion.span` con `SPRING_SNAPPY`, `aria-live="polite"` en el texto. Tokens ya
  existentes: `rounded-[20px] bg-card shadow-card`, `text-muted-foreground`,
  `text-primary`, `tabular-nums`.

  | Progreso | Copy |
  | --- | --- |
  | 0 | "Este corte abre tu tarjeta · el 6to va por la casa" |
  | 1 … ciclo-2 | "Vas 4 de 6 · te faltan 2 para el corte gratis" |
  | elegible | "Tu próximo corte es gratis · recuérdalo al llegar" (mustard) |

- **Paso `details` (L750-844)** — cuando `phoneIsValid` pasa a true, llamar
  `getLoyaltyProgress` con debounce ~400 ms cancelando la anterior, y montar
  `<LoyaltyStamps>` debajo del campo del celular. Mientras carga, **nada** (ni skeleton
  ni salto de layout). Si falla, **nada**.
- **Paso `summary` (L906-909)** — si es elegible, una línea junto al total: *"Corte
  gratis por tus 5 visitas · se aplica al pagar en el local"*. No se muestra `$0`.
- **`confirmation-view.tsx`** — un `motion.div` con `variants={itemVariants}` tras la
  tarjeta-ticket; hereda el stagger sin tocarlo. El progreso se **vuelve a pedir** con
  el teléfono en memoria: así no se toca `ConfirmedBooking` (ver arriba por qué importa).
  Se monta solo con `restored === false`.

## Paso 6 — Home

`src/app/(cliente)/page.tsx` L69-84 muestra hoy `SOCIAL_PROOF` — "4.9 · +1.200 clientes
atendidos" — marcado `MOCKUP` en `brand.ts` L12 porque **son cifras inventadas**.
Sustituir esa línea, cuando `loyalty_enabled`, por una píldora real: *"El 6to corte va
por la casa"*. Se gana descubrimiento del programa y se quita un dato falso de la cara
de la home.

---

## Paso 7 — Estándar visual: qué significa "impecable"

Esto es lo que se revisa antes de decir que la función está lista. No es opinión: cada
punto se verifica y varios los cubre una prueba del paso 8.

| Criterio | Cómo se comprueba |
| --- | --- |
| **Sin salto de layout** | La tira de sellos reserva su altura desde el montaje. Prueba de regresión visual antes/después de que llegue el dato. |
| **Contraste WCAG 2.2 AA** | `PRODUCT.md` exige ≥ 4.5:1. El mustard `#d1a14d` **solo** lee como texto sobre slate o ink, nunca sobre relleno claro — está anotado en `globals.css` L162-166. Verificado con axe. |
| **Objetivos ≥ 44 px** | El interruptor de canje y todo lo tocable nuevo: `min-h-11`. Medido en la prueba. |
| **Teclado completo y foco visible** | Tabular todo el paso de datos y el diálogo de cobro sin ratón. |
| **`prefers-reduced-motion`** | `globals.css` L230-236 ya anula las animaciones CSS; las de `motion` las cubre `MotionProvider`. Se corre la suite visual con el flag puesto. |
| **Los tres estados** | Cargando (nada), vacío (progreso 0) y error (nada). Ninguno puede verse roto. |
| **Programa apagado = cero cambios** | Snapshot visual con `loyalty_enabled = false` comparado contra la baseline de hoy: debe ser **idéntico píxel a píxel**. |
| **Un solo lenguaje visual** | Nada de tokens nuevos: solo los `--mk-*` que ya existen. |
| **390 px, una mano** | Todo se ve y se alcanza en iPhone 14 Pro sin zoom ni scroll horizontal. |

## Paso 8 — Pruebas con Playwright

Hoy el repo tiene **cero tests**. Se monta la base aquí, aprovechando que ya existe
`marketing/scripts/` con Playwright funcionando contra esta app.

### 8.1 Infraestructura

```
package.json    → devDependency "@playwright/test", scripts "test", "test:ui", "test:update"
playwright.config.ts → projects: "iphone" (iPhone 14 Pro, es-EC, America/Guayaquil)
                                 "desktop" (agenda y admin)
                       webServer: npm run dev, reuseExistingServer
                       expect.toHaveScreenshot: { maxDiffPixelRatio: 0.002 }
tests/
  fixtures/supabase-stub.ts   ← promoción de marketing/scripts/00-supabase-local.mjs
  fixtures/seed.ts            ← estados: cliente nuevo, 4 sellos, elegible, recién canjeado
  e2e/reserva.spec.ts
  e2e/fidelidad-cliente.spec.ts
  e2e/fidelidad-canje.spec.ts
  e2e/admin-fidelidad.spec.ts
  visual/flujo-cliente.spec.ts
```

**La decisión clave: las pruebas no tocan tu Supabase.** Se reutiliza el suplente local
que ya escribí para las capturas (`marketing/scripts/00-supabase-local.mjs`), promovido a
fixture con los endpoints de fidelidad. Así la suite es hermética, determinista, corre en
CI sin credenciales y no deja basura en la base real. Los estados de fidelidad se siembran
en el fixture, no con SQL.

Para lo que el stub no puede probar (que la aritmética SQL y los permisos son correctos)
va una suite corta contra una **rama de Supabase** (`mcp__Supabase__create_branch`), que se
descarta al terminar.

### 8.2 Qué se prueba

**Flujo del cliente** (`fidelidad-cliente.spec.ts`)
- Con el programa apagado, ni una palabra de fidelidad aparece en ninguna pantalla.
- Teléfono inválido → no se llama al servidor. Teléfono válido → aparece la tira.
- Progreso 0 / 4 / elegible: el copy y los `aria-valuenow` correctos en cada caso.
- El servidor devuelve error → la tira no aparece **y la reserva se completa igual**.
  Esta es la prueba que protege el negocio: el premio nunca puede bloquear un turno.
- El teléfono precargado de `eb_client_phone` muestra los sellos sin escribir nada.
- Elegible → el resumen muestra la línea del corte gratis y el total **sigue mostrando
  el precio real**, no `$0`.

**Canje en agenda** (`fidelidad-canje.spec.ts`)
- Turno elegible → aparece el badge; turno no elegible → no aparece.
- Con el interruptor puesto: importe `$0`, selector de método oculto, comisión calculada
  sobre el precio del servicio.
- Doble clic en "Completar" no crea dos pagos.
- Cliente no elegible manipulado desde el cliente → el servidor responde
  `COMPLETE_REWARD_NOT_ELIGIBLE` y la UI muestra el mensaje en español.

**Admin** (`admin-fidelidad.spec.ts`)
- Encender el programa, guardar, y comprobar que el lado cliente lo refleja
  (con el `revalidate: 45` del caché en cuenta).
- Ciclo fuera de rango → botón deshabilitado y error inline.
- Un barbero no-admin no llega al panel.

**No regresión** (`reserva.spec.ts`)
- El flujo de reserva completo de hoy, extremo a extremo. Es el seguro de que el paso 5
  no rompió nada.
- **Cobro normal intacto**: completar un turno con `cash` y con `transfer` sigue dejando
  el pago y la comisión de siempre. Es la prueba que vigila que la función hermana no se
  haya llevado por delante la original.

**Las dos funciones no se separan** (suite SQL, contra la rama)
- Cerrar un turno por cobro y cerrarlo por canje dejan el mismo estado salvo el importe
  y el método: `status = 'completed'`, exactamente un pago, comisión con la misma
  fórmula. Es lo que impide que `complete_appointment` y `complete_appointment_reward`
  se vayan separando con el tiempo, que es el único precio que paga el diseño de dos
  funciones.

**Regresión visual** (`visual/flujo-cliente.spec.ts`)
- `toHaveScreenshot()` en las 12 pantallas del flujo, con animaciones congeladas
  (`animations: "disabled"`), reloj fijado (`page.clock`) y datos sembrados.
- La comparación **apagado vs. baseline actual** debe dar diferencia cero.

### 8.3 Accesibilidad

`@axe-core/playwright` sobre el paso de datos, la confirmación, el diálogo de cobro y el
panel de admin. Cero violaciones `serious` o `critical`.

---

## Skills a usar, y en qué paso

| Skill | Cuándo | Para qué |
| --- | --- | --- |
| **`fewer-permission-prompts`** | Antes de empezar | Ya nos bloqueó una vez: la llamada a Supabase fue denegada y el paso 1 quedó a medias. Esta skill revisa qué llamadas se repiten y escribe la lista de permitidas en `.claude/settings.json`. Se corre **primero** o el resto se interrumpe cada dos pasos. |
| **`run`** | Pasos 3, 4, 5, 6 | Levantar la app y verla funcionando de verdad, no solo en tests. Es la que confirma "la app real hace esto" después de cada paso. |
| **`session-start-hook`** | Con el paso 8 | Para que cualquier sesión (y Claude en la web) pueda instalar dependencias y correr lint y tests sin configuración manual. Sin esto, la suite del paso 8 solo corre en tu máquina. |
| **`skill-creator`** | Al cerrar el paso 8 | Empaquetar el QA visual del flujo cliente como skill del proyecto (`.claude/skills/qa-flujo-cliente`), para que en cada función futura se corra igual sin volver a explicarlo. Esto es lo que hace que el producto se mantenga limpio cuando lo vendas, no solo hoy. |
| **`code-review`** | Al cerrar cada paso, `high` | Revisión de correctitud sobre el diff. En el paso 1 y el paso 4 **es obligatoria**: ahí está el dinero. |
| **`security-review`** | Tras los pasos 1 y 2 | La migración crea tres funciones `security definer` y abre un endpoint público nuevo (`public_loyalty_progress`). Es exactamente el tipo de cambio que esta skill existe para revisar: grants, `search_path`, RLS y fuga de datos por enumeración de teléfonos. |
| **`simplify`** | Antes del commit final | Limpieza de calidad: reuso, duplicación y altura de abstracción. No busca bugs (para eso `code-review`). |

Las dos que no uso, y por qué: **`dataviz`** (no hay gráficos aquí; la tira de sellos es
un indicador de progreso, no una visualización de datos) y **`artifact-design`** (es para
páginas publicadas en claude.ai, no para la UI de tu app).

---

## Riesgos y bordes

- **Cambiar el ciclo afecta a los clientes en curso.** Bajar de 6 a 4 regala premios;
  subirlo los aleja. El panel lo advierte. El `max(..., 0)` evita negativos.
- **Servicios baratos llenan la tarjeta.** Con "cualquier servicio completado", cinco
  "Cejas" de $2 dan un corte de $7 gratis. Es la regla elegida. Si aparece el problema,
  el cambio es un `and s.price >= x` dentro de `loyalty_progress` más un campo en el
  panel, **sin tocar nada del lado cliente**.
- **Turnos de mostrador (`walk_in`).** Cuentan igual. Si el barbero no los registra, el
  cliente no acumula — es conversación de operación, no de código.
- **Idempotencia del canje.** La rama nueva vive dentro del mismo `for update of a` y la
  unicidad de `payments.appointment_id` sigue impidiendo dos pagos por turno.
- **Enumeración de teléfonos.** `public_loyalty_progress` responde lo mismo para un
  número desconocido que para un cliente nuevo y no devuelve nombres. No hay rate limit;
  si preocupa, se restringe a responder solo con el teléfono guardado en el dispositivo.

## Definición de "listo"

Un paso no está cerrado hasta que:

1. `npm run lint` y `npx tsc --noEmit` pasan.
2. `npm test` pasa, incluida la regresión visual.
3. `code-review` en `high` sin hallazgos abiertos.
4. La app se vio funcionando de verdad con la skill `run`, no solo en tests.
5. Con `loyalty_enabled = false`, la app es idéntica píxel a píxel a la de hoy.

## Orden de trabajo

```
0. fewer-permission-prompts        → dejar de tropezar con los permisos
1. Migración SQL + tipos           → preflight, rama, smoke 8/8, recién ahí producción
   └ security-review + code-review (obligatorio: aquí está el dinero)
2. Datos y acciones
3. Admin                           → el dueño ya puede encenderlo
4. Agenda                          → ya se puede canjear
   └ code-review (obligatorio)
5. Cliente                         → el cliente ya lo ve
6. Home                            → el cliente se entera antes de reservar
7. Estándar visual                 → repasar la tabla del paso 7
8. Playwright + axe + session-start-hook + skill-creator
   └ simplify, y commit final
```

Cada paso deja la app funcionando y desplegable. Con `loyalty_enabled = false` todo el
código nuevo está inerte.
