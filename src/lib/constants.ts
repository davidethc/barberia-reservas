export const BUSINESS_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/** Mirrored by `public_available_slots()` in Postgres — change both together. */
export const SLOT_INTERVAL_MINUTES = 30;

/**
 * The shop's lunch break. No turn may cross it, so mornings end at 12:00 and the
 * afternoon opens at 13:00. Mirrored by the wizard's Mañana/Tarde split.
 */
export const LUNCH_START = "12:00";
export const LUNCH_END = "13:00";

/** Range a "día libre" block covers, wide enough to swallow any business hours. */
export const FULL_DAY_START = "00:00";
export const FULL_DAY_END = "23:59";

export const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;
