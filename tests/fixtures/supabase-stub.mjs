// Supabase suplente para las pruebas: imita el subconjunto de PostgREST y de Auth que usa
// la app, más las RPC con la MISMA lógica que las funciones SQL de producción.
//
// Por qué existe: la suite no debe tocar la base real. Con esto corre hermética,
// determinista y en CI sin credenciales. Lo que el suplente NO puede probar (que la
// aritmética SQL y los permisos sean correctos) lo cubre supabase/checks/smoke_loyalty.sql.
//
// Control desde las pruebas:
//   POST /__seed/<estado>   reinicia los datos (base | loyalty-new | loyalty-4 | loyalty-eligible | loyalty-eligible-two | loyalty-redeemed)
//   POST /__fail/<rpc>      hace fallar esa RPC hasta el próximo seed
//   POST /__loyalty/off     apaga el programa sin tocar nada más (canje que ya no corresponde)
//   GET  /__state           devuelve las tablas (para aserciones)
//   GET  /__hits            cuántas peticiones recibió (guarda anti-producción)

import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.STUB_PORT ?? 54399);

export const BUSINESS_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ADMIN_USER = "00000000-0000-4000-8000-00000000a001";
const BARBER_USER = "00000000-0000-4000-8000-00000000b001";
const ADMIN_BARBER = "10000000-0000-4000-8000-000000000001";
const BARBER_ID = "10000000-0000-4000-8000-000000000002";
const SVC_CORTE = "20000000-0000-4000-8000-000000000001";
const SVC_BARBA = "20000000-0000-4000-8000-000000000002";
const SVC_CEJAS = "20000000-0000-4000-8000-000000000003";

const USERS = [
  { id: ADMIN_USER, email: "admin@monky.test", password: "monky-test-1" },
  { id: BARBER_USER, email: "barbero@monky.test", password: "monky-test-1" },
];

export const LOYAL_PHONE = "0991111111";
export const NEW_PHONE = "0992222222";

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const SHOP_TZ = "America/Guayaquil";

function shopToday(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  return parts; // YYYY-MM-DD
}

function shopNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour").value);
  const m = Number(parts.find((p) => p.type === "minute").value);
  return h * 60 + m;
}

function baseData() {
  return {
    businesses: [{
      id: BUSINESS_ID, name: "MONKY BARBER", slug: "monky", phone: "0990000000",
      address: "Av. Principal y 10 de Agosto, Milagro", logo_url: null,
      created_at: "2026-01-01T00:00:00Z", loyalty_enabled: false, loyalty_cycle: 6,
    }],
    business_hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      id: randomUUID(), business_id: BUSINESS_ID, day_of_week: d,
      is_open: true, open_time: "09:00:00", close_time: "19:00:00",
    })),
    services: [
      { id: SVC_CORTE, business_id: BUSINESS_ID, name: "Corte clásico", description: "Tijera y máquina, lavado incluido.", duration_minutes: 45, price: 7, icon: "scissors", image_url: null, is_active: true, sort_order: 1 },
      { id: SVC_BARBA, business_id: BUSINESS_ID, name: "Barba", description: "Perfilado con navaja y toalla caliente.", duration_minutes: 30, price: 5, icon: "razor", image_url: null, is_active: true, sort_order: 2 },
      { id: SVC_CEJAS, business_id: BUSINESS_ID, name: "Cejas", description: "Diseño y limpieza.", duration_minutes: 15, price: 2, icon: "eye", image_url: null, is_active: true, sort_order: 3 },
    ],
    barbers: [
      { id: ADMIN_BARBER, business_id: BUSINESS_ID, user_id: ADMIN_USER, name: "Andrés", photo_url: null, commission_pct: 40, is_active: true, created_at: "2026-01-01T00:00:00Z", role: "admin", pin: "0000" },
      { id: BARBER_ID, business_id: BUSINESS_ID, user_id: BARBER_USER, name: "Bruno", photo_url: null, commission_pct: 40, is_active: true, created_at: "2026-01-02T00:00:00Z", role: "barber", pin: "1111" },
    ],
    clients: [],
    appointments: [],
    payments: [],
    barber_schedules: [],
  };
}

function addClient(db, name, phone) {
  const c = { id: randomUUID(), business_id: BUSINESS_ID, name, phone, email: null, notes: null, visit_count: 0, last_visit: null, created_at: new Date().toISOString() };
  db.clients.push(c);
  return c;
}

