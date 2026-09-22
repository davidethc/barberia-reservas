import { expect, test } from "@playwright/test";
import { expectNoSeriousViolations } from "../fixtures/a11y";
import { agendaCard } from "../fixtures/flows";
import { seed, signIn } from "../fixtures/stub";

test("diálogo de cobro con el corte gratis aplicado", async ({ page }) => {
  await seed("loyalty-eligible");
  await signIn(page, "barber");
  await expectNoSeriousViolations(page, "loyalty-badge");
  await agendaCard(page, "Luis Fiel", "Carlos Pérez").getByRole("button", { name: "Completar" }).click();
  await page.getByRole("switch", { name: "Aplicar corte gratis" }).click();
  await expect(page.getByRole("button", { name: "Confirmar corte gratis" })).toBeVisible();
  await expectNoSeriousViolations(page, "loyalty-redeem");
});

test("pestaña Fidelidad del admin", async ({ page }) => {
  await seed("base");
  await signIn(page, "admin");
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Fidelidad" }).click();
  await expect(page.getByLabel("Un corte gratis cada")).toBeVisible();
  await expectNoSeriousViolations(page, "loyalty-panel");
});
