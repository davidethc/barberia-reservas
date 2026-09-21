export { cn } from "cn";
import { BRAND_NAME, toWhatsAppNumber } from "@/lib/brand";

export function formatPrice(price: number): string {
  return `$${price.toFixed(0)}`;
}

/** Mountos con centavos y coma decimal, estilo Ecuador (es-EC): "$2,40". */
export function formatMoney(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const rh = Math.floor(total / 60);
  const rm = total % 60;
  return `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}

export function buildWhatsAppLink(data: {
  businessPhone: string;
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  notes?: string;
}): string {
  const note = data.notes ? `\n📝 ${data.notes}` : "";
  const msg = `Hola, reservé una cita:\n📋 ${data.serviceName}\n💈 ${data.barberName}\n📅 ${formatDate(data.date)}\n🕐 ${formatTime(data.time)}${note}\n\n${BRAND_NAME}`;
  return `https://wa.me/${toWhatsAppNumber(data.businessPhone)}?text=${encodeURIComponent(msg)}`;
}