function addAppointment(db, { client, barber = BARBER_ID, service = SVC_CORTE, date, time, status, isReward = false }) {
  const svc = db.services.find((s) => s.id === service);
  const a = {
    id: randomUUID(), business_id: BUSINESS_ID, barber_id: barber, service_id: service,
    client_id: client.id, date, start_time: `${time}:00`, end_time: `${addMinutes(time, svc.duration_minutes)}:00`,
    status, source: "online", notes: null, is_reward: isReward, created_at: new Date().toISOString(),
  };
  db.appointments.push(a);
  return a;
}

function addPastVisits(db, client, count, startDay = 30) {
  for (let i = 0; i < count; i++) {
    const a = addAppointment(db, { client, date: shopToday(-(startDay + i)), time: "10:00", status: "completed" });
    db.payments.push({ id: randomUUID(), appointment_id: a.id, barber_id: BARBER_ID, amount: 7, payment_method: "cash", commission_amount: 2.8, created_at: `${a.date}T15:00:00Z` });
  }
}

const SEEDS = {
  base(db) {
    // Un turno pendiente hoy con el barbero, para la agenda y el cobro normal.
    const c = addClient(db, "Carlos Pérez", "0993333333");
    addAppointment(db, { client: c, date: shopToday(), time: "17:00", status: "pending" });
  },
  "loyalty-new"(db) {
    SEEDS.base(db);
    db.businesses[0].loyalty_enabled = true;
  },
  "loyalty-4"(db) {
    SEEDS.base(db);
    db.businesses[0].loyalty_enabled = true;
    const c = addClient(db, "Luis Fiel", LOYAL_PHONE);
    addPastVisits(db, c, 4);
  },
  "loyalty-eligible"(db) {
    SEEDS.base(db);
    db.businesses[0].loyalty_enabled = true;
    const c = addClient(db, "Luis Fiel", LOYAL_PHONE);
    addPastVisits(db, c, 5);
    addAppointment(db, { client: c, date: shopToday(), time: "18:00", status: "pending" });
  },
  "loyalty-eligible-two"(db) {
    SEEDS["loyalty-eligible"](db);
    const c = db.clients.find((x) => x.phone === LOYAL_PHONE);
    addAppointment(db, { client: c, date: shopToday(), time: "09:00", status: "pending" });
  },
  "loyalty-redeemed"(db) {
    SEEDS.base(db);
    db.businesses[0].loyalty_enabled = true;
    const c = addClient(db, "Luis Fiel", LOYAL_PHONE);
    addPastVisits(db, c, 5);
    const a = addAppointment(db, { client: c, date: shopToday(-1), time: "11:00", status: "completed", isReward: true });
    db.payments.push({ id: randomUUID(), appointment_id: a.id, barber_id: BARBER_ID, amount: 0, payment_method: "reward", commission_amount: 2.8, created_at: `${a.date}T16:00:00Z` });
  },
};

let db;
let failing = new Set();
let hits = 0;
const sessions = new Map(); // access_token → user

function seed(name) {
  const fn = SEEDS[name];
  if (!fn) throw new Error(`seed desconocido: ${name}`);
  db = baseData();
  fn(db);
  failing = new Set();
  refreshVisitStats();
}
seed("base");

// Espejo de refresh_client_visit_stats().
function refreshVisitStats() {
  for (const c of db.clients) {
    const done = db.appointments.filter((a) => a.client_id === c.id && a.status === "completed");
    c.visit_count = done.length;
    c.last_visit = done.length ? done.map((a) => `${a.date}T${a.start_time}-05:00`).sort().at(-1) : null;
  }
}

