"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBarber } from "@/lib/staff";
import { appointmentRepo } from "@/lib/repositories/appointments";
import { barberScheduleRepo } from "@/lib/repositories/barber-schedules";
import { paymentRepo } from "@/lib/repositories/payments";
import { CompleteAppointmentSchema, CancelAppointmentSchema } from "@/lib/schemas/booking";
import { CreateBlockSchema, DeleteBlockSchema } from "@/lib/schemas/schedule";
import { canTransition, type ActionResult, type AppointmentStatus } from "@/lib/appointment-states";
import { formatTime } from "@/lib/utils";

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

export type AgendaBlock = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
};

export type AgendaDay = {
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
};

export async function getAgendaForDate(date: string): Promise<ActionResult<AgendaDay>> {
  const barber = await getCurrentBarber();
  if (!barber) {
    return {
      success: false,
      error: "No se encontró un barbero asociado a tu cuenta. Contacta al administrador.",
    };
  }

  try {
    const [appointments, blocks] = await Promise.all([
      appointmentRepo.getForAgenda(barber.id, date),
      barberScheduleRepo.getBlocksForDate(barber.id, date),
    ]);

    return {
      success: true,
      data: {
        appointments: appointments as unknown as AgendaAppointment[],
        blocks: blocks as AgendaBlock[],
      },
    };
  } catch {
    return { success: false, error: "No se pudo cargar la agenda" };
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

export async function createBlock(input: unknown): Promise<ActionResult<AgendaBlock>> {
  const parsed = CreateBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const barber = await getCurrentBarber();
  if (!barber) {
    return { success: false, error: "No se encontró un barbero asociado a tu cuenta" };
  }

  const { date, startTime, endTime } = parsed.data;

  try {
    // A block that silently covered a booked turn would hide a client who is coming.
    const conflicts = await appointmentRepo.getActiveOverlapping(
      barber.id,
      date,
      startTime,
      endTime
    );

    if (conflicts.length > 0) {
      return { success: false, error: describeConflicts(conflicts) };
    }

    const block = await barberScheduleRepo.createBlock({
      barberId: barber.id,
      date,
      startTime,
      endTime,
    });

    revalidatePath("/agenda");
    return { success: true, data: block as AgendaBlock };
  } catch {
    return { success: false, error: "No se pudo crear el bloqueo. Intenta de nuevo." };
  }
}

export async function deleteBlock(input: unknown): Promise<ActionResult<{ blockId: string }>> {
  const parsed = DeleteBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const barber = await getCurrentBarber();
  if (!barber) {
    return { success: false, error: "No se encontró un barbero asociado a tu cuenta" };
  }

  const { blockId } = parsed.data;

  try {
    const deleted = await barberScheduleRepo.deleteBlockForBarber(blockId, barber.id);
    if (!deleted) {
      return { success: false, error: "Ese bloqueo ya no existe" };
    }

    revalidatePath("/agenda");
    return { success: true, data: { blockId } };
  } catch {
    return { success: false, error: "No se pudo eliminar el bloqueo. Intenta de nuevo." };
  }
}

function describeConflicts(
  conflicts: { start_time: string; clients: { name: string } | null }[]
): string {
  const first = conflicts[0];
  if (conflicts.length === 1 && first) {
    const who = first.clients?.name ?? "un cliente";
    return `Ya tienes un turno con ${who} a las ${formatTime(first.start_time)}. Cancélalo antes de bloquear ese horario.`;
  }

  const times = conflicts.map((c) => formatTime(c.start_time)).join(", ");
  return `Ya tienes ${conflicts.length} turnos en ese rango (${times}). Cancélalos antes de bloquear ese horario.`;
}
