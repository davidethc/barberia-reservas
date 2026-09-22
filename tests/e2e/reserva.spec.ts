import { expect, test, type Page } from "@playwright/test";
import { seed, stubState } from "../fixtures/stub";

// Regresión del flujo de reserva tal como existe hoy. Incluye los cinco escenarios de
// testsprite-plans/, reescritos para el wizard actual de cinco pasos.

test.beforeEach(async () => {
  await seed("base");
});

async function reachDetails(page: Page) {
  await page.goto("/reservar");
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await expect(page.getByRole("heading", { name: "Elige tu barbero" })).toBeVisible();
  await page.getByRole("button", { name: "Bruno" }).click();
  await expect(page.getByRole("heading", { name: "Elige día y hora" })).toBeVisible();
  // El segundo día nunca tiene horarios ya pasados, así que el test no depende de la hora.
  await page.getByRole("group", { name: "Fecha" }).getByRole("button").nth(1).click();
  await page.getByRole("region", { name: "Tarde" }).getByRole("button", { name: "13:00" }).click();
  await expect(page.getByRole("heading", { name: "Déjanos tus datos" })).toBeVisible();
}

test("camino feliz: el cliente reserva de punta a punta", async ({ page }) => {
  await reachDetails(page);
  await page.getByRole("textbox", { name: "Nombre" }).fill("Ana Prueba");
  await page.getByRole("textbox", { name: "Celular" }).fill("0987654321");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Revisa tu cita" })).toBeVisible();
  await expect(page.getByText("Total · pagas en el local")).toBeVisible();
  await page.getByRole("button", { name: /Confirmar reserva/ }).click();

  await expect(page.getByRole("heading", { name: /Listo, te esperamos/ })).toBeVisible();
  await expect(page.getByText(/^[0-9A-F]{6}$/)).toBeVisible();

  const state = await stubState();
  const client = state.clients.find((c) => c.phone === "0987654321");
  expect(client?.name).toBe("Ana Prueba");
  const booked = state.appointments.filter((a) => a.client_id === client?.id);
  expect(booked).toHaveLength(1);
  expect(booked[0]?.status).toBe("pending");
  expect(booked[0]?.start_time).toBe("13:00:00");
});

test("validación de datos: nombre corto y celular inválido no avanzan", async ({ page }) => {
  await reachDetails(page);
  await page.getByRole("textbox", { name: "Nombre" }).fill("A");
  await page.getByRole("textbox", { name: "Celular" }).fill("123");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Escribe tu nombre para saber a quién esperamos.")).toBeVisible();
  await expect(page.getByText(/Tu celular va con 10 dígitos/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Déjanos tus datos" })).toBeVisible();
});

test("navegación hacia atrás entre pasos", async ({ page }) => {
  await page.goto("/reservar");
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await expect(page.getByRole("heading", { name: "Elige tu barbero" })).toBeVisible();

  await page.getByRole("button", { name: "Atrás: Servicio" }).click();
  await expect(page.getByRole("heading", { name: "Elige tu servicio" })).toBeVisible();

  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await page.getByRole("button", { name: "Bruno" }).click();
  await expect(page.getByRole("heading", { name: "Elige día y hora" })).toBeVisible();

  await page.getByRole("button", { name: "Atrás: Barbero" }).click();
  await expect(page.getByRole("heading", { name: "Elige tu barbero" })).toBeVisible();
});

test("login con credenciales inválidas muestra el error y se queda en /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("nadie@example.com");
  await page.getByLabel("Contraseña").fill("clave-equivocada");
  await page.getByRole("button", { name: /ingresar/i }).click();

  await expect(page.getByText("Credenciales incorrectas")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("la home lista los servicios con su precio", async ({ page }) => {
  await page.goto("/");
  const services = page.locator("#servicios");
  await expect(services.getByText("Corte clásico")).toBeVisible();
  await expect(services.getByText("$7")).toBeVisible();
  await expect(page.getByRole("link", { name: "Reservar cita" }).first()).toBeVisible();
});
