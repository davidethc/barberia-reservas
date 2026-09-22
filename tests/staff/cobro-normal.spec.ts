import { expect, test } from "@playwright/test";
import { seed, signIn, stubState } from "../fixtures/stub";

// El camino del dinero tal como existe hoy. Si alguna fase del programa de fidelidad lo
// toca, esto se pone en rojo.

test.beforeEach(async ({ page }) => {
  await seed("base");
  await signIn(page, "barber");
  await expect(page.getByText("Carlos Pérez")).toBeVisible();
});

test("cobro en efectivo por el precio del servicio", async ({ page }) => {
  await page.getByRole("button", { name: "Completar" }).click();
  const dialog = page.getByRole("dialog", { name: "Completar turno" });
  await expect(dialog.getByText(/Comisión \(40%\)/)).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByText("Turno completado")).toBeVisible();
  const { payments, appointments } = await stubState();
  expect(payments).toHaveLength(1);
  expect(payments[0]).toMatchObject({ amount: 7, payment_method: "cash", commission_amount: 2.8 });
  expect(appointments.find((a) => a.id === payments[0]?.appointment_id)?.status).toBe("completed");
});

test("cobro por transferencia con otro monto", async ({ page }) => {
  await page.getByRole("button", { name: "Completar" }).click();
  const dialog = page.getByRole("dialog", { name: "Completar turno" });
  await dialog.getByRole("button", { name: "Transferencia" }).click();
  await dialog.getByLabel("Monto").fill("8");
  await dialog.getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByText("Turno completado")).toBeVisible();
  const { payments } = await stubState();
  expect(payments[0]).toMatchObject({ amount: 8, payment_method: "transfer", commission_amount: 3.2 });
});

test("cancelar un turno pendiente sigue funcionando", async ({ page }) => {
  await page.getByRole("button", { name: "Cancelar turno" }).click();
  await page.getByRole("button", { name: "Sí, cancelar" }).click();

  await expect.poll(async () => (await stubState()).appointments[0]?.status).toBe("cancelled");
  expect((await stubState()).payments).toHaveLength(0);
});
