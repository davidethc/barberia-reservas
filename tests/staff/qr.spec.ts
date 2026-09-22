import { readFileSync } from "node:fs";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { expect, test, type Download } from "@playwright/test";
import { expectNoSeriousViolations } from "../fixtures/a11y";
import { seed, signIn } from "../fixtures/stub";

// El QR del local. Lo que importa no es que se dibuje algo, sino que al escanearlo lleve a
// reservar: por eso cada PNG descargado se decodifica de verdad.

const BOOKING_URL = "http://127.0.0.1:3100/reservar";

async function decodeQr(download: Download): Promise<string | null> {
  const path = await download.path();
  const png = PNG.sync.read(readFileSync(path));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
}

test.beforeEach(async ({ page }) => {
  await seed("base");
  await signIn(page, "admin");
  await page.goto("/admin");
  await page.getByRole("tab", { name: "QR" }).click();
});

test("el panel muestra el QR y la dirección de reservas", async ({ page }) => {
  await expect(page.getByRole("img", { name: /Código QR que abre/ })).toBeVisible();
  await expect(page.getByText("127.0.0.1:3100/reservar")).toBeVisible();
  await expectNoSeriousViolations(page, "qr-panel");
});

test("el QR descargado lleva a la página de reservas", async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Descargar QR/ }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("monky-qr-reservar.png");
  expect(await decodeQr(download)).toBe(BOOKING_URL);
});

test("el cartel imprimible también lleva a reservas", async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Descargar cartel/ }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("monky-cartel-qr.png");
  expect(await decodeQr(download)).toBe(BOOKING_URL);
});

test("copiar enlace deja la dirección completa en el portapapeles", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copiar" }).click();

  await expect(page.getByText("Enlace copiado")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(BOOKING_URL);
});
