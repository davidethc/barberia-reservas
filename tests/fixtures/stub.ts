import type { Page } from "@playwright/test";

/** Mirrors the constants in supabase-stub.mjs. */
export const STUB_URL = "http://127.0.0.1:54399";
export const STUB_ADDRESS = "Av. Principal y 10 de Agosto, Milagro";

export const LOYAL_PHONE = "0991111111";
export const NEW_PHONE = "0992222222";

export const STAFF = {
  admin: { email: "admin@monky.test", password: "monky-test-1" },
  barber: { email: "barbero@monky.test", password: "monky-test-1" },
} as const;

export type Seed = "base" | "loyalty-new" | "loyalty-4" | "loyalty-eligible" | "loyalty-redeemed";

export async function seed(name: Seed) {
  const res = await fetch(`${STUB_URL}/__seed/${name}`, { method: "POST" });
  if (!res.ok) throw new Error(`No se pudo sembrar ${name}`);
}

/** Makes one RPC or table fail until the next seed. */
export async function failRpc(name: string) {
  await fetch(`${STUB_URL}/__fail/${name}`, { method: "POST" });
}

type StubState = {
  appointments: { id: string; client_id: string; status: string; is_reward: boolean; date: string; start_time: string }[];
  payments: { appointment_id: string; amount: number; payment_method: string; commission_amount: number }[];
  clients: { id: string; name: string; phone: string }[];
  businesses: { loyalty_enabled: boolean; loyalty_cycle: number }[];
};

export async function stubState(): Promise<StubState> {
  return (await fetch(`${STUB_URL}/__state`)).json();
}

export async function signIn(page: Page, who: keyof typeof STAFF) {
  await page.goto("/login");
  await page.getByLabel(/correo/i).fill(STAFF[who].email);
  await page.getByLabel(/contraseña/i).fill(STAFF[who].password);
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL(/\/(agenda|admin)/);
}
