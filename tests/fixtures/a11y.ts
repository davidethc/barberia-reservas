import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * axe (WCAG 2.2 AA) over one of the program's own pieces (data-slot="loyalty-*"): zero
 * serious or critical violations. Violations that were already in the surrounding screens
 * before the program are tracked separately, not hidden here.
 */
export async function expectNoSeriousViolations(page: Page, slot: string) {
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
