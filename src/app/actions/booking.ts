"use server";

import { CreateAppointmentSchema } from "@/lib/schemas/booking";
import { appointmentRepo } from "@/lib/repositories/appointments";
import { clientRepo } from "@/lib/repositories/clients";
import { addMinutesToTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";

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

  const [{ data: services }, { data: barbers }, { data: business }] =
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
    ]);

  return {
    services: services ?? [],
    barbers: barbers ?? [],
    business: business ?? { name: "", phone: "", address: "" },
  };
}

export async function getAvailableSlots(
  barberId: string,
  date: string,
  durationMinutes: number
) {
  return appointmentRepo.getAvailableSlots(barberId, date, durationMinutes);
}
