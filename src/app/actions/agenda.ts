"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { barberRepo } from "@/lib/repositories/barbers";
import { appointmentRepo } from "@/lib/repositories/appointments";
import { paymentRepo } from "@/lib/repositories/payments";
import { CompleteAppointmentSchema, CancelAppointmentSchema } from "@/lib/schemas/booking";
import { canTransition, type ActionResult, type AppointmentStatus } from "@/lib/appointment-states";

export type AgendaAppointment = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  source: string;
  notes: string | null;
  services: { name: string; duration_minutes: number; price: number } | null;
  clients: { name: string; phone: string } | null;
};

async function getCurrentBarber() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return barberRepo.getByUserId(user.id);
}

export async function getAppointmentsForDate(
  date: string
): Promise<ActionResult<AgendaAppointment[]>> {
  const barber = await getCurrentBarber();
  if (!barber) {
    return {
      success: false,
      error: "No se encontró un barbero asociado a tu cuenta. Contacta al administrador.",
    };
  }

  try {
    const appointments = await appointmentRepo.getForAgenda(barber.id, date);
    return { success: true, data: appointments as unknown as AgendaAppointment[] };
  } catch {
    return { success: false, error: "No se pudieron cargar los turnos" };
  }
}

export async function completeAppointment(
  input: unknown
): Promise<ActionResult<{ appointmentId: string }>> {
  const parsed = CompleteAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const barber = await getCurrentBarber();
  if (!barber) {
    return { success: false, error: "No se encontró un barbero asociado a tu cuenta" };
  }

  const { appointmentId, paymentMethod, amount } = parsed.data;
  const supabase = await createClient();

  // RLS does not scope appointments by barber, so the ownership check happens here.
  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .eq("barber_id", barber.id)
    .single();

  if (fetchError || !appointment) {
    return { success: false, error: "Turno no encontrado" };
  }

  if (!canTransition(appointment.status as AppointmentStatus, "completed")) {
    return { success: false, error: "Este turno ya no se puede completar" };
  }

  try {
    await appointmentRepo.updateStatusForBarber(appointmentId, barber.id, "completed");

    try {
      await paymentRepo.create({
        appointmentId,
        barberId: barber.id,
        amount,
        paymentMethod,
        commissionPct: barber.commission_pct,
      });
    } catch (paymentError) {
      // Best-effort compensation: don't leave the appointment marked completed
      // with no payment on record.
      await appointmentRepo.updateStatusForBarber(appointmentId, barber.id, "pending");
      throw paymentError;
    }

    revalidatePath("/agenda");
    return { success: true, data: { appointmentId } };
  } catch {
    return { success: false, error: "No se pudo completar el turno. Intenta de nuevo." };
  }
}

export async function cancelAppointment(
  input: unknown
): Promise<ActionResult<{ appointmentId: string }>> {
  const parsed = CancelAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const barber = await getCurrentBarber();
  if (!barber) {
    return { success: false, error: "No se encontró un barbero asociado a tu cuenta" };
  }

  const { appointmentId, reason } = parsed.data;
  const supabase = await createClient();

  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .eq("barber_id", barber.id)
    .single();

  if (fetchError || !appointment) {
    return { success: false, error: "Turno no encontrado" };
  }

  if (!canTransition(appointment.status as AppointmentStatus, reason)) {
    return { success: false, error: "Este turno ya no se puede modificar" };
  }

  try {
    await appointmentRepo.updateStatusForBarber(appointmentId, barber.id, reason);
    revalidatePath("/agenda");
    return { success: true, data: { appointmentId } };
  } catch {
    return { success: false, error: "No se pudo actualizar el turno. Intenta de nuevo." };
  }
}
