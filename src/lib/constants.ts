export const BUSINESS_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const SLOT_INTERVAL_MINUTES = 30;

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
