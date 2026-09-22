---
name: qa-flujo-cliente
description: QA del flujo de reserva de MONKY BARBER (cliente, agenda y admin) antes de dar por terminada cualquier función. Úsala siempre que cambies algo en src/ que toque el wizard de /reservar, la home, la confirmación, la agenda o el admin, o cuando pidan "probar", "QA", "verificar que no se rompió nada" o "la línea base visual". Corre la suite de Playwright contra el Supabase suplente (nunca contra producción), revisa la regresión visual y axe, y dice exactamente qué hacer si una captura cambió a propósito.
---

# QA del flujo de reserva

La suite nunca toca la base real: `playwright.config.ts` levanta la app en `127.0.0.1:3100`
apuntando al suplente `tests/fixtures/supabase-stub.mjs` (`127.0.0.1:54399`), y
`tests/global-setup.ts` aborta si la home no muestra la dirección del suplente.

## 1. Correr todo

```bash
npm run lint && npx tsc --noEmit && npm test
```

- `npm test` corre los dos proyectos: `iphone` (cliente, iPhone 14 Pro, es-EC) y
  `desktop` (tests/staff: agenda y admin).
- Si ya hay un suplente o un `next dev -p 3100` corriendo de antes, se reutiliza. Si
  cambiaste `supabase-stub.mjs`, mátalo primero o vas a probar la versión vieja.

## 2. Leer un fallo

- **Funcional** (`tests/e2e`, `tests/staff`): el mensaje dice qué texto o estado faltó.
  `npx playwright show-trace test-results/<carpeta>/trace.zip` muestra el paso a paso.
- **Visual** (`tests/visual`, etiqueta `@visual`): compara con la línea base de
  `tests/visual/flujo-cliente.spec.ts-snapshots/`. Esa línea base es la app con el
  programa de fidelidad **apagado**: si cambió sin que tocaras esa pantalla, es una
  regresión. Solo si el cambio es intencional: `npm run test:update` y revisa las PNG
  nuevas antes de commitearlas.
- **axe** (`accesibilidad*.spec.ts`): miden solo las piezas `data-slot="loyalty-*"`.
  Una pieza nueva va con su propio `data-slot` y su propia comprobación.

## 3. Estados de datos

`tests/fixtures/stub.ts` → `seed(...)`: `base`, `loyalty-new`, `loyalty-4`,
`loyalty-eligible`, `loyalty-eligible-two`, `loyalty-redeemed`. `failRpc(nombre)` hace
fallar una RPC; `turnLoyaltyOff()` apaga el programa por detrás.

Los datos públicos (servicios, negocio, programa encendido/apagado) están en caché 45 s:
sembrar no basta. Para cambiar el programa usa `setProgram(browser, on)` de
`tests/fixtures/flows.ts`, que pasa por el panel del admin (lo que invalida la caché).

## 4. Verlo de verdad

Además de la suite, recorre el cambio a 390 px con `playwright-cli`
(`--browser=chromium --device="iPhone 14 Pro"`) contra `http://127.0.0.1:3100`, con el
suplente sembrado. Credenciales del suplente: `admin@monky.test` / `barbero@monky.test`,
contraseña `monky-test-1`.

## 5. Base de datos

La lógica SQL no la prueba el suplente. Si tocaste una función o una migración en
`supabase/`, corre `supabase/checks/smoke_loyalty.sql` en producción: se deshace solo y
tiene que terminar en `SMOKE_OK`.

## Listo significa

Lint sin errores, `tsc` limpio, `npm test` en verde (incluida la línea base visual), y el
cambio visto funcionando a 390 px.
