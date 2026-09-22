import { expect, test } from "@playwright/test";
import { expectNoSeriousViolations } from "../fixtures/a11y";
import { reachDetails, setProgram } from "../fixtures/flows";
import { LOYAL_PHONE, seed } from "../fixtures/stub";

// axe sobre las pantallas nuevas del programa, con él encendido. Cero violaciones serias o
// críticas: es el piso de WCAG 2.2 AA que fija PRODUCT.md.


test.use({ reducedMotion: "reduce" });

test("paso de datos, resumen y confirmación con la tarjeta de sellos", async ({ page, browser }) => {
  await seed("loyalty-eligible");
  await setProgram(browser, true);
  await reachDetails(page);
  await page.getByRole("textbox", { name: "Nombre" }).fill("Luis Fiel");
  await page.getByRole("textbox", { name: "Celular" }).fill(LOYAL_PHONE);
  await expect(page.getByRole("progressbar", { name: /Tarjeta de sellos/ })).toBeVisible();
  await expectNoSeriousViolations(page, "loyalty-stamps");

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/se aplica al pagar en el local/)).toBeVisible();
  await expectNoSeriousViolations(page, "loyalty-summary");

  await page.getByRole("button", { name: /Confirmar reserva/ }).click();
  await expect(page.getByText("Este corte va por la casa.")).toBeVisible();
  await expectNoSeriousViolations(page, "loyalty-stamps");
});

test("home con el programa encendido", async ({ page, browser }) => {
  await seed("loyalty-new");
  await setProgram(browser, true);
  await page.goto("/");
  await expect(page.getByText(/corte va por la casa/)).toBeVisible();
  await expectNoSeriousViolations(page, "loyalty-home");
});
