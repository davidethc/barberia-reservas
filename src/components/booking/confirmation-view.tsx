"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CalendarPlus, MapPin, MessageCircle } from "lucide-react";
import { formatPrice, formatTime, buildWhatsAppLink, cn } from "@/lib/utils";
import { BRAND_NAME, mapsUrl } from "@/lib/brand";
import { downloadCalendarEvent } from "./calendar";
import { formatLongDate } from "@/lib/shop-date";
import { SPRING_SOFT } from "@/lib/motion";
import { pillClasses } from "@/components/monky/pill-link";
import { Monogram } from "@/components/monky/site-header";
import { LoyaltyStamps } from "@/components/monky/loyalty-stamps";
import type { LoyaltyProgress } from "@/lib/loyalty";
import type { Business, ConfirmedBooking } from "./types";

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function ConfirmationView({
  booking,
  business,
  restored,
  loyalty,
  onReset,
}: {
  booking: ConfirmedBooking;
  business: Business;
  restored: boolean;
  loyalty: LoyaltyProgress | null;
  onReset: () => void;
}) {
  const whatsappLink = business.phone
    ? buildWhatsAppLink({
        businessPhone: business.phone,
        serviceName: booking.serviceName,
        barberName: booking.barberName,
        date: booking.date,
        time: booking.time,
        notes: booking.notes,
      })
    : null;

  function handleAddToCalendar() {
    try {
      downloadCalendarEvent(booking, business);
      toast.success("Listo. Abre el archivo para guardar la cita en tu calendario.");
    } catch {
      toast.error("No pudimos generar el archivo. Intenta de nuevo.");
    }
  }

  const rows = [
    { label: "Barbero", value: booking.barberName },
    { label: "Fecha", value: formatLongDate(booking.date) },
    { label: "Hora", value: `${formatTime(booking.time)} · ${booking.durationMinutes} min` },
    ...(booking.notes ? [{ label: "Nota", value: booking.notes }] : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 pb-10">
      <header className="flex h-16 items-center justify-center">
        <Link href="/" className="flex items-center gap-2" aria-label={`${BRAND_NAME}, inicio`}>
          <Monogram className="size-7" />
          <span className="text-xs font-bold tracking-[0.28em]">{BRAND_NAME}</span>
        </Link>
      </header>

      <motion.div
        className="flex flex-col"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
      >
        <motion.div
          className="mx-auto mt-4 grid size-24 place-items-center rounded-full bg-primary"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING_SOFT}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              className="stroke-primary-foreground"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
        </motion.div>

        <motion.h1 className="mt-6 text-center" variants={itemVariants}>
          <span className="block text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
            {restored ? "Tu próxima" : "¡Listo, te"}
          </span>
          <span className="-mt-1 block font-script text-[2.75rem] leading-[1.15] text-primary">
            {restored ? "cita" : "esperamos!"}
          </span>
        </motion.h1>
        <motion.p className="mt-2 text-center text-[0.9375rem] text-muted-foreground" variants={itemVariants}>
          {restored ? "La tienes guardada en este teléfono." : "Tu cita quedó reservada."}
        </motion.p>

        <motion.div className="mt-6 overflow-hidden rounded-[20px] bg-card shadow-card" variants={itemVariants}>
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
            <div>
              <p className="text-lg font-bold">{booking.serviceName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{BRAND_NAME}</p>
            </div>
            <p className="text-2xl font-extrabold text-primary tabular-nums">{formatPrice(booking.price)}</p>
          </div>
          <dl className="space-y-2.5 px-5 pb-5 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="text-right font-semibold break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
          <div className="relative flex items-center justify-between border-t border-dashed border-border px-5 py-4">
            <span aria-hidden className="absolute -top-2 -left-2 size-4 rounded-full bg-background" />
            <span aria-hidden className="absolute -top-2 -right-2 size-4 rounded-full bg-background" />
            <span className="text-sm text-muted-foreground">Código de cita</span>
            <span className="font-mono text-lg font-bold tracking-[0.2em] tabular-nums">{booking.code}</span>
          </div>
        </motion.div>

        {loyalty && (
          <motion.div className="mt-4" variants={itemVariants}>
            <LoyaltyStamps card={loyalty} moment="confirmation" />
          </motion.div>
        )}

        <motion.div className="mt-6 flex flex-col gap-3" variants={itemVariants}>
          <button type="button" onClick={handleAddToCalendar} className={cn(pillClasses, "w-full")}>
            <CalendarPlus aria-hidden className="size-5" strokeWidth={2} />
            Agregar al calendario
          </button>
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full border-2 border-foreground/80 font-bold transition-colors duration-200 hover:border-foreground hover:bg-card active:scale-[0.97]"
            >
              <MessageCircle aria-hidden className="size-5" strokeWidth={2} />
              Compartir por WhatsApp
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          )}
        </motion.div>

        <motion.p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground" variants={itemVariants}>
          Pagas en el local.{whatsappLink ? " Para cambiar o cancelar, escríbenos por WhatsApp." : ""}
        </motion.p>

        <motion.div className="mt-4 flex flex-wrap justify-center gap-2" variants={itemVariants}>
          {business.address && (
            <a
              href={mapsUrl(business.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <MapPin aria-hidden className="size-4" strokeWidth={1.75} />
              Cómo llegar
            </a>
          )}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground"
          >
            Reservar otra cita
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground"
          >
            Ir al inicio
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
