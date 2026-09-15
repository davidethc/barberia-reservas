"use client";

import { useState, useTransition, useEffect } from "react";
import { createAppointment, getAvailableSlots } from "@/app/actions/booking";
import { formatPrice, formatDate, formatTime, getNextDays, buildWhatsAppLink } from "@/lib/utils";

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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  const dates = getNextDays(7);

  useEffect(() => {
    const saved = localStorage.getItem("eb_client_phone");
    if (saved) setClientPhone(saved);
    const savedName = localStorage.getItem("eb_client_name");
    if (savedName) setClientName(savedName);
  }, []);

  useEffect(() => {
    if (!selectedBarber || !selectedService) return;
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
    setError(null);

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
        setAppointmentId(result.data.appointmentId);
        setStep("confirmed");
      } else {
        setError(result.error);
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
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <header className="px-7 pt-11 pb-7">
        <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#bbb" }}>
          Reservar turno
        </div>
        <h1 className="text-4xl font-bold mt-5 leading-none" style={{ color: "#1a1a1a" }}>
          {business.name || "Exclusive"}<br />
          {business.name ? "" : "Barber Shop"}
        </h1>
        <div className="w-9 h-0.5 mt-4" style={{ background: "#1a1a1a" }} />
      </header>

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
          error={error}
          onBack={() => setStep("schedule")}
        />
      )}
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
          className="w-full text-left flex justify-between items-baseline py-5.5"
          style={{
            borderBottom: i < services.length - 1 ? "1px solid #ececea" : "none",
          }}
        >
          <div>
            <div className="text-base font-semibold" style={{ color: "#1a1a1a" }}>
              {service.name}
            </div>
            <div className="text-sm mt-1" style={{ color: "#b0b0a8" }}>
              {service.duration_minutes} min
            </div>
          </div>
          <div className="text-xl font-bold" style={{ color: "#1a1a1a" }}>
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
      <button onClick={onBack} className="text-sm mb-4" style={{ color: "#b0b0a8" }}>
        ← Servicios
      </button>
      <div className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#bbb" }}>
        Barbero
      </div>
      <div className="flex gap-3.5">
        {barbers.map((barber) => (
          <button
            key={barber.id}
            onClick={() => onSelect(barber)}
            className="flex-1 rounded-2xl p-5 text-center"
            style={{ border: "1px solid #e0e0dc" }}
          >
            <div
              className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: "#ececea" }}
            >
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" stroke="#1a1a1a" strokeWidth="1.5" />
                <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-base font-semibold">{barber.name}</div>
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
      <button onClick={onBack} className="text-sm mb-4" style={{ color: "#b0b0a8" }}>
        ← Barbero
      </button>
      <div className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#bbb" }}>
        Horario
      </div>
      <div className="flex gap-2 mb-3.5 overflow-x-auto pb-1">
        {dates.map((date, i) => (
          <button
            key={date}
            onClick={() => onSelectDate(date)}
            className="shrink-0 text-sm font-medium px-5 py-2 rounded-lg"
            style={
              date === selectedDate
                ? { background: "#1a1a1a", color: "#fafaf8", fontWeight: 600 }
                : { border: "1px solid #e0e0dc", color: "#b0b0a8" }
            }
          >
            {i === 0 ? "Hoy" : formatDate(date)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm py-8 text-center" style={{ color: "#b0b0a8" }}>
          Cargando horarios...
        </div>
      ) : slots.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: "#b0b0a8" }}>
          No hay horarios disponibles este día
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((time) => (
            <button
              key={time}
              onClick={() => onSelectTime(time)}
              className="rounded-lg py-3 text-center text-sm font-medium"
              style={{ border: "1px solid #e0e0dc", color: "#1a1a1a" }}
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
  error,
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
  error: string | null;
  onBack: () => void;
}) {
  const isValid = clientName.trim().length >= 2 && /^0\d{9}$/.test(clientPhone.trim());

  return (
    <div className="px-7 pb-8">
      <button onClick={onBack} className="text-sm mb-4" style={{ color: "#b0b0a8" }}>
        ← Horario
      </button>

      <div className="rounded-2xl p-5 mb-6" style={{ background: "#f3f3f0" }}>
        <div className="text-base font-semibold">{service.name}</div>
        <div className="text-sm mt-1" style={{ color: "#b0b0a8" }}>
          {barber.name} · {formatDate(date)} · {formatTime(time)}
        </div>
        <div className="text-lg font-bold mt-2">{formatPrice(service.price)}</div>
      </div>

      <div className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#bbb" }}>
        Tus datos
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: "#1a1a1a" }}>
            Nombre
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Tu nombre"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ border: "1px solid #e0e0dc", background: "#fff" }}
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5 font-medium" style={{ color: "#1a1a1a" }}>
            Teléfono
          </label>
          <input
            type="tel"
            value={clientPhone}
            onChange={(e) => onChangePhone(e.target.value)}
            placeholder="09XXXXXXXX"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ border: "1px solid #e0e0dc", background: "#fff" }}
          />
        </div>
      </div>

      {error && (
        <div className="text-sm mb-4 px-4 py-3 rounded-xl" style={{ background: "#fef2f2", color: "#dc2626" }}>
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={!isValid || isPending}
        className="w-full rounded-2xl py-5 text-center cursor-pointer disabled:opacity-50"
        style={{ background: "#1a1a1a", color: "#fafaf8" }}
      >
        <div className="text-base font-semibold">
          {isPending ? "Reservando..." : "Confirmar reserva"}
        </div>
      </button>
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
    <div className="min-h-screen flex flex-col items-center justify-center px-7" style={{ background: "#fafaf8" }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: "#c9a96e" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold mb-2" style={{ color: "#1a1a1a" }}>
        Reserva confirmada
      </h2>

      <div className="w-full rounded-2xl p-6 mt-4 mb-8" style={{ background: "#f3f3f0" }}>
        <div className="text-lg font-semibold">{service.name}</div>
        <div className="text-sm mt-2" style={{ color: "#b0b0a8" }}>
          <div>💈 {barber.name}</div>
          <div>📅 {formatDate(date)}</div>
          <div>🕐 {formatTime(time)}</div>
        </div>
        <div className="text-xl font-bold mt-3">{formatPrice(service.price)}</div>
      </div>

      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full rounded-2xl py-4 text-center block font-semibold"
        style={{ background: "#25D366", color: "#fff" }}
      >
        Compartir por WhatsApp
      </a>

      <button
        onClick={() => window.location.reload()}
        className="mt-4 text-sm font-medium"
        style={{ color: "#b0b0a8" }}
      >
        Nueva reserva
      </button>
    </div>
  );
}
