"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { createAppointment, getAvailableSlots } from "@/app/actions/booking";
import { formatPrice, formatDate, formatTime, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationView } from "./confirmation-view";
import { StepProgress } from "./step-progress";
import { formatDayNumber, formatWeekdayShort, getDayOfWeek } from "@/lib/shop-date";
import { isConfirmedBooking, type Barber, type Business, type ConfirmedBooking, type Service } from "./types";
import { SPRING_SNAPPY, TAP_SCALE, stepVariants } from "@/lib/motion";

type Props = {
  services: Service[];
  barbers: Barber[];
  business: Business;
  /** Weekdays (0 = Sunday) the shop opens, from `business_hours`. */
  openDays: number[];
  /** The next days offered, resolved on the shop's clock by the server. */
  dates: string[];
};

type Step = "service" | "barber" | "schedule" | "details";

const STEPS: { id: Step; label: string }[] = [
  { id: "service", label: "Servicio" },
  { id: "barber", label: "Barbero" },
  { id: "schedule", label: "Horario" },
  { id: "details", label: "Tus datos" },
];

const BOOKING_STORAGE_KEY = "eb_booking";

export function BookingWizard({ services, barbers, business, openDays, dates }: Props) {
  const [[step, direction], setStep] = useState<[Step, 1 | -1]>(["service", 1]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    () => firstOpenDate(dates, openDays)
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [slotsRetry, setSlotsRetry] = useState(0);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);
  const [restored, setRestored] = useState(false);
  const [isPending, startTransition] = useTransition();

  function goTo(next: Step, dir: 1 | -1) {
    setStep([next, dir]);
  }

  const openDaySet = useMemo(() => new Set(openDays), [openDays]);
  const selectedDateIsOpen = openDaySet.has(getDayOfWeek(selectedDate));
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // localStorage isn't available during SSR, so this can't be a lazy useState
  // initializer — it has to run post-mount in an effect.
  useEffect(() => {
    const saved = localStorage.getItem("eb_client_phone");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setClientPhone(saved);
    const savedName = localStorage.getItem("eb_client_name");
    if (savedName) setClientName(savedName);

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
  }, [dates]);

  // Standard fetch-on-dependency-change pattern; the loading flag has to be
  // set here since it depends on the async call this same effect triggers.
  useEffect(() => {
    if (!selectedBarber || !selectedService) return;
    // A closed day has nothing to ask the server for.
    if (!openDaySet.has(getDayOfWeek(selectedDate))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);
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
    getAvailableSlots(selectedBarber.id, selectedDate, selectedService.duration_minutes)
      .then((result) => {
        if (!stale) setSlots(result);
      })
      .catch(() => {
        // Without this the failure reads as "no hay horarios" and the client
        // leaves thinking the shop is full.
        if (!stale) {
          setSlots([]);
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
    goTo("barber", 1);
  }

  function handleSelectBarber(barber: Barber) {
    setSelectedBarber(barber);
    goTo("schedule", 1);
  }

  function handleSelectTime(time: string) {
    setSelectedTime(time);
    goTo("details", 1);
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
    goTo("service", 1);
  }

  function handleSubmit() {
    if (isPending || !selectedService || !selectedBarber || !selectedTime) return;

    startTransition(async () => {
      const result = await createAppointment({
        serviceId: selectedService.id,
        barberId: selectedBarber.id,
        date: selectedDate,
        startTime: selectedTime,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
      });

      if (result.success) {
        const booking: ConfirmedBooking = {
          code: result.data.appointmentId.replace(/-/g, "").slice(0, 6).toUpperCase(),
          serviceName: selectedService.name,
          price: selectedService.price,
          durationMinutes: selectedService.duration_minutes,
          barberName: selectedBarber.name,
          date: selectedDate,
          time: selectedTime,
        };
        try {
          localStorage.setItem("eb_client_phone", clientPhone.trim());
          localStorage.setItem("eb_client_name", clientName.trim());
          localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(booking));
        } catch {}
        setRestored(false);
        setConfirmed(booking);
      } else {
        toast.error(result.error);
      }
    });
  }

  if (confirmed) {
    return (
      <ConfirmationView
        booking={confirmed}
        business={business}
        restored={restored}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-7 pt-11 pb-7">
        <div className="flex items-baseline justify-between gap-4">
          <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            Reservar turno
          </div>
          <div className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            Paso {stepIndex + 1} de {STEPS.length}
          </div>
        </div>
        <h1 className="text-4xl font-bold mt-5 leading-none text-foreground">
          {business.name || "Exclusive"}<br />
          {business.name ? "" : "Barber Shop"}
        </h1>
        <StepProgress
          current={stepIndex + 1}
          total={STEPS.length}
          label={STEPS[stepIndex]!.label}
        />
      </header>

      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={SPRING_SNAPPY}
        >
          {step === "service" && (
            <ServiceStep services={services} onSelect={handleSelectService} />
          )}

          {step === "barber" && (
            <BarberStep
              barbers={barbers}
              onSelect={handleSelectBarber}
              onBack={() => goTo("service", -1)}
            />
          )}

          {step === "schedule" && (
            <ScheduleStep
              dates={dates}
              openDaySet={openDaySet}
              selectedDate={selectedDate}
              selectedDateIsOpen={selectedDateIsOpen}
              onSelectDate={setSelectedDate}
              slots={slots}
              loading={loadingSlots}
              failed={slotsFailed}
              onRetry={() => setSlotsRetry((n) => n + 1)}
              onSelectTime={handleSelectTime}
              onBack={() => goTo("barber", -1)}
            />
          )}

          {step === "details" && selectedService && selectedBarber && selectedTime && (
            <DetailsStep
              service={selectedService}
              barber={selectedBarber}
              date={selectedDate}
              time={selectedTime}
              clientName={clientName}
              clientPhone={clientPhone}
              onChangeName={setClientName}
              onChangePhone={setClientPhone}
              onSubmit={handleSubmit}
              isPending={isPending}
              onBack={() => goTo("schedule", -1)}
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

function ServiceStep({
  services,
  onSelect,
}: {
  services: Service[];
  onSelect: (s: Service) => void;
}) {
  return (
    <div className="px-7 pb-9">
      <div className="text-xs font-semibold tracking-widest uppercase mb-1 text-muted-foreground">
        Servicio
      </div>
      {services.map((service, i) => (
        <motion.button
          key={service.id}
          onClick={() => onSelect(service)}
          whileTap={{ scale: TAP_SCALE }}
          transition={SPRING_SNAPPY}
          className={cn(
            "w-full text-left flex justify-between items-baseline gap-4 py-5.5 min-h-11",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
            i < services.length - 1 && "border-b border-border"
          )}
        >
          <div>
            <div className="text-base font-semibold text-foreground">
              {service.name}
            </div>
            <div className="text-sm mt-1 text-muted-foreground">
              {service.duration_minutes} min
            </div>
          </div>
          <div className="text-xl font-bold text-foreground">
            {formatPrice(service.price)}
          </div>
        </motion.button>
      ))}
    </div>
  );
}

function BarberStep({
  barbers,
  onSelect,
  onBack,
}: {
  barbers: Barber[];
  onSelect: (b: Barber) => void;
  onBack: () => void;
}) {
  return (
    <div className="px-7 pb-8">
      <Button
        onClick={onBack}
        variant="ghost"
        className="h-auto -mt-3 py-3 px-0 mb-1 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        ← Servicios
      </Button>
      <div className="text-xs font-semibold tracking-widest uppercase mb-4 text-muted-foreground">
        Barbero
      </div>
      <div className="flex gap-3.5">
        {barbers.map((barber) => (
          <motion.button
            key={barber.id}
            onClick={() => onSelect(barber)}
            whileTap={{ scale: TAP_SCALE }}
            transition={SPRING_SNAPPY}
            className="flex-1 rounded-2xl p-5 text-center border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-border">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" className="stroke-foreground" strokeWidth="1.5" />
                <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" className="stroke-foreground" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-base font-semibold text-foreground">{barber.name}</div>
          </motion.button>
        ))}
      </div>
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
  loading,
  failed,
  onRetry,
  onSelectTime,
  onBack,
}: {
  dates: string[];
  openDaySet: Set<number>;
  selectedDate: string;
  selectedDateIsOpen: boolean;
  onSelectDate: (d: string) => void;
  slots: string[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelectTime: (t: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="px-7 pb-8">
      <Button
        onClick={onBack}
        variant="ghost"
        className="h-auto -mt-3 py-3 px-0 mb-1 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        ← Barbero
      </Button>
      <div className="text-xs font-semibold tracking-widest uppercase mb-4 text-muted-foreground">
        Horario
      </div>
      <div className="flex gap-2 mb-3.5 overflow-x-auto pb-1">
        {dates.map((date, i) => {
          const isOpen = openDaySet.has(getDayOfWeek(date));
          const isSelected = date === selectedDate;
          return (
            <motion.button
              key={date}
              onClick={() => isOpen && onSelectDate(date)}
              disabled={!isOpen}
              whileTap={isOpen ? { scale: TAP_SCALE } : undefined}
              transition={SPRING_SNAPPY}
              aria-label={`${i === 0 ? "Hoy, " : ""}${formatDate(date)}${isOpen ? "" : ", cerrado"}`}
              className={cn(
                "shrink-0 w-[4.5rem] min-h-14 px-2 py-2 rounded-lg flex flex-col items-center justify-center gap-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                !isOpen
                  ? "border border-dashed border-border text-muted-foreground cursor-not-allowed"
                  : isSelected
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground"
              )}
            >
              <span className={cn("text-sm", isSelected ? "font-semibold" : "font-medium")}>
                {i === 0 ? "Hoy" : formatWeekdayShort(date)}
              </span>
              {isOpen ? (
                <span className="text-xs tabular-nums opacity-80">{formatDayNumber(date)}</span>
              ) : (
                <span className="text-[0.625rem] font-medium uppercase tracking-wider whitespace-nowrap">
                  Cerrado
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {!selectedDateIsOpen ? (
        <div className="text-sm py-8 text-center text-muted-foreground">
          La barbería no abre este día. Elige otra fecha.
        </div>
      ) : loading ? (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="rounded-lg h-11 w-full" />
          ))}
        </div>
      ) : failed ? (
        <div className="py-8 text-center">
          <div className="text-sm text-muted-foreground">
            No pudimos cargar los horarios
          </div>
          <Button
            onClick={onRetry}
            variant="outline"
            className="mt-3 h-11 rounded-lg px-5 text-sm font-medium"
          >
            Reintentar
          </Button>
        </div>
      ) : slots.length === 0 ? (
        <div className="text-sm py-8 text-center text-muted-foreground">
          No hay horarios disponibles este día
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((time) => (
            <motion.button
              key={time}
              onClick={() => onSelectTime(time)}
              whileTap={{ scale: TAP_SCALE }}
              transition={SPRING_SNAPPY}
              className="rounded-lg py-3 min-h-11 text-center text-sm font-medium border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {formatTime(time)}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailsStep({
  service,
  barber,
  date,
  time,
  clientName,
  clientPhone,
  onChangeName,
  onChangePhone,
  onSubmit,
  isPending,
  onBack,
}: {
  service: Service;
  barber: Barber;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  onBack: () => void;
}) {
  const nameValue = clientName.trim();
  const phoneValue = clientPhone.trim();
  const nameIsValid = nameValue.length >= 2;
  const phoneIsValid = /^0\d{9}$/.test(phoneValue);
  const isValid = nameIsValid && phoneIsValid;
  const nameError = nameValue.length > 0 && !nameIsValid ? "Ingresa tu nombre completo" : null;
  const phoneError =
    phoneValue.length > 0 && !phoneIsValid ? "El teléfono va con 10 dígitos: 09XXXXXXXX" : null;

  return (
    <div className="px-7 pb-8">
      <Button
        onClick={onBack}
        variant="ghost"
        className="h-auto -mt-3 py-3 px-0 mb-1 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        ← Horario
      </Button>

      <div className="rounded-2xl p-5 mb-6 bg-surface">
        <div className="text-base font-semibold text-foreground">{service.name}</div>
        <div className="text-sm mt-1 text-muted-foreground">
          {barber.name} · {formatDate(date)} · {formatTime(time)}
        </div>
        <div className="text-lg font-bold mt-2 text-foreground">{formatPrice(service.price)}</div>
      </div>

      <div className="text-xs font-semibold tracking-widest uppercase mb-4 text-muted-foreground">
        Tus datos
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <Label htmlFor="client-name" className="block text-sm mb-1.5 font-medium text-foreground">
            Nombre
          </Label>
          <Input
            id="client-name"
            type="text"
            autoComplete="name"
            value={clientName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Tu nombre"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "client-name-error" : undefined}
            className="h-auto w-full px-4 py-3 rounded-xl text-base bg-card"
          />
          {nameError && (
            <p id="client-name-error" className="mt-1.5 text-sm text-destructive">
              {nameError}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="client-phone" className="block text-sm mb-1.5 font-medium text-foreground">
            Teléfono
          </Label>
          <Input
            id="client-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={clientPhone}
            onChange={(e) => onChangePhone(e.target.value)}
            placeholder="09XXXXXXXX"
            aria-invalid={!!phoneError}
            aria-describedby={phoneError ? "client-phone-error" : undefined}
            className="h-auto w-full px-4 py-3 rounded-xl text-base bg-card"
          />
          {phoneError && (
            <p id="client-phone-error" className="mt-1.5 text-sm text-destructive">
              {phoneError}
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={onSubmit}
        disabled={!isValid || isPending}
        className="w-full h-auto rounded-2xl py-5 text-center cursor-pointer transition-transform active:scale-[0.98]"
      >
        <span className="text-base font-semibold">
          {isPending ? "Reservando..." : "Confirmar reserva"}
        </span>
      </Button>
    </div>
  );
}
