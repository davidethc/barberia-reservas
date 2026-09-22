import { expect, test } from "@playwright/test";
import { seed, signIn, stubState } from "../fixtures/stub";

test.beforeEach(async () => {
  await seed("base");
});

test("el admin enciende el programa y cambia el ciclo", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Fidelidad" }).click();

  await expect(page.getByText("Apagado: la web se ve exactamente como antes.")).toBeVisible();
  await page.getByRole("switch", { name: "Programa de fidelidad activo" }).click();
  await page.getByLabel("Un corte gratis cada").fill("5");
  await expect(page.getByText("El cliente paga 4 y el 5to va por la casa.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText("Programa de fidelidad activo")).toBeVisible();
  const [business] = (await stubState()).businesses;
  expect(business).toMatchObject({ loyalty_enabled: true, loyalty_cycle: 5 });
});

test("un ciclo fuera de rango no se puede guardar", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Fidelidad" }).click();

  await page.getByLabel("Un corte gratis cada").fill("25");
  await expect(page.getByText("Elige un número entre 2 y 20.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar" })).toBeDisabled();
  expect((await stubState()).businesses[0]?.loyalty_cycle).toBe(6);
});

test("la lista de clientes muestra los sellos reales con el programa encendido", async ({ page }) => {
  await seed("loyalty-4");
  await signIn(page, "admin");
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Clientes" }).click();

  await expect(page.getByLabel("4 de 5 sellos para el corte gratis")).toBeVisible();
});

test("un barbero que no es admin no llega al panel", async ({ page }) => {
  await signIn(page, "barber");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/agenda(\?|$)/);
});
