// Walks the MONKY BARBER client flow as a real customer on an iPhone 14 Pro and
// shoots every screen. Usage: node 01-flujo.mjs --scale=3 --out=<dir> [--confirm]
import fs from "node:fs";
import { launch, newContext, goto, shoot, waitToastGone } from "./lib.mjs";

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split("=")[1];
const SCALE = Number(arg("scale", 3));
const OUT = arg("out", ".");
const CONFIRM = process.argv.includes("--confirm");

fs.mkdirSync(OUT, { recursive: true });

const CLIENTE = {
  nombre: "Andrés Villamar",
  celular: "0991234567",
  notas: "Quiero el degradado un poco más bajo y la barba perfilada.",
};

const browser = await launch();
const ctx = await newContext(browser, { scale: SCALE });
const page = await ctx.newPage();

// ── Home ────────────────────────────────────────────────────────────────────
console.log("Home");
await goto(page, "/");
await shoot(page, OUT, "01-home-hero");

// Park each section title just under the sticky header instead of wherever
// scrollIntoView lands it, so no heading is half cut.
for (const [id, name] of [
  ["#servicios", "02-home-servicios"],
  ["#barberos", "03-home-barberos"],
  ["#visitanos", "04-home-visitanos"],
]) {
  await page.evaluate((sel) => {
    const top = document.querySelector(sel).getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - 78 });
  }, id);
  await shoot(page, OUT, name);
}

// ── Catálogo completo ───────────────────────────────────────────────────────
console.log("Servicios");
await goto(page, "/servicios");
await shoot(page, OUT, "05-servicios-lista");

// ── Wizard ──────────────────────────────────────────────────────────────────
console.log("Reservar");
await goto(page, "/reservar");
await shoot(page, OUT, "06-wizard-servicio");

await page.getByRole("button", { name: /Corte \+ Barba/ }).click();
await shoot(page, OUT, "07-wizard-barbero");

await page.getByRole("button", { name: "Carlos", exact: true }).click();

// Second chip = tomorrow; skip any day the shop is closed.
const chips = page.locator('[role="group"][aria-label="Fecha"] button:not([disabled])');
await chips.nth(1).click();
await page.locator('section[aria-label] button:not([disabled])').first().waitFor({ timeout: 15000 });
// Clicking a chip scrolls the strip; rewind it so "Hoy" and the chosen day both show.
await page.evaluate(() => document.querySelector('[role="group"][aria-label="Fecha"]').scrollTo({ left: 0 }));
await shoot(page, OUT, "08-wizard-horarios");

// First bookable afternoon slot, so the grid above it stays visible.
const tarde = page.locator('section[aria-label="Tarde"] button:not([disabled])');
const slot = (await tarde.count()) ? tarde.first() : page.locator('section[aria-label] button:not([disabled])').first();
const hora = (await slot.textContent())?.trim();
console.log("  hora elegida:", hora);
await slot.click();

await page.getByLabel("Nombre").fill(CLIENTE.nombre);
await page.getByLabel("Celular").fill(CLIENTE.celular);
await page.getByLabel("Notas (opcional)").fill(CLIENTE.notas);
// Drop the focus ring: a caret in the notes box reads as unfinished.
await page.evaluate(() => document.activeElement?.blur());
await shoot(page, OUT, "09-wizard-datos");

await page.getByRole("button", { name: /^Continuar/ }).click();
// Bottom of the card, so the total sits above the sticky CTA instead of under it.
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
await shoot(page, OUT, "10-wizard-resumen");

if (CONFIRM) {
  await page.getByRole("button", { name: /Confirmar reserva/ }).click();
  await page.getByText("Código de cita").waitFor({ timeout: 20000 });
  await waitToastGone(page);
  await shoot(page, OUT, "11-confirmacion");

  const codigo = (await page.locator("text=Código de cita").locator("xpath=following-sibling::span").textContent())?.trim();
  console.log("  RESERVA CREADA · código:", codigo, "· hora:", hora);

  await ctx.storageState({ path: `${OUT}/../storage-state.json` });

  // The same screen when the client comes back later ("Tu próxima cita").
  await goto(page, "/reservar");
  await page.getByText("Código de cita").waitFor({ timeout: 20000 });
  await shoot(page, OUT, "12-mi-proxima-cita");
}

await browser.close();
console.log("Listo →", OUT);
