import { readFileSync } from "node:fs";
// Shared Playwright helpers for the MONKY BARBER marketing captures.
// The repo does not depend on Playwright: it is resolved from node_modules if it happens to
// be there, and otherwise from the global install. PLAYWRIGHT_PATH overrides both.
const playwright = await (async () => {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    "playwright",
    "/opt/node22/lib/node_modules/playwright/index.mjs",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return await import(c);
    } catch {}
  }
  throw new Error(`No se pudo cargar Playwright. Probé: ${candidates.join(", ")}`);
})();
const { chromium, devices } = playwright;

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/** Hides the Next.js dev overlay and scrollbars. Re-inject after every navigation. */
export const HIDE_CSS = `
  nextjs-portal { display: none !important; }
  *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
  * { scrollbar-width: none !important; }
`;

export async function launch() {
  return chromium.launch({ args: ["--no-proxy-server", "--force-color-profile=srgb"] });
}

export async function newContext(browser, { scale = 3, storageState } = {}) {
  return browser.newContext({
    ...devices["iPhone 14 Pro"],
    deviceScaleFactor: scale,
    locale: "es-EC",
    timezoneId: "America/Guayaquil",
    storageState,
  });
}

export async function goto(page, path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: HIDE_CSS });
}

/** Waits out the entry animations (mk-rise / motion springs) before shooting. */
export async function shoot(page, dir, name) {
  await page.addStyleTag({ content: HIDE_CSS });
  await page.waitForTimeout(1000);
  const file = `${dir}/${name}.png`;
  await page.screenshot({ path: file });
  console.log("  ✓", name);
  return file;
}

/** Sonner toasts sit over the header; wait for them to leave the DOM. */
export async function waitToastGone(page) {
  await page.locator("[data-sonner-toast]").first().waitFor({ state: "detached", timeout: 12000 }).catch(() => {});
}

/**
 * The client theme's own faces (src/app/(cliente)/layout.tsx): Plus Jakarta Sans for text
 * and Yellowtail for the script accent. Inlined as base64 because this session's Chromium
 * does not trust the proxy CA, so fonts.googleapis.com cannot be reached from the page.
 */
export function fontCss() {
  const dir = new URL("./fuentes/", import.meta.url);
  const face = (family, file, weight) => {
    const b64 = readFileSync(new URL(file, dir)).toString("base64");
    return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
  };
  return [
    face("Jakarta", "plus-jakarta-sans-latin.woff2", "200 800"),
    face("Yellowtail", "yellowtail-latin.woff2", "400"),
  ].join("\n");
}
