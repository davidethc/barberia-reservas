import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seed, signIn } from "../fixtures/stub";

/**
 * Scoped to the program's own pieces (data-slot="loyalty-*"). Violations that were already
 * in the surrounding screens before the program are tracked separately, not hidden here.
 */
async function expectNoSeriousViolations(page: Page, slot: string) {
  const { violations } = await new AxeBuilder({ page })
    .include(`[data-slot="${slot}"]`)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("diálogo de cobro con el corte gratis aplicado", async ({ page }) => {
  await seed("loyalty-eligible");
  await signIn(page, "barber");
  await expectNoSeriousViolations(page, "loyalty-badge");
  await page
    .locator("div")
    .filter({ hasText: "Luis Fiel" })
    .filter({ hasNotText: "Carlos Pérez" })
    .getByRole("button", { name: "Completar" })
    .click();
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
