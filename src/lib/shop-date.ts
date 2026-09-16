import { DAY_NAMES } from "@/lib/constants";

/**
 * The shop's own clock. Dates shown to the client are resolved here and not in
 * the runtime's local zone, so a server deployed in UTC does not roll over to
 * "tomorrow" at 19:00 Milagro time and mislabel the date strip.
 */
export const SHOP_TIME_ZONE = "America/Guayaquil";

const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

function shopParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Today (YYYY-MM-DD) on the shop's clock. */
export function shopToday(at: Date = new Date()): string {
  const { year, month, day } = shopParts(at);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Current HH:MM on the shop's clock. */
export function shopNowTime(at: Date = new Date()): string {
  const { hour, minute } = shopParts(at);
  return `${hour}:${minute}`;
}

/** `count` consecutive days starting today, on the shop's clock. */
export function getShopDates(count: number, at: Date = new Date()): string[] {
  const { year, month, day } = shopParts(at);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    // Anchored at UTC noon so the arithmetic never crosses a day boundary.
    const d = new Date(Date.UTC(year, month - 1, day + i, 12));
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** 0 = Sunday, matching `business_hours.day_of_week`. */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

export function formatWeekdayShort(dateStr: string): string {
  return WEEKDAYS_SHORT[getDayOfWeek(dateStr)]!;
}

export function formatDayNumber(dateStr: string): string {
  return String(Number(dateStr.slice(8, 10)));
}

/** "Sábado 20 de septiembre" — for the confirmation, where space allows it. */
export function formatLongDate(dateStr: string): string {
  const day = Number(dateStr.slice(8, 10));
  const month = Number(dateStr.slice(5, 7));
  return `${DAY_NAMES[getDayOfWeek(dateStr)]} ${day} de ${MONTHS_LONG[month - 1]}`;
}
