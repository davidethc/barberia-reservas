"use client";

import { toast } from "sonner";
import { formatPrice, formatTime, buildWhatsAppLink } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { downloadCalendarEvent } from "./calendar";
import { formatLongDate } from "./date-helpers";
import type { Business, ConfirmedBooking } from "./types";

export function ConfirmationView({
  booking,
  business,
  restored,
  onReset,
}: {
  booking: ConfirmedBooking;
  business: Business;
  restored: boolean;
  onReset: () => void;
}) {
  const businessPhone = (business.phone ?? "").replace(/\D/g, "");
  const whatsappLink = businessPhone
    ? buildWhatsAppLink({
        businessPhone,
        serviceName: booking.serviceName,
        barberName: booking.barberName,
        date: booking.date,
        time: booking.time,
      })
    : null;
  const mapsLink = business.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
    : null;

  function handleAddToCalendar() {
    try {
      downloadCalendarEvent(booking, business);
      toast.success("Listo. Abre el archivo para agregar el turno a tu calendario.");
    } catch {
      toast.error("No pudimos generar el archivo. Intenta de nuevo.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7 py-12 bg-background animate-in fade-in zoom-in-95 duration-300">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto bg-accent">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12l5 5L19 7"
              className="stroke-accent-foreground"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-center text-foreground">
          {restored ? "Tu próximo turno" : "Reserva confirmada"}
        </h2>
        <p className="text-sm mt-2 text-center text-muted-foreground">
          {restored
            ? "Te esperamos en el horario reservado."
            : "Ya tienes tu lugar agendado. Te esperamos."}
        </p>

        <div className="rounded-2xl p-6 mt-6 mb-6 bg-surface">
          <div className="text-lg font-semibold text-foreground">{booking.serviceName}</div>
          <div className="text-sm mt-2 space-y-0.5 text-muted-foreground">
            <div>💈 {booking.barberName}</div>
            <div>📅 {formatLongDate(booking.date)}</div>
            <div>🕐 {formatTime(booking.time)}</div>
            {business.address && <div>📍 {business.address}</div>}
          </div>
          <div className="text-xl font-bold mt-3 text-foreground">
            {formatPrice(booking.price)}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
              Código
            </span>
            <span className="text-sm font-semibold tracking-wider text-foreground">
              {booking.code}
            </span>
          </div>
        </div>

        <Button
          onClick={handleAddToCalendar}
          className="w-full h-auto rounded-2xl py-5 cursor-pointer transition-transform active:scale-[0.98]"
        >
          <span className="text-base font-semibold">Agregar al calendario</span>
        </Button>

        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full min-h-11 rounded-2xl py-4 text-center flex items-center justify-center font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ background: "#25D366" }}
          >
            Compartir por WhatsApp
          </a>
        )}

        <p className="mt-5 text-xs leading-relaxed text-center text-muted-foreground">
          Guardamos este turno en tu teléfono, así lo encuentras aunque cierres la página.
          {whatsappLink ? " Para cancelar o cambiarlo, escríbenos por WhatsApp." : ""}
        </p>

        <div className="flex justify-center gap-4 mt-4">
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center px-2 text-sm font-medium text-muted-foreground transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
            >
              Cómo llegar
            </a>
          )}
          <button
            onClick={onReset}
            className="flex min-h-11 items-center justify-center px-2 text-sm font-medium text-muted-foreground transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
          >
            Reservar otro turno
          </button>
        </div>
      </div>
    </div>
  );
}
