export function formatPrice(price: number): string {
  return `$${price.toFixed(0)}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

export function getNextDays(count: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split("T")[0]!);
  }
  return days;
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
}): string {
  const msg = `Hola, reservé un turno:\n📋 ${data.serviceName}\n💈 ${data.barberName}\n📅 ${formatDate(data.date)}\n🕐 ${formatTime(data.time)}\n\nExclusive Barber Shop`;
  return `https://wa.me/${data.businessPhone}?text=${encodeURIComponent(msg)}`;
}
