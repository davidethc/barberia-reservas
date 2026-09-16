"use server";

import { CreateAppointmentSchema } from "@/lib/schemas/booking";
import { appointmentRepo } from "@/lib/repositories/appointments";
import { businessHoursRepo } from "@/lib/repositories/business-hours";
import { clientRepo } from "@/lib/repositories/clients";
import { addMinutesToTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";
import {
  getShopDates,
  shopNowTime,
  shopToday,
} from "@/components/booking/date-helpers";

/** Minimum notice for a same-day turn, so nobody books a slot already passing. */
const LEAD_MINUTES = 15;

const DAYS_OFFERED = 7;

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createAppointment(
  input: unknown
): Promise<ActionResult<{ appointmentId: string }>> {
  const parsed = CreateAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { serviceId, barberId, date, startTime, clientName, clientPhone } =
    parsed.data;

  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .single();

  if (!service) {
    return { success: false, error: "Servicio no encontrado" };
  }

  const endTime = addMinutesToTime(startTime, service.duration_minutes);

  const slots = await appointmentRepo.getAvailableSlots(
    barberId,
    date,
    service.duration_minutes
  );
  if (!slots.includes(startTime)) {
    return {
      success: false,
      error: "Este horario ya fue reservado. Elige otro.",
    };
  }

  try {
    const client = await clientRepo.findOrCreate(clientName, clientPhone);

    const appointment = await appointmentRepo.create({
      barberId,
      serviceId,
      clientId: client.id,
      date,
      startTime,
      endTime,
      source: "online",
    });

    return { success: true, data: { appointmentId: appointment.id } };
  } catch {
    return {
      success: false,
      error: "No se pudo crear la reserva. Intenta de nuevo.",
    };
  }
}

export async function getBookingData() {
  const supabase = await createClient();

  const [{ data: services }, { data: barbers }, { data: business }, openDays] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", BUSINESS_ID)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("barbers")
        .select("id, name, photo_url")
        .eq("business_id", BUSINESS_ID)
        .eq("is_active", true),
      supabase
        .from("businesses")
        .select("name, phone, address")
        .eq("id", BUSINESS_ID)
        .single(),
      getOpenDays(),
    ]);

  return {
    services: services ?? [],
    barbers: barbers ?? [],
    business: business ?? { name: "", phone: "", address: "" },
    openDays,
    // Resolved on the shop's clock here rather than in the browser, so the
    // strip means the same thing on the server render and after hydration.
    dates: getShopDates(DAYS_OFFERED),
  };
}

/**
 * Weekdays (0 = Sunday) the shop opens. Fails open: if the hours can't be read
 * we offer every day rather than hiding days the shop is actually working.
 */
async function getOpenDays(): Promise<number[]> {
  try {
    const hours = await businessHoursRepo.getAll();
    return (hours ?? [])
      .filter((h) => h.is_open)
      .map((h) => h.day_of_week);
  } catch {
    return [0, 1, 2, 3, 4, 5, 6];
  }
}

export async function getAvailableSlots(
  barberId: string,
  date: string,
  durationMinutes: number
) {
  const slots = await appointmentRepo.getAvailableSlots(
    barberId,
    date,
    durationMinutes
  );

  // Offering a slot that already passed is a guaranteed dead end for the client.
  if (date !== shopToday()) return slots;
  const cutoff = addMinutesToTime(shopNowTime(), LEAD_MINUTES);
  return slots.filter((slot) => slot >= cutoff);
}
