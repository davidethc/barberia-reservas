/**
 * Local stand-in for the project's Supabase REST API, only for taking screenshots.
 *
 * This session's egress policy denies enpijaaaowqpfqpyajuu.supabase.co, so `next dev`
 * cannot read the real database and every screen renders its empty state. The rows below
 * were read from the real project (services, barbers, business, business_hours,
 * appointments) so the captures show true content; availability mirrors
 * `public_available_slots()` (30-min grid inside business hours, minus booked turns).
 *
 * Nothing in the app is modified: point NEXT_PUBLIC_SUPABASE_URL at this server.
 * Delete this file once the real host is reachable — then no stub is needed.
 *
 *   node 00-supabase-local.mjs            # listens on 54321
 */
import http from "node:http";

const PORT = Number(process.env.PORT ?? 54321);
const BUSINESS_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SLOT_MINUTES = 30;

const CARLOS = "a3af3b5d-ff6b-491d-b77f-1bf393ffdee6";
const LUIS = "789e714c-022d-444d-a407-4df8cf62a6a4";

const services = [
  { id: "c766555f-b154-4a4d-8308-83bf7f135c8a", business_id: BUSINESS_ID, name: "Corte + Barba", description: "Corte completo con arreglo de barba", price: 7.00, duration_minutes: 45, is_active: true, sort_order: 1 },
  { id: "5e7a9f38-f0fe-49ea-9ad8-059a600edd38", business_id: BUSINESS_ID, name: "Corte degradado", description: "Fade / degradado moderno", price: 6.00, duration_minutes: 40, is_active: true, sort_order: 2 },
  { id: "1c724aff-6967-4c62-bffd-ba08bee68205", business_id: BUSINESS_ID, name: "Corte clásico", description: "Corte de cabello tradicional", price: 5.00, duration_minutes: 30, is_active: true, sort_order: 3 },
  { id: "1c1b60a9-82d1-4382-b8fb-357565877d6c", business_id: BUSINESS_ID, name: "Barba", description: "Arreglo y perfilado de barba", price: 3.00, duration_minutes: 20, is_active: true, sort_order: 4 },
  { id: "8a1e1874-e7b8-48ae-93b9-40935c9fab6a", business_id: BUSINESS_ID, name: "Cejas", description: "Perfilado de cejas", price: 2.00, duration_minutes: 10, is_active: true, sort_order: 5 },
];

const barbers = [
  { id: CARLOS, name: "Carlos", photo_url: null },
  { id: LUIS, name: "Luis", photo_url: null },
];

const business = { name: "Exclusive Barber Shop", phone: "0991234567", address: "Milagro, Ecuador" };

const hours = [
  { day_of_week: 0, is_open: false, open_time: "09:00:00", close_time: "19:00:00" },
  { day_of_week: 1, is_open: true, open_time: "09:00:00", close_time: "19:00:00" },
  { day_of_week: 2, is_open: true, open_time: "09:00:00", close_time: "19:00:00" },
  { day_of_week: 3, is_open: true, open_time: "09:00:00", close_time: "19:00:00" },
  { day_of_week: 4, is_open: true, open_time: "09:00:00", close_time: "19:00:00" },
  { day_of_week: 5, is_open: true, open_time: "09:00:00", close_time: "19:00:00" },
  { day_of_week: 6, is_open: true, open_time: "09:00:00", close_time: "14:00:00" },
];

// Turns already on the books, plus anything booked during this run.
const booked = [{ barber_id: CARLOS, date: "2026-09-22", start_time: "09:00", end_time: "09:30" }];

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Mirrors public_available_slots(): the free 30-min starts that fit the service before closing. */
function availableSlots(barberId, date, durationMinutes) {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const day = hours.find((h) => h.day_of_week === dow);
  if (!day?.is_open) return [];

  const open = toMin(day.open_time);
  const close = toMin(day.close_time);
  const taken = booked.filter((a) => a.barber_id === barberId && a.date === date);

  const slots = [];
  for (let start = open; start + durationMinutes <= close; start += SLOT_MINUTES) {
    const end = start + durationMinutes;
    const clashes = taken.some((a) => start < toMin(a.end_time) && end > toMin(a.start_time));
    if (!clashes) slots.push(toHHMM(start));
  }
  return slots;
}

const uuid = () => crypto.randomUUID();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const body = req.method === "POST" ? await new Promise((r) => {
    let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => r(raw ? JSON.parse(raw) : {}));
  }) : {};

  const send = (payload, status = 200, single = false) => {
    res.writeHead(status, {
      "content-type": single ? "application/vnd.pgrst.object+json; charset=utf-8" : "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    });
    res.end(JSON.stringify(payload));
  };
  const wantsSingle = (req.headers.accept ?? "").includes("pgrst.object");

  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }); return res.end(); }

  const p = url.pathname;
  console.log(req.method, p, url.search || "", JSON.stringify(body).slice(0, 120));

  if (p === "/rest/v1/services") return send(services);
  if (p === "/rest/v1/businesses") return send(wantsSingle ? business : [business], 200, wantsSingle);
  if (p === "/rest/v1/business_hours") return send(hours);
  if (p === "/rest/v1/rpc/public_bookable_barbers") return send(barbers);

  if (p === "/rest/v1/rpc/public_available_slots") {
    return send(availableSlots(body.p_barber_id, body.p_date, body.p_duration_minutes));
  }

  if (p === "/rest/v1/rpc/create_public_appointment") {
    const service = services.find((s) => s.id === body.p_service_id);
    const start = body.p_start_time.slice(0, 5);
    booked.push({
      barber_id: body.p_barber_id,
      date: body.p_date,
      start_time: start,
      end_time: toHHMM(toMin(start) + (service?.duration_minutes ?? 30)),
    });
    return send(uuid());
  }

  if (p === "/auth/v1/user") return send({ error: "unauthorized" }, 401);

  send([], 200);
});

server.listen(PORT, () => console.log(`Supabase local (solo capturas) → http://localhost:${PORT}`));
