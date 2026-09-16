import { addMinutesToTime } from "@/lib/utils";
import type { ConfirmedBooking } from "./types";

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 caps a content line at 75 octets; continuations start with a space. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    chunks.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest.length) chunks.push(" " + rest);
  return chunks.join("\r\n");
}

function stamp(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

export function buildCalendarEvent(
  booking: ConfirmedBooking,
  business: { name: string; address: string | null }
): string {
  const end = addMinutesToTime(booking.time, booking.durationMinutes);
  const shopName = business.name || "Exclusive Barber Shop";
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Exclusive Barber Shop//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.code}-${booking.date}@exclusive-barber`,
    `DTSTAMP:${now}`,
    // Floating local time on purpose: no TZID, so the phone reads it on its own
    // clock. The client is in the shop's city, and this avoids shipping a
    // VTIMEZONE block that would shift the turn if it were ever wrong.
    `DTSTART:${stamp(booking.date, booking.time)}`,
    `DTEND:${stamp(booking.date, end)}`,
    `SUMMARY:${escapeText(`${booking.serviceName} — ${shopName}`)}`,
    `DESCRIPTION:${escapeText(
      `Barbero: ${booking.barberName}\nCódigo de reserva: ${booking.code}`
    )}`,
    business.address ? `LOCATION:${escapeText(business.address)}` : null,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recordatorio de tu turno",
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line): line is string => line !== null);

  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadCalendarEvent(
  booking: ConfirmedBooking,
  business: { name: string; address: string | null }
): void {
  const blob = new Blob([buildCalendarEvent(booking, business)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `turno-${booking.date}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download on some mobile browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
