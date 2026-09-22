import { expect, test, type Page } from "@playwright/test";
import { seed, signIn, stubState, turnLoyaltyOff } from "../fixtures/stub";

// El canje en la agenda: aquí está el dinero. "Luis Fiel" tiene cinco cortes pagados y un
// turno pendiente hoy a las 18:00; "Carlos Pérez" es un cliente sin sellos a las 17:00.

function cardOf(page: Page, name: string, other: string) {
  return page.locator("div").filter({ hasText: name }).filter({ hasNotText: other });
}

test.beforeEach(async ({ page }) => {
  await seed("loyalty-eligible");
  await signIn(page, "barber");
  await expect(page.getByText("Luis Fiel")).toBeVisible();
});

test("solo el cliente elegible lleva la insignia de corte gratis", async ({ page }) => {
  await expect(cardOf(page, "Luis Fiel", "Carlos Pérez").getByText("Corte gratis")).toBeVisible();
  await expect(cardOf(page, "Carlos Pérez", "Luis Fiel").getByText("Corte gratis")).toHaveCount(0);
});

test("aplicar el corte gratis: $0, sin método de pago y comisión sobre el precio", async ({ page }) => {
  await cardOf(page, "Luis Fiel", "Carlos Pérez").getByRole("button", { name: "Completar" }).click();
  const dialog = page.getByRole("dialog", { name: "Completar turno" });

  // Apagado por defecto: el canje siempre es decisión explícita del barbero.
  await expect(dialog.getByRole("switch", { name: "Aplicar corte gratis" })).not.toBeChecked();
  await dialog.getByRole("switch", { name: "Aplicar corte gratis" }).click();

  await expect(dialog.getByRole("button", { name: "Efectivo" })).toHaveCount(0);
  await expect(dialog.getByText("$0,00")).toBeVisible();
  await expect(dialog.getByText("$2,80")).toBeVisible();
  await expect(dialog.getByText(/absorbe el local/)).toBeVisible();

  await dialog.getByRole("button", { name: "Confirmar corte gratis" }).click();
  await expect(page.getByText("Corte gratis aplicado")).toBeVisible();

  const { payments, appointments } = await stubState();
  const reward = payments.find((p) => p.payment_method === "reward");
  expect(reward).toMatchObject({ amount: 0, commission_amount: 2.8 });
  expect(appointments.find((a) => a.id === reward?.appointment_id)).toMatchObject({
    status: "completed",
    is_reward: true,
  });
});

test("un doble clic no crea dos pagos", async ({ page }) => {
  await cardOf(page, "Luis Fiel", "Carlos Pérez").getByRole("button", { name: "Completar" }).click();
  const dialog = page.getByRole("dialog", { name: "Completar turno" });
  await dialog.getByRole("switch", { name: "Aplicar corte gratis" }).click();
  await dialog.getByRole("button", { name: "Confirmar corte gratis" }).dblclick();

  await expect(page.getByText("Corte gratis aplicado")).toBeVisible();
  const rewards = (await stubState()).payments.filter((p) => p.payment_method === "reward");
  expect(rewards).toHaveLength(1);
});

test("si el premio ya no corresponde, el servidor lo rechaza con un mensaje claro", async ({ page }) => {
  await cardOf(page, "Luis Fiel", "Carlos Pérez").getByRole("button", { name: "Completar" }).click();
  const dialog = page.getByRole("dialog", { name: "Completar turno" });
  await dialog.getByRole("switch", { name: "Aplicar corte gratis" }).click();

  await turnLoyaltyOff();
  await dialog.getByRole("button", { name: "Confirmar corte gratis" }).click();

  await expect(page.getByText("Este cliente ya no tiene un corte gratis disponible.")).toBeVisible();
  expect((await stubState()).payments.some((p) => p.payment_method === "reward")).toBe(false);
});

test("con el interruptor apagado el cobro de un cliente elegible es el normal", async ({ page }) => {
  await cardOf(page, "Luis Fiel", "Carlos Pérez").getByRole("button", { name: "Completar" }).click();
  await page.getByRole("dialog", { name: "Completar turno" }).getByRole("button", { name: "Confirmar" }).click();

  await expect(page.getByText("Turno completado")).toBeVisible();
  const today = (await stubState()).payments.filter((p) => p.payment_method !== "reward");
  expect(today.at(-1)).toMatchObject({ amount: 7, payment_method: "cash" });
});

test("tras canjear, el otro turno del mismo cliente ya no ofrece el premio", async ({ page }) => {
  await seed("loyalty-eligible-two");
  await page.reload();
  // The agenda prints "9:00", so match it without also matching "19:00".
  const nine = /(^|[^0-9])9:00/;
  const morning = page.locator("div").filter({ hasText: nine }).filter({ hasNotText: "18:00" }).filter({ hasText: "Luis Fiel" });
  const evening = page.locator("div").filter({ hasText: "18:00" }).filter({ hasNotText: nine }).filter({ hasText: "Luis Fiel" });
  await expect(morning.getByText("Corte gratis")).toBeVisible();

  await evening.getByRole("button", { name: "Completar" }).click();
  const dialog = page.getByRole("dialog", { name: "Completar turno" });
  await dialog.getByRole("switch", { name: "Aplicar corte gratis" }).click();
  await dialog.getByRole("button", { name: "Confirmar corte gratis" }).click();
  await expect(page.getByText("Corte gratis aplicado")).toBeVisible();

  await expect(morning.getByText("Corte gratis")).toHaveCount(0);
  await morning.getByRole("button", { name: "Completar" }).click();
  await expect(page.getByRole("switch", { name: "Aplicar corte gratis" })).toHaveCount(0);
});
