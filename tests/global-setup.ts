import { STUB_ADDRESS, STUB_URL } from "./fixtures/stub";

const APP_URL = "http://127.0.0.1:3100";

/**
 * The one thing this suite must never do is write to the real Supabase. The stub's
 * address is a string no real shop has; if the home page does not show it, the app is
 * talking to something else and the run stops here, before any test touches anything.
 */
export default async function globalSetup() {
  const seeded = await fetch(`${STUB_URL}/__seed/base`, { method: "POST" });
  if (!seeded.ok) throw new Error("El Supabase suplente no responde en " + STUB_URL);

  const html = await (await fetch(`${APP_URL}/`)).text();
  if (!html.includes(STUB_ADDRESS)) {
    throw new Error(
      "ABORTADO: la app de pruebas no está usando el Supabase suplente. " +
        "Nunca se corre esta suite contra la base real."
    );
  }
}
