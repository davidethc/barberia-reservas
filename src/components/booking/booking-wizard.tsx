"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, useMemo, useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarOff,
  CalendarX,
  Loader2,
  MessageCircle,
  Shuffle,
  WifiOff,
} from "lucide-react";
import {
  createAppointment,
  createAppointmentAnyBarber,
  getAnyBarberSlots,
  getAvailableSlots,
  getLoyaltyProgress,
} from "@/app/actions/booking";
import { formatPrice, formatTime, cn } from "@/lib/utils";
import { BRAND_NAME, toWhatsAppNumber } from "@/lib/brand";
import { ConfirmationView } from "./confirmation-view";
import { StepProgress } from "./step-progress";
import { formatDayNumber, formatLongDate, formatWeekdayShort, getDayOfWeek } from "@/lib/shop-date";
import { isConfirmedBooking, type Barber, type Business, type ConfirmedBooking, type Service } from "./types";
import { SPRING_SNAPPY, stepVariants } from "@/lib/motion";
import { Monogram } from "@/components/monky/site-header";
import { BarberAvatar } from "@/components/monky/barber-card";
import { ServiceRowContent, serviceRowClasses } from "@/components/monky/service-row";
import { pillClasses } from "@/components/monky/pill-link";
import { LoyaltyStamps } from "@/components/monky/loyalty-stamps";
import { paidTurnsPerReward, type LoyaltyProgress } from "@/lib/loyalty";

type Props = {
  services: Service[];
  barbers: Barber[];
  business: Business;
  /** Weekdays (0 = Sunday) the shop opens, from `business_hours`. */
  openDays: number[];
  /** The next days offered, resolved on the shop's clock by the server. */
  dates: string[];
  /** Deep-link preselection from the home cards (`?servicio=` / `?barbero=`). */
  initialServiceId?: string;
  initialBarberId?: string;
};

type Step = "service" | "barber" | "schedule" | "details" | "summary";

const STEPS: { id: Step; label: string; title: [string, string] }[] = [
  { id: "service", label: "Servicio", title: ["Elige tu", "servicio"] },
  { id: "barber", label: "Barbero", title: ["Elige tu", "barbero"] },
  { id: "schedule", label: "Fecha y hora", title: ["Elige día", "y hora"] },
  { id: "details", label: "Tus datos", title: ["Déjanos tus", "datos"] },
  { id: "summary", label: "Resumen", title: ["Revisa tu", "cita"] },
];

const BOOKING_STORAGE_KEY = "eb_booking";
const ANY_BARBER: Barber = { id: "any", name: "Cualquiera disponible", photo_url: null };
const SLOT_TAKEN_MESSAGE = "Este horario ya fue reservado. Elige otro.";

