import { expect, test, type Browser, type Page } from "@playwright/test";
import { reachDetails, setProgram } from "../fixtures/flows";
import { failRpc, LOYAL_PHONE, NEW_PHONE, seed, stubState, type Seed } from "../fixtures/stub";

// Lo que ve el cliente. Cada prueba siembra su estado y enciende o apaga el programa por
// el panel del admin, que es lo que invalida la caché pública de 45 s.

async function start(browser: Browser, state: Seed, on = true) {
  await seed(state);
  await setProgram(browser, on);
}

const stamps = (page: Page) => page.getByRole("progressbar", { name: /Tarjeta de sellos/ });

async function typePhone(page: Page, phone: string) {
  await page.getByRole("textbox", { name: "Nombre" }).fill("Luis Fiel");
  await page.getByRole("textbox", { name: "Celular" }).fill(phone);
}

test("apagado: ni una palabra del programa en el wizard ni en la home", async ({ page, browser }) => {
  await start(browser, "loyalty-4", false);
  await reachDetails(page);
  await typePhone(page, LOYAL_PHONE);
  await page.waitForTimeout(1200);
  await expect(stamps(page)).toHaveCount(0);
  await expect(page.getByText(/sello/i)).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByText(/va por la casa/)).toHaveCount(0);
  await expect(page.getByText(/clientes atendidos/)).toBeVisible();
});

test("cliente nuevo: su primer sello", async ({ page, browser }) => {
  await start(browser, "loyalty-new");
  await reachDetails(page);
  await typePhone(page, NEW_PHONE);
  await expect(stamps(page)).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByText("Este corte suma tu primer sello.")).toBeVisible();
  await expect(page.getByText("El 6to va por la casa.")).toBeVisible();
});

test("cliente con 4 sellos: progreso y confirmación", async ({ page, browser }) => {
  await start(browser, "loyalty-4");
  await reachDetails(page);
  await typePhone(page, LOYAL_PHONE);
  await expect(stamps(page)).toHaveAttribute("aria-valuenow", "4");
  await expect(page.getByText("Llevas 4 de 5 sellos.")).toBeVisible();
  await expect(page.getByText("Te falta 1 para el corte gratis.")).toBeVisible();

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Corte gratis/)).toHaveCount(0);
  await page.getByRole("button", { name: /Confirmar reserva/ }).click();
  await expect(page.getByRole("heading", { name: /Listo, te esperamos/ })).toBeVisible();
  await expect(page.getByText("Con este corte completas tu tarjeta.")).toBeVisible();
});

test("cliente elegible: el resumen lo dice y el total sigue siendo el precio real", async ({ page, browser }) => {
  await start(browser, "loyalty-eligible");
  await reachDetails(page);
  await typePhone(page, LOYAL_PHONE);
  await expect(stamps(page)).toHaveAttribute("aria-valuenow", "5");
  await expect(page.getByText("Este corte va por la casa.")).toBeVisible();

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/por tus 5 visitas · se aplica al pagar en el local/)).toBeVisible();
  await expect(page.getByText("$7")).toBeVisible();
  await expect(page.getByText("$0")).toHaveCount(0);

  await page.getByRole("button", { name: /Confirmar reserva/ }).click();
  await expect(page.getByText("Este corte va por la casa.")).toBeVisible();
});

test("un celular inválido no muestra tarjeta", async ({ page, browser }) => {
  await start(browser, "loyalty-4");
  await reachDetails(page);
  await typePhone(page, "09911");
  await page.waitForTimeout(1200);
  await expect(stamps(page)).toHaveCount(0);
});

test("si la tarjeta no se puede leer, no se muestra y la reserva se completa igual", async ({ page, browser }) => {
  await start(browser, "loyalty-4");
  await failRpc("public_loyalty_progress");
  await reachDetails(page);
  await typePhone(page, LOYAL_PHONE);
  await page.waitForTimeout(1200);
  await expect(stamps(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Confirmar reserva/ }).click();
  await expect(page.getByRole("heading", { name: /Listo, te esperamos/ })).toBeVisible();
  const { appointments, clients } = await stubState();
  const luis = clients.find((c) => c.phone === LOYAL_PHONE);
  expect(appointments.filter((a) => a.client_id === luis?.id && a.status === "pending")).toHaveLength(1);
});

test("el celular guardado en el teléfono muestra los sellos sin escribir nada", async ({ page, browser }) => {
  await start(browser, "loyalty-4");
  await page.addInitScript((phone) => localStorage.setItem("eb_client_phone", phone), LOYAL_PHONE);
  await reachDetails(page);
  await expect(page.getByText("Llevas 4 de 5 sellos.")).toBeVisible();
});

test("la home anuncia el programa encendido", async ({ page, browser }) => {
  await start(browser, "loyalty-new");
  await page.goto("/");
  await expect(page.getByText("El 6to corte va por la casa")).toBeVisible();
  await expect(page.getByText(/clientes atendidos/)).toHaveCount(0);
});
