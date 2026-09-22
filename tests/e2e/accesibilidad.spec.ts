import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { reachDetails, setProgram } from "../fixtures/flows";
import { LOYAL_PHONE, seed } from "../fixtures/stub";

// axe sobre las pantallas nuevas del programa, con él encendido. Cero violaciones serias o
// críticas: es el piso de WCAG 2.2 AA que fija PRODUCT.md.

/**
 * Scoped to the program's own pieces (data-slot="loyalty-*"). Violations that were already
 * in the surrounding screens before the program are tracked separately, not hidden here.
 */
async function expectNoSeriousViolations(page: Page, slot: string) {
  // Step transitions fade in (opacity survives reduced motion); measured mid-fade, every
  // color reads washed out. Wait until the piece and its ancestors are fully opaque.
  await page.waitForFunction((sel) => {
    let el = document.querySelector(sel);
    if (!el) return false;
    for (; el; el = el.parentElement) if (getComputedStyle(el).opacity !== "1") return false;
    return true;
  }, `[data-slot="${slot}"]`);
  const { violations } = await new AxeBuilder({ page })
    .include(`[data-slot="${slot}"]`)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

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