export function BookingWizard({
  services,
  barbers,
  business,
  openDays,
  dates,
  initialServiceId,
  initialBarberId,
}: Props) {
  const initialService = services.find((s) => s.id === initialServiceId) ?? null;
  const initialBarber =
    initialBarberId === ANY_BARBER.id ? ANY_BARBER : (barbers.find((b) => b.id === initialBarberId) ?? null);
  const deepLinked = initialService !== null || initialBarber !== null;

  const [[step, direction], setStep] = useState<[Step, 1 | -1]>(() => [
    initialService ? (initialBarber ? "schedule" : "barber") : "service",
    1,
  ]);
  const [selectedService, setSelectedService] = useState<Service | null>(initialService);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(initialBarber);
  const [selectedDate, setSelectedDate] = useState<string>(() => firstOpenDate(dates, openDays));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  /** Today only: slot starts before this already passed and are shown struck through. */
  const [pastBefore, setPastBefore] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [slotsRetry, setSlotsRetry] = useState(0);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);
  const [restored, setRestored] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loyalty, setLoyalty] = useState<{ phone: string; card: LoyaltyProgress } | null>(null);

  // The stamp card follows the phone being typed (or the one remembered on this device).
  // Debounced, and a reply for a phone that is no longer in the field is dropped. Any
  // failure simply shows nothing: a reward that cannot be read never blocks a booking.
  const loyaltyEnabled = business.loyalty_enabled === true;
  const typedPhone = clientPhone.trim();
  useEffect(() => {
    if (!loyaltyEnabled || !/^0\d{9}$/.test(typedPhone)) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const result = await getLoyaltyProgress(typedPhone);
        if (!stale && result.success) setLoyalty({ phone: typedPhone, card: result.data });
      } catch {
        // Nothing to show.
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [loyaltyEnabled, typedPhone]);
  const loyaltyCard = loyaltyEnabled && loyalty?.phone === typedPhone ? loyalty.card : null;

  function goTo(next: Step, dir: 1 | -1) {
    setStep([next, dir]);
    window.scrollTo({ top: 0 });
  }

  const openDaySet = useMemo(() => new Set(openDays), [openDays]);
  const selectedDateIsOpen = openDaySet.has(getDayOfWeek(selectedDate));
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const current = STEPS[stepIndex]!;

  // localStorage isn't available during SSR, so this can't be a lazy useState
  // initializer — it has to run post-mount in an effect.
  useEffect(() => {
    const saved = localStorage.getItem("eb_client_phone");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setClientPhone(saved);
    const savedName = localStorage.getItem("eb_client_name");
    if (savedName) setClientName(savedName);

    // Arriving from a service or barber card means a new booking, not "show me my turn".
    if (deepLinked) return;

    // A refresh used to wipe the confirmation and leave nothing behind; the
    // turn is kept here until the day it happens is over.
    try {
      const raw = localStorage.getItem(BOOKING_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!isConfirmedBooking(parsed)) {
        localStorage.removeItem(BOOKING_STORAGE_KEY);
        return;
      }
      if (dates.length > 0 && parsed.date < dates[0]!) {
        localStorage.removeItem(BOOKING_STORAGE_KEY);
        return;
      }
      setConfirmed(parsed);
      setRestored(true);
    } catch {
      // Corrupt or unavailable storage must never block a new booking.
    }
  }, [dates, deepLinked]);

  // Standard fetch-on-dependency-change pattern; the loading flag has to be
  // set here since it depends on the async call this same effect triggers.
  useEffect(() => {
    if (!selectedBarber || !selectedService) return;
    // A closed day has nothing to ask the server for.
    if (!openDaySet.has(getDayOfWeek(selectedDate))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);
      setPastBefore(null);
      setLoadingSlots(false);
      setSlotsFailed(false);
      setSelectedTime(null);
      return;
    }
    // Tapping through dates fires overlapping requests, and a slow earlier one
    // must not overwrite the slots of the date now selected.
    let stale = false;
    setLoadingSlots(true);
    setSlotsFailed(false);
    setSelectedTime(null);
    const request =
      selectedBarber.id === ANY_BARBER.id
        ? getAnyBarberSlots(selectedDate, selectedService.duration_minutes)
        : getAvailableSlots(selectedBarber.id, selectedDate, selectedService.duration_minutes);
    request
      .then((result) => {
        if (stale) return;
        setSlots(result.slots);
        setPastBefore(result.pastBefore);
      })
      .catch(() => {
        // Without this the failure reads as "no hay horarios" and the client
        // leaves thinking the shop is full.
        if (!stale) {
          setSlots([]);
          setPastBefore(null);
          setSlotsFailed(true);
        }
      })
      .finally(() => {
        if (!stale) setLoadingSlots(false);
      });

    return () => {
      stale = true;
    };
  }, [selectedBarber, selectedDate, selectedService, slotsRetry, openDaySet]);

  function handleSelectService(service: Service) {
    setSelectedService(service);
    goTo(selectedBarber ? "schedule" : "barber", 1);
  }

  function handleSelectBarber(barber: Barber) {
    setSelectedBarber(barber);
    goTo("schedule", 1);
  }

  function handleSelectTime(time: string) {
    setSelectedTime(time);
    goTo("details", 1);
  }

  function handleBack() {
    setSubmitError(null);
    goTo(STEPS[stepIndex - 1]!.id, -1);
  }

  function handleReset() {
    try {
      localStorage.removeItem(BOOKING_STORAGE_KEY);
    } catch {}
    setConfirmed(null);
    setRestored(false);
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedDate(firstOpenDate(dates, openDays));
    setSelectedTime(null);
    setSlots([]);
    setPastBefore(null);
    setNotes("");
    setSubmitError(null);
    goTo("service", 1);
  }

  function handleSubmit() {
    if (isPending || !selectedService || !selectedBarber || !selectedTime) return;
    setSubmitError(null);

    startTransition(async () => {
      const payload = {
        serviceId: selectedService.id,
        date: selectedDate,
        startTime: selectedTime,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
      };
      const isAny = selectedBarber.id === ANY_BARBER.id;
      const result = isAny
        ? await createAppointmentAnyBarber(payload)
        : await createAppointment({ ...payload, barberId: selectedBarber.id });

      if (!result.success) {
        setSubmitError(result.error);
        return;
      }

      const assignedId = "barberId" in result.data ? result.data.barberId : selectedBarber.id;
      const barberName = barbers.find((b) => b.id === assignedId)?.name ?? selectedBarber.name;
      const booking: ConfirmedBooking = {
        code: result.data.appointmentId.replace(/-/g, "").slice(0, 6).toUpperCase(),
        serviceName: selectedService.name,
        price: selectedService.price,
        durationMinutes: selectedService.duration_minutes,
        barberName,
        date: selectedDate,
        time: selectedTime,
        notes: notes.trim() || undefined,
      };
      try {
        localStorage.setItem("eb_client_phone", clientPhone.trim());
        localStorage.setItem("eb_client_name", clientName.trim());
        localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(booking));
      } catch {}
      setRestored(false);
      setConfirmed(booking);
      window.scrollTo({ top: 0 });
    });
  }

  if (confirmed) {
    return (
      <ConfirmationView
        booking={confirmed}
        business={business}
        restored={restored}
        // A fresh booking is still pending, so the card read on the details step is still
        // the right one; a turn restored from storage shows no card (the phone may differ).
        loyalty={restored ? null : loyaltyCard}
        onReset={handleReset}
      />
    );
  }

  const context = [
    stepIndex > 0 && selectedService ? `${selectedService.name} · ${formatPrice(selectedService.price)}` : null,
    stepIndex > 1 && selectedBarber ? selectedBarber.name : null,
    stepIndex > 2 && selectedTime ? `${formatLongDate(selectedDate)}, ${formatTime(selectedTime)}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
      <header className="sticky top-0 z-(--mk-z-header) bg-background/92 px-4 backdrop-blur-md">
        <div className="grid h-16 grid-cols-[44px_1fr_44px] items-center">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label={`Atrás: ${STEPS[stepIndex - 1]!.label}`}
              className="grid size-11 place-items-center rounded-full transition-colors hover:bg-card active:scale-95"
            >
              <ArrowLeft className="size-5" strokeWidth={1.75} />
            </button>
          ) : (
            <Link
              href="/"
              aria-label="Volver al inicio"
              className="grid size-11 place-items-center rounded-full transition-colors hover:bg-card active:scale-95"
            >
              <ArrowLeft className="size-5" strokeWidth={1.75} />
            </Link>
          )}
          <Link href="/" className="flex items-center justify-center gap-2" aria-label={`${BRAND_NAME}, inicio`}>
            <Monogram className="size-7" />
            <span className="text-xs font-bold tracking-[0.28em]">{BRAND_NAME}</span>
          </Link>
          <span aria-hidden />
        </div>
        <div className="flex items-center justify-between pb-3 pl-1">
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            Paso {stepIndex + 1} de {STEPS.length}
          </span>
          <StepProgress current={stepIndex + 1} total={STEPS.length} label={current.label} />
        </div>
      </header>

      <div className="px-5 pt-3 pb-5">
        <h1 key={step} className="mk-rise">
          <span className="block text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em]">{current.title[0]}</span>
          <span className="-mt-1 block font-script text-[2.75rem] leading-[1.15] text-primary">{current.title[1]}</span>
        </h1>
        {context.length > 0 && step !== "summary" && (
          <p className="mt-2 text-sm text-muted-foreground">{context.join(" · ")}</p>
        )}
      </div>

      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={SPRING_SNAPPY}
          className="flex flex-1 flex-col px-5 pb-10"
        >
          {step === "service" && (
            <ServiceStep
              services={services}
              selectedId={selectedService?.id ?? null}
              onSelect={handleSelectService}
              businessPhone={business.phone}
            />
          )}

          {step === "barber" && (
            <BarberStep barbers={barbers} selectedId={selectedBarber?.id ?? null} onSelect={handleSelectBarber} />
          )}

          {step === "schedule" && (
            <ScheduleStep
              dates={dates}
              openDaySet={openDaySet}
              selectedDate={selectedDate}
              selectedDateIsOpen={selectedDateIsOpen}
              onSelectDate={setSelectedDate}
              slots={slots}
              pastBefore={pastBefore}
              loading={loadingSlots}
              failed={slotsFailed}
              onRetry={() => setSlotsRetry((n) => n + 1)}
              onSelectTime={handleSelectTime}
            />
          )}

          {step === "details" && (
            <DetailsStep
              clientName={clientName}
              clientPhone={clientPhone}
              notes={notes}
              onChangeName={setClientName}
              onChangePhone={setClientPhone}
              onChangeNotes={setNotes}
              loyaltyCard={loyaltyCard}
              onContinue={() => goTo("summary", 1)}
            />
          )}

          {step === "summary" && selectedService && selectedBarber && selectedTime && (
            <SummaryStep
              service={selectedService}
              barber={selectedBarber}
              date={selectedDate}
              time={selectedTime}
              clientName={clientName.trim()}
              clientPhone={clientPhone.trim()}
              notes={notes.trim()}
              loyaltyCard={loyaltyCard}
              error={submitError}
              isPending={isPending}
              onEdit={(target) => {
                setSubmitError(null);
                if (target === "schedule") setSlotsRetry((n) => n + 1);
                goTo(target, -1);
              }}
              onSubmit={handleSubmit}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Landing on a day the shop is closed costs the client a tap to find out. */
function firstOpenDate(dates: string[], openDays: number[]): string {
  const open = new Set(openDays);
  return dates.find((d) => open.has(getDayOfWeek(d))) ?? dates[0]!;
}

const selectedRing = "ring-2 ring-primary ring-offset-2 ring-offset-background";

function StateMessage({
  icon: Icon,
  children,
  action,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] bg-card px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-background text-primary">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="max-w-[28ch] text-sm leading-relaxed text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

function ServiceStep({
  services,
  selectedId,
  onSelect,
  businessPhone,
}: {
  services: Service[];
  selectedId: string | null;
  onSelect: (s: Service) => void;
  businessPhone: string | null;
}) {
  if (services.length === 0) {
    return (
      <StateMessage
        icon={CalendarX}
        action={
          businessPhone && (
            <a
              href={`https://wa.me/${toWhatsAppNumber(businessPhone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:border-primary"
            >
              <MessageCircle className="size-4" strokeWidth={1.75} /> Escríbenos
            </a>
          )
        }
      >
        Ahora mismo no hay servicios para reservar en línea. Escríbenos y te ayudamos.
      </StateMessage>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {services.map((service, i) => (
        <li key={service.id} className="mk-rise" style={{ "--mk-delay": `${i * 40}ms` } as React.CSSProperties}>
          <button
            type="button"
            onClick={() => onSelect(service)}
            aria-pressed={service.id === selectedId}
            className={cn(serviceRowClasses, service.id === selectedId && selectedRing)}
          >
            <ServiceRowContent
              name={service.name}
              description={service.description}
              durationMinutes={service.duration_minutes}
              price={service.price}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function BarberStep({
  barbers,
  selectedId,
  onSelect,
}: {
  barbers: Barber[];
  selectedId: string | null;
  onSelect: (b: Barber) => void;
}) {
  if (barbers.length === 0) {
    return <StateMessage icon={CalendarX}>Hoy no hay barberos recibiendo reservas en línea. Vuelve a intentarlo más tarde.</StateMessage>;
  }

  const card =
    "rounded-[20px] bg-card shadow-card transition-transform duration-200 ease-(--mk-ease-out) hover:-translate-y-0.5 active:scale-[0.98]";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onSelect(ANY_BARBER)}
        aria-pressed={selectedId === ANY_BARBER.id}
        className={cn(card, "mk-rise flex items-center gap-4 p-4 text-left", selectedId === ANY_BARBER.id && selectedRing)}
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Shuffle className="size-6" strokeWidth={1.75} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Cualquiera disponible</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">Más horarios: te asignamos quien esté libre.</span>
        </span>
        <ArrowRight aria-hidden className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </button>

      <ul className="grid grid-cols-2 gap-3">
        {barbers.map((barber, i) => (
          <li key={barber.id} className="mk-rise" style={{ "--mk-delay": `${(i + 1) * 50}ms` } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => onSelect(barber)}
              aria-pressed={selectedId === barber.id}
              className={cn(card, "flex w-full flex-col items-center gap-3 px-3 pt-6 pb-5", selectedId === barber.id && selectedRing)}
            >
              <BarberAvatar name={barber.name} photoUrl={barber.photo_url} />
              <span className="font-semibold">{barber.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScheduleStep({
  dates,
  openDaySet,
  selectedDate,
  selectedDateIsOpen,
  onSelectDate,
  slots,
  pastBefore,
  loading,
  failed,
  onRetry,
  onSelectTime,
}: {
  dates: string[];
  openDaySet: Set<number>;
  selectedDate: string;
  selectedDateIsOpen: boolean;
  onSelectDate: (d: string) => void;
  slots: string[];
  pastBefore: string | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelectTime: (t: string) => void;
}) {
  // A slot earlier than the server's cutoff already passed. Compare on "HH:MM" so the
  // trailing ":SS" Postgres adds never affects the ordering.
  const isPast = (time: string) => pastBefore !== null && time.slice(0, 5) < pastBefore;
  const bookableCount = slots.filter((time) => !isPast(time)).length;

  const bodyKey = !selectedDateIsOpen
    ? "closed"
    : loading
      ? "loading"
      : failed
        ? "failed"
        : bookableCount === 0
          ? "empty"
          : "slots";

  // The 12:00–13:00 lunch is already dropped server-side; the hour filters keep the
  // two stretches honest (and would hide a stray 12:xx slot if one ever leaked through).
  // Past slots stay so the morning is visible on a same-day afternoon visit, struck out.
  const slotsByPeriod = [
    { label: "Mañana", list: slots.filter((t) => Number(t.slice(0, 2)) < 12) },
    { label: "Tarde", list: slots.filter((t) => Number(t.slice(0, 2)) >= 13) },
  ].filter((group) => group.list.length > 0);

  const hasPast = pastBefore !== null && slots.some(isPast);

  return (
    <div>
      <div role="group" aria-label="Fecha" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none]">
        {dates.map((date, i) => {
          const isOpen = openDaySet.has(getDayOfWeek(date));
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              type="button"
              onClick={() => isOpen && onSelectDate(date)}
              disabled={!isOpen}
              aria-pressed={isSelected}
              aria-label={`${i === 0 ? "Hoy, " : ""}${formatLongDate(date)}${isOpen ? "" : ", cerrado"}`}
              className={cn(
                "flex min-h-18 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors duration-150 active:scale-95",
                !isOpen
                  ? "cursor-not-allowed border border-dashed border-border text-muted-foreground"
                  : isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:bg-(--mk-ink-raised)"
              )}
            >
              <span className={cn("text-xs", isSelected ? "font-bold" : "font-medium")}>
                {i === 0 ? "Hoy" : formatWeekdayShort(date)}
              </span>
              {isOpen ? (
                <span className="text-lg font-bold tabular-nums">{formatDayNumber(date)}</span>
              ) : (
                <span className="text-[0.625rem] font-semibold">Cerrado</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5" aria-live="polite" aria-busy={loading}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={bodyKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {!selectedDateIsOpen ? (
              <StateMessage icon={CalendarOff}>La barbería no abre este día. Elige otra fecha.</StateMessage>
            ) : loading ? (
              <div className="space-y-5">
                <span className="sr-only">Cargando horarios…</span>
                {[8, 4].map((n, g) => (
                  <div key={g}>
                    <div className="mb-3 h-4 w-20 animate-pulse rounded-full bg-card motion-reduce:animate-none" />
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: n }).map((_, i) => (
                        <div key={i} className="h-11 animate-pulse rounded-full bg-card motion-reduce:animate-none" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : failed ? (
              <StateMessage
                icon={WifiOff}
                action={
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-1 min-h-11 rounded-full border border-border px-6 text-sm font-semibold hover:border-primary"
                  >
                    Reintentar
                  </button>
                }
              >
                No pudimos cargar los horarios. Revisa tu conexión e intenta de nuevo.
              </StateMessage>
            ) : bookableCount === 0 ? (
              <StateMessage icon={CalendarX}>
                {slots.length > 0
                  ? "Por hoy ya no quedan horarios. Elige otra fecha."
                  : "Este día ya está lleno. Prueba con otra fecha."}
              </StateMessage>
            ) : (
              <div className="space-y-6">
                {slotsByPeriod.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h2 className="mb-3 text-sm font-bold">{group.label}</h2>
                    <div className="grid grid-cols-4 gap-2">
                      {group.list.map((time) => {
                        const past = isPast(time);
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => onSelectTime(time)}
                            disabled={past}
                            aria-label={past ? `${formatTime(time)}, ya pasó` : formatTime(time)}
                            className={cn(
                              "min-h-11 rounded-full text-sm font-semibold tabular-nums transition-colors duration-150",
                              past
                                ? "cursor-not-allowed text-muted-foreground/70 line-through"
                                : "bg-card hover:bg-primary hover:text-primary-foreground active:scale-95"
                            )}
                          >
                            {formatTime(time)}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {hasPast && <p className="text-xs text-muted-foreground">Los horarios tachados ya pasaron.</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const inputClasses =
  "w-full rounded-[14px] border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground/80 transition-colors focus:border-primary focus:outline-none focus-visible:outline-none aria-invalid:border-destructive";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="mt-1.5 text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function DetailsStep({
  clientName,
  clientPhone,
  notes,
  onChangeName,
  onChangePhone,
  onChangeNotes,
  loyaltyCard,
  onContinue,
}: {
  clientName: string;
  clientPhone: string;
  notes: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeNotes: (v: string) => void;
  loyaltyCard: LoyaltyProgress | null;
  onContinue: () => void;
}) {
  const uid = useId();
  const [touched, setTouched] = useState({ name: false, phone: false });
  const nameValue = clientName.trim();
  const phoneValue = clientPhone.trim();
  const nameIsValid = nameValue.length >= 2;
  const phoneIsValid = /^0\d{9}$/.test(phoneValue);
  const nameError = touched.name && !nameIsValid ? "Escribe tu nombre para saber a quién esperamos." : null;
  const phoneError =
    touched.phone && !phoneIsValid ? "Tu celular va con 10 dígitos y empieza en 0, por ejemplo 0991234567." : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, phone: true });
    if (nameIsValid && phoneIsValid) onContinue();
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <div className="space-y-5">
        <Field id={`${uid}-name`} label="Nombre" error={nameError}>
          <input
            id={`${uid}-name`}
            type="text"
            autoComplete="name"
            value={clientName}
            maxLength={100}
            onChange={(e) => onChangeName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            placeholder="Tu nombre y apellido"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? `${uid}-name-msg` : undefined}
            className={inputClasses}
          />
        </Field>
        <Field id={`${uid}-phone`} label="Celular" hint="Solo para avisarte si hay un cambio." error={phoneError}>
          <input
            id={`${uid}-phone`}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={clientPhone}
            maxLength={10}
            onChange={(e) => onChangePhone(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            placeholder="09XXXXXXXX"
            aria-invalid={!!phoneError}
            aria-describedby={`${uid}-phone-msg`}
            className={cn(inputClasses, "tabular-nums")}
          />
        </Field>
        {/* Grows in only after the phone was typed (a response to input, not a layout jump).
            The live region is always mounted so a screen reader hears the card arrive; it
            takes no space of its own (mt-0!), the gap lives inside the animated part, so with
            no card the form is laid out exactly as before. */}
        <div role="status" aria-live="polite" aria-atomic="true" className="mt-0!">
          <AnimatePresence initial={false}>
            {loyaltyCard && phoneIsValid && (
              <motion.div
                key="stamps"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING_SNAPPY}
                className="overflow-hidden"
              >
                <div className="pt-5">
                  <LoyaltyStamps card={loyaltyCard} moment="details" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Field
          id={`${uid}-notes`}
          label="Notas (opcional)"
          hint="Va en tu mensaje de WhatsApp y en el evento del calendario."
          error={null}
        >
          <textarea
            id={`${uid}-notes`}
            value={notes}
            maxLength={200}
            rows={3}
            onChange={(e) => onChangeNotes(e.target.value)}
            placeholder="Ej.: quiero el degradado un poco más bajo"
            aria-describedby={`${uid}-notes-msg`}
            className={cn(inputClasses, "resize-none")}
          />
        </Field>
      </div>

      <div className="sticky bottom-0 mt-auto -mx-5 bg-linear-to-t from-background via-background to-transparent px-5 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="submit" className={cn(pillClasses, "w-full")}>
          Continuar
          <ArrowRight aria-hidden className="size-5" strokeWidth={2.25} />
        </button>
      </div>
    </form>
  );
}

function SummaryStep({
  service,
  barber,
  date,
  time,
  clientName,
  clientPhone,
  notes,
  loyaltyCard,
  error,
  isPending,
  onEdit,
  onSubmit,
}: {
  service: Service;
  barber: Barber;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  notes: string;
  loyaltyCard: LoyaltyProgress | null;
  error: string | null;
  isPending: boolean;
  onEdit: (step: Step) => void;
  onSubmit: () => void;
}) {
  const rows: { label: string; value: string; detail?: string; step: Step }[] = [
    { label: "Servicio", value: service.name, detail: `${service.duration_minutes} min`, step: "service" },
    {
      label: "Barbero",
      value: barber.name,
      detail: barber.id === ANY_BARBER.id ? "Te asignamos uno al confirmar" : undefined,
      step: "barber",
    },
    { label: "Fecha y hora", value: formatLongDate(date), detail: formatTime(time), step: "schedule" },
    { label: "Tus datos", value: clientName, detail: notes ? `${clientPhone} · ${notes}` : clientPhone, step: "details" },
  ];
  const slotTaken = error === SLOT_TAKEN_MESSAGE;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mk-rise overflow-hidden rounded-[20px] bg-card shadow-card">
        <dl className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="mt-0.5 font-semibold">{row.value}</dd>
                {row.detail && <dd className="mt-0.5 text-sm break-words text-muted-foreground">{row.detail}</dd>}
              </div>
              <button
                type="button"
                onClick={() => onEdit(row.step)}
                aria-label={`Cambiar ${row.label.toLowerCase()}`}
                className="-mr-2 min-h-11 rounded-full px-3 text-sm font-semibold text-primary hover:underline hover:underline-offset-4"
              >
                Cambiar
              </button>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between border-t border-dashed border-border px-5 py-4">
          <span className="text-sm text-muted-foreground">Total · pagas en el local</span>
          <span className="text-2xl font-extrabold text-primary tabular-nums">{formatPrice(service.price)}</span>
        </div>
        {/* The real price stays above: the free turn is applied by the barber when paying. */}
        {loyaltyCard?.eligible && (
          <p className="border-t border-border px-5 py-3 text-sm">
            <strong className="font-bold text-primary">Corte gratis</strong>{" "}
            <span className="text-muted-foreground">
              por tus {paidTurnsPerReward(loyaltyCard.cycle)} visitas · se aplica al pagar en el local.
            </span>
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-[20px] border border-destructive/60 px-4 py-3.5 text-sm">
          <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" strokeWidth={1.75} />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            {slotTaken ? (
              <button
                type="button"
                onClick={() => onEdit("schedule")}
                className="mt-1 min-h-11 font-semibold text-primary underline underline-offset-4"
              >
                Ver horarios libres
              </button>
            ) : (
              <p className="mt-0.5 text-muted-foreground">Tus datos siguen aquí; puedes intentarlo otra vez.</p>
            )}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 mt-auto -mx-5 bg-linear-to-t from-background via-background to-transparent px-5 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onSubmit} disabled={isPending} className={cn(pillClasses, "w-full")}>
          {isPending ? (
            <>
              <Loader2 aria-hidden className="size-5 animate-spin" />
              Reservando…
            </>
          ) : (
            <>
              Confirmar reserva
              <ArrowRight aria-hidden className="size-5" strokeWidth={2.25} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
