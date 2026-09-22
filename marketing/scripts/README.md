# Capturas de marketing · MONKY BARBER

Scripts para regenerar las capturas del flujo de cliente y las piezas para redes.

## Qué hay

| Script | Qué hace |
| --- | --- |
| `lib.mjs` | Contexto de Playwright (iPhone 14 Pro, `es-EC`), CSS que oculta el overlay de `next dev` y las scrollbars, y las tipografías de la marca inlineadas. |
| `00-supabase-local.mjs` | Suplente local de la API de Supabase. **Solo hace falta si el entorno no alcanza el host real** (ver más abajo). |
| `01-flujo.mjs` | Recorre home → servicios → wizard (servicio, barbero, día y hora, datos, resumen) → confirmación y guarda un PNG por pantalla. |
| `02-posts.mjs` | Compone los posts verticales 1080×1350 (HTML + Playwright a `deviceScaleFactor: 2`). |
| `03-banner.mjs` | Compone el banner de LinkedIn 1200×627. |
| `fuentes/` | Plus Jakarta Sans y Yellowtail (subconjunto latino), las mismas caras que usa `src/app/(cliente)/layout.tsx`. |

## Cómo regenerar

```bash
# 1. Servidor de la app (usa el que ya esté corriendo si lo hay)
npm run dev                                   # en el repo, puerto 3000

# 2. Capturas crudas a 3x  (--scale=1 para explorar rápido, sin --confirm para no reservar)
node scripts/01-flujo.mjs --scale=3 --out="$PWD/capturas-crudas" --confirm

# 3. Piezas
node scripts/02-posts.mjs
node scripts/03-banner.mjs
```

`BASE_URL` cambia el origen si la app no está en `http://localhost:3000`.

## Nota sobre los datos

La sesión en la que se generaron estas capturas tenía el egreso a
`*.supabase.co` bloqueado por política, así que `next dev` no podía leer la base y
todas las pantallas caían en su estado vacío. Para salir del paso se levantó
`00-supabase-local.mjs`, sembrado con las filas reales del proyecto (servicios,
precios, duraciones, barberos, negocio, horario y turnos ya tomados) leídas por
separado, y se apuntó `NEXT_PUBLIC_SUPABASE_URL` a él:

```bash
node scripts/00-supabase-local.mjs &                     # escucha en 54321
# .env.local → NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
```

Lo que se ve en las capturas es contenido real; la reserva de "Andrés Villamar"
vive solo en la memoria de ese proceso y **nunca se escribió en la base**. Donde
el host real sí se alcance, no hace falta el suplente: basta con el `.env.local`
de siempre. Ningún archivo de la app se modificó para las capturas.
