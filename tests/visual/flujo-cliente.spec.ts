import { expect, test, type Locator, type Page } from "@playwright/test";
import { seed } from "../fixtures/stub";

// Línea base visual del lado del cliente, tomada sobre el código de ANTES del programa de
// fidelidad. Con `loyalty_enabled = false` estas capturas tienen que seguir idénticas: es
// la prueba de que el programa apagado no cambia ni un píxel.
//
// Lo que depende del día (fechas, código de cita, año del pie) se tapa con `mask`, así la
// captura no cambia de un día a otro.

test.use({ reducedMotion: "reduce" });

test.beforeEach(async () => {
  await seed("base");
});

async function shot(page: Page, name: string, mask: Locator[] = []) {
  // The dev-mode "N" badge is Next's, not the app's.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(name, { fullPage: true, mask });
}

test("home @visual", async ({ page }) => {
  await page.goto("/");
  await shot(page, "home.png", [page.getByText(/©/)]);
});

test("servicios @visual", async ({ page }) => {
  await page.goto("/servicios");
  await shot(page, "servicios.png", [page.getByText(/©/)]);
});

test("wizard completo @visual", async ({ page }) => {
  await page.goto("/reservar");
  await shot(page, "01-servicio.png");

  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await expect(page.getByRole("heading", { name: "Elige tu barbero" })).toBeVisible();
  await shot(page, "02-barbero.png");

  await page.getByRole("button", { name: "Bruno" }).click();
  await page.getByRole("group", { name: "Fecha" }).getByRole("button").nth(1).click();
  await expect(page.getByRole("region", { name: "Tarde" })).toBeVisible();
  const dates = page.getByRole("group", { name: "Fecha" });
  await shot(page, "03-horario.png", [dates]);

  await page.getByRole("region", { name: "Tarde" }).getByRole("button", { name: "13:00" }).click();
  await expect(page.getByRole("heading", { name: "Déjanos tus datos" })).toBeVisible();
  const context = page.getByText(/Corte clásico · \$7 · Bruno ·/);
  await shot(page, "04-datos.png", [context]);

  await page.getByRole("textbox", { name: "Nombre" }).fill("Ana Prueba");
  await page.getByRole("textbox", { name: "Celular" }).fill("0987654321");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu cita" })).toBeVisible();
  await shot(page, "05-resumen.png", [page.getByRole("definition").filter({ hasText: /septiembre|octubre|noviembre|diciembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto/ })]);

  await page.getByRole("button", { name: /Confirmar reserva/ }).click();
  await expect(page.getByRole("heading", { name: /Listo, te esperamos/ })).toBeVisible();
  await shot(page, "06-confirmacion.png", [
    page.getByText(/^[0-9A-F]{6}$/),
    page.getByRole("definition").filter({ hasText: /septiembre|octubre|noviembre|diciembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto/ }),
  ]);
});
