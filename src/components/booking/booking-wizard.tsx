"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { createAppointment, getAvailableSlots } from "@/app/actions/booking";
import { formatPrice, formatDate, formatTime, getNextDays, buildWhatsAppLink, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
};

type Barber = {
  id: string;
  name: string;
  photo_url: string | null;
};

type Business = {
  name: string;
  phone: string | null;
  address: string | null;
};

type Props = {
  services: Service[];
  barbers: Barber[];
  business: Business;
};

type Step = "service" | "barber" | "schedule" | "details" | "confirmed";

export function BookingWizard({ services, barbers, business }: Props) {
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getNextDays(1)[0]!);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [isPending, startTransition] = useTransition();

  const dates = getNextDays(7);

  // localStorage isn't available during SSR, so this can't be a lazy useState
  // initializer — it has to run post-mount in an effect.
  useEffect(() => {
    const saved = localStorage.getItem("eb_client_phone");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setClientPhone(saved);
    const savedName = localStorage.getItem("eb_client_name");
    if (savedName) setClientName(savedName);
  }, []);

  // Standard fetch-on-dependency-change pattern; the loading flag has to be
  // set here since it depends on the async call this same effect triggers.
  useEffect(() => {
    if (!selectedBarber || !selectedService) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSlots(true);
    setSelectedTime(null);
    getAvailableSlots(selectedBarber.id, selectedDate, selectedService.duration_minutes)
      .then(setSlots)
      .finally(() => setLoadingSlots(false));
  }, [selectedBarber, selectedDate, selectedService]);

  function handleSelectService(service: Service) {
    setSelectedService(service);
    setStep("barber");
  }

  function handleSelectBarber(barber: Barber) {
    setSelectedBarber(barber);
    setStep("schedule");
  }

  function handleSelectTime(time: string) {
    setSelectedTime(time);
    setStep("details");
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
        try {
          localStorage.setItem("eb_client_phone", clientPhone.trim());
          localStorage.setItem("eb_client_name", clientName.trim());
        } catch {}
        setStep("confirmed");
      } else {
        toast.error(result.error);
      }
    });
  }

  if (step === "confirmed" && selectedService && selectedBarber && selectedTime) {
    return (
      <ConfirmationView
        service={selectedService}
        barber={selectedBarber}
        date={selectedDate}
        time={selectedTime}
        business={business}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-7 pt-11 pb-7">
        <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
          Reservar turno
        </div>
        <h1 className="text-4xl font-bold mt-5 leading-none text-foreground">
          {business.name || "Exclusive"}<br />
          {business.name ? "" : "Barber Shop"}
        </h1>
        <div className="w-9 h-0.5 mt-4 bg-foreground" />
      </header>

      <div key={step} className="animate-in fade-in slide-in-from-right-2 duration-300">
        {step === "service" && (
          <ServiceStep services={services} onSelect={handleSelectService} />
        )}

        {step === "barber" && (
          <BarberStep
            barbers={barbers}
            onSelect={handleSelectBarber}
            onBack={() => setStep("service")}
          />
        )}

        {step === "schedule" && (
          <ScheduleStep
            dates={dates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            slots={slots}
            loading={loadingSlots}
            onSelectTime={handleSelectTime}
            onBack={() => setStep("barber")}
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
            onBack={() => setStep("schedule")}
          />
        )}
      </div>
    </div>
  );
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
      {services.map((service, i) => (
        <button
          key={service.id}
          onClick={() => onSelect(service)}
          className={cn(
            "w-full text-left flex justify-between items-baseline py-5.5 min-h-11",
            "transition-transform active:scale-[0.98]",
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
        </button>
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
          <button
            key={barber.id}
            onClick={() => onSelect(barber)}
            className="flex-1 rounded-2xl p-5 text-center border border-border transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center bg-border">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" className="stroke-foreground" strokeWidth="1.5" />
                <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" className="stroke-foreground" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-base font-semibold text-foreground">{barber.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScheduleStep({
  dates,
  selectedDate,
  onSelectDate,
  slots,
  loading,
  onSelectTime,
  onBack,
}: {
  dates: string[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  slots: string[];
  loading: boolean;
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
        {dates.map((date, i) => (
          <button
            key={date}
            onClick={() => onSelectDate(date)}
            className={cn(
              "shrink-0 text-sm font-medium px-5 py-2 rounded-lg min-h-11 flex items-center",
              "transition-transform active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              date === selectedDate
                ? "bg-foreground text-background font-semibold"
                : "border border-border text-muted-foreground"
            )}
          >
            {i === 0 ? "Hoy" : formatDate(date)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="rounded-lg h-11 w-full" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-sm py-8 text-center text-muted-foreground">
          No hay horarios disponibles este día
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((time) => (
            <button
              key={time}
              onClick={() => onSelectTime(time)}
              className="rounded-lg py-3 min-h-11 text-center text-sm font-medium border border-border text-foreground transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {formatTime(time)}
            </button>
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
  const isValid = clientName.trim().length >= 2 && /^0\d{9}$/.test(clientPhone.trim());

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
            value={clientName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Tu nombre"
            className="h-auto w-full px-4 py-3 rounded-xl text-sm bg-card"
          />
        </div>
        <div>
          <Label htmlFor="client-phone" className="block text-sm mb-1.5 font-medium text-foreground">
            Teléfono
          </Label>
          <Input
            id="client-phone"
            type="tel"
            value={clientPhone}
            onChange={(e) => onChangePhone(e.target.value)}
            placeholder="09XXXXXXXX"
            className="h-auto w-full px-4 py-3 rounded-xl text-sm bg-card"
          />
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

function ConfirmationView({
  service,
  barber,
  date,
  time,
  business,
}: {
  service: Service;
  barber: Barber;
  date: string;
  time: string;
  business: Business;
}) {
  const whatsappLink = buildWhatsAppLink({
    businessPhone: (business.phone ?? "").replace(/\D/g, ""),
    serviceName: service.name,
    barberName: barber.name,
    date,
    time,
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-7 bg-background animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-accent">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L19 7" className="stroke-accent-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold mb-2 text-foreground">
        Reserva confirmada
      </h2>

      <div className="w-full rounded-2xl p-6 mt-4 mb-8 bg-surface">
        <div className="text-lg font-semibold text-foreground">{service.name}</div>
        <div className="text-sm mt-2 text-muted-foreground">
          <div>💈 {barber.name}</div>
          <div>📅 {formatDate(date)}</div>
          <div>🕐 {formatTime(time)}</div>
        </div>
        <div className="text-xl font-bold mt-3 text-foreground">{formatPrice(service.price)}</div>
      </div>

      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full min-h-11 rounded-2xl py-4 text-center block font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ background: "#25D366" }}
      >
        Compartir por WhatsApp
      </a>

      <button
        onClick={() => window.location.reload()}
        className="mt-4 flex min-h-11 items-center justify-center px-2 text-sm font-medium text-muted-foreground transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
      >
        Nueva reserva
      </button>
    </div>
  );
}
