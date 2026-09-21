export const BRAND_NAME = "MONKY BARBER";

export const IMAGES = {
  hero: {
    src: "/images/hero-barbero.png",
    width: 768,
    height: 916,
    alt: "Ilustración de un barbero con barba y tupé frente a un sol mostaza",
  },
} as const;

// MOCKUP: no real rating or client count exists yet; replace with real figures.
export const SOCIAL_PROOF = {
  rating: 4.9,
  clients: "+1.200",
} as const;

// MOCKUP: social handles are not known yet. A null url renders as "pendiente", never a dead link.
export const SOCIAL_LINKS: { network: "instagram" | "facebook" | "tiktok"; label: string; url: string | null }[] = [
  { network: "instagram", label: "Instagram", url: null },
  { network: "facebook", label: "Facebook", url: null },
  { network: "tiktok", label: "TikTok", url: null },
];

// MOCKUP: policy pages do not exist yet.
export const POLICY_LINKS: { label: string; url: string | null }[] = [
  { label: "Política de privacidad", url: null },
  { label: "Cancelaciones", url: null },
];

type HourRow = { day_of_week: number; is_open: boolean | null; open_time: string; close_time: string };

const SHORT_DAYS: readonly string[] = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const day = (d: number) => SHORT_DAYS[d] ?? "";

function hhmm(time: string) {
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}

/** Collapses the week into runs with the same hours, Monday first: "Lun – Sáb · 9:00 – 19:00". */
export function groupHours(rows: HourRow[]): { days: string; hours: string }[] {
  const byDay = new Map(rows.map((r) => [r.day_of_week, r]));
  const week = [1, 2, 3, 4, 5, 6, 0].filter((d) => byDay.has(d));
  const label = (r: HourRow) => (r.is_open ? `${hhmm(r.open_time)} – ${hhmm(r.close_time)}` : "Cerrado");

  const groups: { from: number; to: number; hours: string }[] = [];
  for (const d of week) {
    const hours = label(byDay.get(d)!);
    const last = groups.at(-1);
    if (last && last.hours === hours) last.to = d;
    else groups.push({ from: d, to: d, hours });
  }

  return groups.map((g) => ({
    days: g.from === g.to ? day(g.from) : `${day(g.from)} – ${day(g.to)}`,
    hours: g.hours,
  }));
}

/** Ecuadorian local mobile (0991234567) to the international form wa.me expects (593991234567). */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `593${digits.slice(1)}` : digits;
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
