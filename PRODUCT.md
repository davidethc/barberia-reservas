# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Clientes de una barbería de barrio en Milagro, Ecuador, que reservan un turno desde el celular (base 390px), normalmente con prisa y una mano. Segundo público: barberos y administración, que usan /agenda y /admin (fuera del alcance del rediseño de cliente).

## Product Purpose
Reservar un turno en segundos: elegir servicio, barbero (o cualquiera disponible), día y hora, dejar nombre y teléfono, y recibir confirmación con código. Éxito = reserva completada sin llamar ni escribir por WhatsApp.

## Positioning
Reserva directa con la agenda real de la barbería (Supabase): los horarios que ve el cliente son los libres de verdad, por barbero, sin intermediarios ni cuentas.

## Operating Context
Los clientes no tienen cuenta: la reserva confirmada vive en el dispositivo (localStorage). Pago en el local. Contacto habitual por WhatsApp. Moneda USD; copys en español de Ecuador, tono cercano y breve.

## Capabilities and Constraints
- Servicios, precios, duraciones, barberos, horario y datos del negocio salen de Supabase (`getBookingData()`); no se escriben a mano.
- Disponibilidad por barbero vía RPC; pausa de almuerzo 12:00–13:00; teléfono validado `0XXXXXXXXX`.
- Next.js 16 App Router, Tailwind v4, motion, lucide-react.
- Admin y agenda conservan su propio tema.

## Brand Commitments
- Nombre: MONKY BARBER. (El registro en la base aún dice "Exclusive Barber Shop"; pendiente de actualizar desde el panel.)
- Referencia visual oficial: `public/images/ref/Gemini_Generated_Image_18mc9218mc9218mc.jpeg` (póster ilustrado, fijado por el usuario como dirección visual).

## Evidence on Hand
- Ilustración del barbero (referencia recortada en `public/images/hero-barbero.png`).
- Sin fotos de barberos ni servicios, sin logo vectorial, sin reseñas, nº de clientes, redes ni políticas reales: todo eso va marcado MOCKUP y no se presenta como dato real.

## Product Principles
1. El botón de reservar siempre a la vista; nada compite con él.
2. Lo que se muestra es real o está marcado como pendiente.
3. Un solo lenguaje visual de la home al éxito.
4. Móvil primero, una mano, conexión irregular.

## Accessibility & Inclusion
WCAG 2.2 AA: contraste ≥ 4.5:1, foco visible, teclado completo, objetivos ≥ 44px, respeto de prefers-reduced-motion.
