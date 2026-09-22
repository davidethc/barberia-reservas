import { expect, type Browser, type Page } from "@playwright/test";
import { signIn } from "./stub";

/** Service → barber → the day after today (never has past slots) → 13:00 → details. */
export async function reachDetails(page: Page) {
  await page.goto("/reservar");
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await expect(page.getByRole("heading", { name: "Elige tu barbero" })).toBeVisible();
  await page.getByRole("button", { name: "Bruno" }).click();
  await expect(page.getByRole("heading", { name: "Elige día y hora" })).toBeVisible();
  await page.getByRole("group", { name: "Fecha" }).getByRole("button").nth(1).click();
  await page.getByRole("region", { name: "Tarde" }).getByRole("button", { name: "13:00" }).click();
  await expect(page.getByRole("heading", { name: "Déjanos tus datos" })).toBeVisible();
}

/**
 * The public pages read the program from the cached booking data (45 s), so seeding the stub
 * is not enough: this goes through the admin panel, the real path that invalidates that
 * cache, whatever it held before.
 */
export async function setProgram(browser: Browser, enabled: boolean, cycle = 6) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signIn(page, "admin");
    await page.goto("/admin");
    await page.getByRole("tab", { name: "Fidelidad" }).click();
    const toggle = page.getByRole("switch", { name: "Programa de fidelidad activo" });
    const save = page.getByRole("button", { name: "Guardar" });

    await page.getByLabel("Un corte gratis cada").fill(String(cycle));
    // Every save calls updateTag. When the panel already shows the wanted state there is
    // nothing to save, so flip it once and back: two saves, cache invalidated either way.
    const current = await toggle.isChecked();
    const targets = current === enabled ? [!enabled, enabled] : [enabled];
    for (const target of targets) {
      // A click that lands before hydration is lost, so retry until the switch took it.
      await expect(async () => {
        if ((await toggle.isChecked()) !== target) await toggle.click();
        await expect(toggle).toBeChecked({ checked: target, timeout: 1000 });
      }).toPass({ timeout: 15_000 });
      await expect(save).toBeEnabled();
      await save.click();
      await expect(save).toBeDisabled();
    }
  } finally {
    await context.close();
  }
}