// ---------------------------------------------------------------------------
// Utilidades de tiempo
// ---------------------------------------------------------------------------

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(m) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function addMinutes(t, mins) {
  return fromMin(toMin(t) + mins);
}
function dow(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

// ---------------------------------------------------------------------------
// RPC: misma lógica que las funciones SQL
// ---------------------------------------------------------------------------

class PgError extends Error {
  constructor(message, code = "P0001", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function barberForUser(user) {
  return user ? db.barbers.find((b) => b.user_id === user.id) : undefined;
}

function loyaltyProgress(clientId) {
  const c = db.clients.find((x) => x.id === clientId);
  if (!c) return null;
  const b = db.businesses.find((x) => x.id === c.business_id);
  const mine = db.appointments.filter((a) => a.client_id === c.id && a.status === "completed");
  const paid = mine.filter((a) => !a.is_reward).length;
  const redeemed = mine.filter((a) => a.is_reward).length;
  const progress = Math.max(paid - redeemed * (b.loyalty_cycle - 1), 0);
  return {
    cycle: b.loyalty_cycle,
    progress: b.loyalty_enabled ? progress : 0,
    eligible: b.loyalty_enabled && progress >= b.loyalty_cycle - 1,
  };
}

function availableSlots(barberId, date, duration) {
  if (!barberId || !date || !duration || duration <= 0 || duration > 600) return [];
  const barber = db.barbers.find((b) => b.id === barberId && b.is_active);
  if (!barber) return [];
  const h = db.business_hours.find((x) => x.business_id === barber.business_id && x.day_of_week === dow(date));
  if (!h || !h.is_open) return [];
  const open = toMin(h.open_time);
  const close = toMin(h.close_time);
  const out = [];
  for (let m = open; m + duration <= close; m += 30) {
    const s = m;
    const e = m + duration;
    const busy = db.appointments.some((a) => a.barber_id === barberId && a.date === date
      && !["cancelled", "no_show"].includes(a.status) && toMin(a.start_time) < e && toMin(a.end_time) > s);
    const blocked = db.barber_schedules.some((b) => b.barber_id === barberId && b.date === date
      && b.type === "block" && toMin(b.start_time) < e && toMin(b.end_time) > s);
    if (!busy && !blocked) out.push(fromMin(s));
  }
  return out;
}

const RPC = {
  public_bookable_barbers({ p_business_id }) {
    return db.barbers
      .filter((b) => b.business_id === p_business_id && b.is_active && b.user_id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, name, photo_url }) => ({ id, name, photo_url }));
  },

  public_available_slots({ p_barber_id, p_date, p_duration_minutes }) {
    return availableSlots(p_barber_id, p_date, p_duration_minutes);
  },

  create_public_appointment({ p_service_id, p_barber_id, p_date, p_start_time, p_client_name, p_client_phone }) {
    const name = String(p_client_name ?? "").trim();
    const phone = String(p_client_phone ?? "").trim();
    if (!/^\d{2}:\d{2}$/.test(p_start_time ?? "")) throw new PgError("BOOKING_INVALID_INPUT", "22023");
    if (name.length < 2 || name.length > 100) throw new PgError("BOOKING_INVALID_INPUT", "22023");
    if (!/^0\d{9}$/.test(phone)) throw new PgError("BOOKING_INVALID_INPUT", "22023");
    const barber = db.barbers.find((b) => b.id === p_barber_id && b.is_active);
    if (!barber) throw new PgError("BOOKING_BARBER_NOT_FOUND", "P0002");
    if (!barber.user_id) throw new PgError("BOOKING_BARBER_NOT_BOOKABLE", "P0002");
    const svc = db.services.find((s) => s.id === p_service_id && s.is_active && s.business_id === barber.business_id);
    if (!svc) throw new PgError("BOOKING_SERVICE_NOT_FOUND", "P0002");
    const today = shopToday();
    if (p_date < today) throw new PgError("BOOKING_PAST_DATE", "22023");
    if (p_date === today && toMin(p_start_time) < shopNowMinutes() + 15) throw new PgError("BOOKING_TOO_SOON", "22023");
    if (!availableSlots(p_barber_id, p_date, svc.duration_minutes).includes(p_start_time)) {
      throw new PgError("BOOKING_SLOT_TAKEN", "23505", 409);
    }
    let client = db.clients.find((c) => c.business_id === barber.business_id && c.phone === phone);
    if (!client) client = addClient(db, name, phone);
    else client.name = name;
    const a = addAppointment(db, { client, barber: p_barber_id, service: p_service_id, date: p_date, time: p_start_time, status: "pending" });
    return a.id;
  },

  complete_appointment({ p_appointment_id, p_payment_method, p_amount }, user) {
    const barber = barberForUser(user);
    if (!barber) throw new PgError("COMPLETE_NOT_STAFF", "42501", 403);
    if (!["cash", "transfer"].includes(p_payment_method)) throw new PgError("COMPLETE_INVALID_INPUT", "22023");
    const a = db.appointments.find((x) => x.id === p_appointment_id && x.barber_id === barber.id);
    if (!a) throw new PgError("COMPLETE_NOT_FOUND", "P0002");
    const svc = db.services.find((s) => s.id === a.service_id);
    const existing = db.payments.find((p) => p.appointment_id === a.id);
    if (existing) {
      if (!["pending", "completed"].includes(a.status)) throw new PgError("COMPLETE_NOT_PENDING", "22023");
      a.status = "completed";
      refreshVisitStats();
      return existing.id;
    }
    if (a.status !== "pending") throw new PgError("COMPLETE_NOT_PENDING", "22023");
    const amount = Math.round(Number(p_amount ?? 0) * 100) / 100;
    if (amount <= 0 || amount > svc.price * 10) throw new PgError("COMPLETE_INVALID_INPUT", "22023");
    a.status = "completed";
    const p = { id: randomUUID(), appointment_id: a.id, barber_id: barber.id, amount, payment_method: p_payment_method, commission_amount: Math.round(amount * barber.commission_pct) / 100, created_at: new Date().toISOString() };
    db.payments.push(p);
    refreshVisitStats();
    return p.id;
  },

  complete_appointment_reward({ p_appointment_id }, user) {
    const barber = barberForUser(user);
    if (!barber) throw new PgError("COMPLETE_NOT_STAFF", "42501", 403);
    const a = db.appointments.find((x) => x.id === p_appointment_id && x.barber_id === barber.id);
    if (!a) throw new PgError("COMPLETE_NOT_FOUND", "P0002");
    const svc = db.services.find((s) => s.id === a.service_id);
    const existing = db.payments.find((p) => p.appointment_id === a.id);
    if (existing) {
      if (existing.payment_method !== "reward") throw new PgError("COMPLETE_NOT_PENDING", "22023");
      if (!["pending", "completed"].includes(a.status)) throw new PgError("COMPLETE_NOT_PENDING", "22023");
      a.status = "completed";
      a.is_reward = true;
      refreshVisitStats();
      return existing.id;
    }
    if (a.status !== "pending") throw new PgError("COMPLETE_NOT_PENDING", "22023");
    if (!loyaltyProgress(a.client_id)?.eligible) throw new PgError("COMPLETE_REWARD_NOT_ELIGIBLE", "22023");
    a.status = "completed";
    a.is_reward = true;
    const p = { id: randomUUID(), appointment_id: a.id, barber_id: barber.id, amount: 0, payment_method: "reward", commission_amount: Math.round(svc.price * barber.commission_pct) / 100, created_at: new Date().toISOString() };
    db.payments.push(p);
    refreshVisitStats();
    return p.id;
  },

  public_loyalty_progress({ p_business_id, p_phone }) {
    const b = db.businesses.find((x) => x.id === p_business_id);
    if (!b) throw new PgError("LOYALTY_BUSINESS_NOT_FOUND", "P0002");
    if (!b.loyalty_enabled) return [{ cycle: b.loyalty_cycle, progress: 0, eligible: false }];
    const c = db.clients.find((x) => x.business_id === b.id && x.phone === String(p_phone ?? "").trim());
    if (!c) return [{ cycle: b.loyalty_cycle, progress: 0, eligible: false }];
    return [loyaltyProgress(c.id)];
  },

  staff_client_loyalty({ p_client_ids }, user) {
    const barber = barberForUser(user);
    if (!barber) return [];
    return db.clients
      .filter((c) => (p_client_ids ?? []).includes(c.id) && c.business_id === barber.business_id)
      .map((c) => ({ client_id: c.id, ...loyaltyProgress(c.id) }));
  },

  admin_list_barbers(_args, user) {
    const barber = barberForUser(user);
    if (!barber || barber.role !== "admin") throw new PgError("BARBER_LIST_NOT_ADMIN", "42501", 403);
    return db.barbers.filter((b) => b.business_id === barber.business_id).sort((a, b) => a.name.localeCompare(b.name));
  },

  is_admin(_args, user) {
    return barberForUser(user)?.role === "admin";
  },
};

// ---------------------------------------------------------------------------
// Mini PostgREST
// ---------------------------------------------------------------------------

function tableRows(name) {
  if (name === "barber_commissions") {
    const groups = new Map();
    for (const p of db.payments) {
      const b = db.barbers.find((x) => x.id === p.barber_id);
      const fecha = p.created_at.slice(0, 10);
      const key = `${b.id}|${fecha}`;
      const g = groups.get(key) ?? { barber_id: b.id, name: b.name, fecha, total_servicios: 0, ingreso_total: 0, comision_total: 0, business_id: b.business_id };
      g.total_servicios += 1;
      g.ingreso_total += Number(p.amount);
      g.comision_total += Number(p.commission_amount);
      groups.set(key, g);
    }
    return [...groups.values()];
  }
  const rows = db[name];
  if (!rows) throw new PgError(`relation "public.${name}" does not exist`, "42P01", 404);
  return rows;
}

const RELATIONS = {
  appointments: { services: ["service_id", "services"], clients: ["client_id", "clients"] },
};

function splitTop(s, sep = ",") {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function project(table, row, select) {
  if (!select || select === "*") return { ...row };
  const out = {};
  for (const part of splitTop(select)) {
    const m = part.match(/^(\w+)\((.*)\)$/s);
    if (m) {
      const rel = RELATIONS[table]?.[m[1]];
      if (!rel) continue;
      const target = db[rel[1]].find((r) => r.id === row[rel[0]]);
      out[m[1]] = target ? project(rel[1], target, m[2]) : null;
    } else if (part === "*") {
      Object.assign(out, row);
    } else {
      out[part] = row[part];
    }
  }
  return out;
}

function parseValue(v) {
  if (v === "null") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

function cmp(a, b) {
  if (typeof a === "number" || typeof b === "number") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function likeToRegex(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (ch === "%" || ch === "*") re += ".*";
    else if (ch === "_") re += ".";
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

function testOp(value, op, raw) {
  switch (op) {
    case "eq": return String(value) === String(parseValue(raw)) || value === parseValue(raw);
    case "neq": return String(value) !== String(parseValue(raw));
    case "gt": return value !== null && cmp(value, raw) > 0;
    case "gte": return value !== null && cmp(value, raw) >= 0;
    case "lt": return value !== null && cmp(value, raw) < 0;
    case "lte": return value !== null && cmp(value, raw) <= 0;
    case "ilike":
    case "like": return value !== null && likeToRegex(decodeURIComponent(raw)).test(String(value));
    case "is": return value === parseValue(raw);
    case "in": {
      const list = raw.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
      return list.includes(String(value));
    }
    default: throw new PgError(`operador no soportado por el suplente: ${op}`, "PGRST100");
  }
}

function makeFilter(col, expr) {
  let negate = false;
  let e = expr;
  if (e.startsWith("not.")) {
    negate = true;
    e = e.slice(4);
  }
  const dot = e.indexOf(".");
  const op = e.slice(0, dot);
  const raw = e.slice(dot + 1);
  return (row) => negate !== testOp(row[col], op, raw);
}

function parseOr(expr) {
  const inner = expr.replace(/^\(|\)$/g, "");
  const parts = splitTop(inner);
  const filters = parts.map((p) => {
    const dot = p.indexOf(".");
    return makeFilter(p.slice(0, dot), p.slice(dot + 1));
  });
  return (row) => filters.some((f) => f(row));
}

const RESERVED = new Set(["select", "order", "limit", "offset", "or", "columns", "on_conflict"]);

function query(url) {
  const filters = [];
  for (const [k, v] of url.searchParams) {
    if (k === "or") filters.push(parseOr(v));
    else if (!RESERVED.has(k)) filters.push(makeFilter(k, v));
  }
  return filters;
}

function applyOrder(rows, order) {
  if (!order) return rows;
  const keys = order.split(",").map((o) => {
    const [col, ...mods] = o.split(".");
    return { col, desc: mods.includes("desc"), nullsFirst: mods.includes("nullsfirst") ? true : mods.includes("nullslast") ? false : null };
  });
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const va = a[k.col];
      const vb = b[k.col];
      if (va === vb) continue;
      if (va === null || va === undefined) return (k.nullsFirst ?? k.desc) ? -1 : 1;
      if (vb === null || vb === undefined) return (k.nullsFirst ?? k.desc) ? 1 : -1;
      const c = cmp(va, vb);
      if (c !== 0) return k.desc ? -c : c;
    }
    return 0;
  });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

function sendError(res, err) {
  const status = err.status ?? 400;
  send(res, status, { code: err.code ?? "P0001", message: err.message, details: null, hint: null });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function userFromReq(req) {
  const auth = req.headers.authorization ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  return sessions.get(token) ?? null;
}

function publicUser(u) {
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
}

function newSession(u) {
  const access = `stub-${randomUUID()}`;
  sessions.set(access, u);
  const now = Math.floor(Date.now() / 1000);
  return { access_token: access, token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: `refresh-${access}`, user: publicUser(u) };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  // --- control ---
  if (path.startsWith("/__seed/")) {
    try {
      seed(path.slice("/__seed/".length));
      return send(res, 200, { ok: true });
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }
  if (path.startsWith("/__fail/")) {
    failing.add(path.slice("/__fail/".length));
    return send(res, 200, { ok: true });
  }
  if (path === "/__loyalty/off") {
    db.businesses[0].loyalty_enabled = false;
    return send(res, 200, { ok: true });
  }
  if (path === "/__state") return send(res, 200, db);
  if (path === "/__hits") return send(res, 200, { hits });

  hits++;

  // --- auth ---
  if (path === "/auth/v1/token") {
    const body = await readBody(req);
    if (url.searchParams.get("grant_type") === "password") {
      const u = USERS.find((x) => x.email === body.email && x.password === body.password);
      if (!u) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return send(res, 200, newSession(u));
    }
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const access = String(body.refresh_token ?? "").replace(/^refresh-/, "");
      const u = sessions.get(access);
      if (!u) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      return send(res, 200, newSession(u));
    }
  }
  if (path === "/auth/v1/user") {
    const u = userFromReq(req);
    if (!u) return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    return send(res, 200, publicUser(u));
  }
  if (path === "/auth/v1/logout") {
    sessions.delete((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
    return send(res, 204);
  }

  // --- rpc ---
  if (path.startsWith("/rest/v1/rpc/")) {
    const fn = path.slice("/rest/v1/rpc/".length);
    const body = await readBody(req);
    try {
      if (failing.has(fn)) throw new PgError("STUB_FORCED_FAILURE", "XX000", 500);
      const impl = RPC[fn];
      if (!impl) throw new PgError(`function public.${fn} does not exist`, "PGRST202", 404);
      return send(res, 200, impl(body, userFromReq(req)));
    } catch (e) {
      return sendError(res, e);
    }
  }

  // --- tablas ---
  if (path.startsWith("/rest/v1/")) {
    const table = path.slice("/rest/v1/".length);
    const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    const prefer = req.headers.prefer ?? "";
    try {
      if (failing.has(table)) throw new PgError("STUB_FORCED_FAILURE", "XX000", 500);
      const rows = tableRows(table);
      const filters = query(url);
      const match = (r) => filters.every((f) => f(r));
      const select = url.searchParams.get("select") ?? "*";

      if (req.method === "GET" || req.method === "HEAD") {
        let out = applyOrder(rows.filter(match), url.searchParams.get("order"));
        const total = out.length;
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
        out = out.slice(offset, limit === undefined ? undefined : offset + limit);
        const headers = prefer.includes("count=exact") ? { "content-range": `${offset}-${offset + out.length - 1}/${total}` } : {};
        if (req.method === "HEAD") return send(res, 200, undefined, headers);
        const projected = out.map((r) => project(table, r, select));
        if (wantsObject) {
          if (projected.length !== 1) {
            return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${projected.length} rows`, hint: null });
          }
          return send(res, 200, projected[0], headers);
        }
        return send(res, 200, projected, headers);
      }

      if (req.method === "PATCH") {
        const patch = await readBody(req);
        const touched = rows.filter(match);
        for (const r of touched) Object.assign(r, patch);
        if (table === "appointments") refreshVisitStats();
        const projected = touched.map((r) => project(table, r, select));
        if (!prefer.includes("return=representation")) return send(res, 204);
        if (wantsObject) {
          if (projected.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
          return send(res, 200, projected[0]);
        }
        return send(res, 200, projected);
      }

      if (req.method === "POST") {
        const body = await readBody(req);
        const list = (Array.isArray(body) ? body : [body]).map((r) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...r }));
        rows.push(...list);
        const projected = list.map((r) => project(table, r, select));
        if (!prefer.includes("return=representation")) return send(res, 201);
        return send(res, 201, wantsObject ? projected[0] : projected);
      }

      if (req.method === "DELETE") {
        const gone = rows.filter(match);
        db[table] = rows.filter((r) => !match(r));
        if (table === "appointments") refreshVisitStats();
        const projected = gone.map((r) => project(table, r, select));
        if (!prefer.includes("return=representation")) return send(res, 204);
        return send(res, 200, wantsObject ? projected[0] ?? null : projected);
      }
    } catch (e) {
      return sendError(res, e);
    }
  }

  // Realtime, storage y todo lo demás: no existe en el suplente. La app lo tolera.
  return send(res, 404, { message: "no implementado en el suplente" });
}

http
  .createServer((req, res) => {
    handle(req, res).catch((e) => sendError(res, e));
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`supabase-stub escuchando en http://127.0.0.1:${PORT}`);
  });
