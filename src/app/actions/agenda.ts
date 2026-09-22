"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBarber } from "@/lib/staff";
import { appointmentRepo } from "@/lib/repositories/appointments";
import { barberScheduleRepo } from "@/lib/repositories/barber-schedules";
import { paymentRepo } from "@/lib/repositories/payments";
import { clientRepo } from "@/lib/repositories/clients";
import type { LoyaltyProgress } from "@/lib/loyalty";
import { CompleteAppointmentSchema, CancelAppointmentSchema } from "@/lib/schemas/booking";
import { CreateBlockSchema, DeleteBlockSchema } from "@/lib/schemas/schedule";
import { canTransition, type ActionResult, type AppointmentStatus } from "@/lib/appointment-states";
import { formatTime } from "@/lib/utils";
import { addDays, getLocalDayWindow } from "@/lib/shop-date";

export type AgendaAppointment = {
  id: string;
  client_id: string;
  is_reward: boolean;
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

export type DaySummary = {
  turnos: number;
  cobrado: number;
  comision: number;
  teQueda: number;
};

export type AgendaDay = {
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  summary: DaySummary;
  /** Stamp card per client_id, only for the day's pending turns. Empty when unreadable. */
  loyalty: Record<string, LoyaltyProgress>;
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
    const supabase = await createClient();
    const [{ from, to }, appointments, blocks] = await Promise.all([
      Promise.resolve(getLocalDayWindow(date)),
      appointmentRepo.getForAgenda(barber.id, date),
      barberScheduleRepo.getBlocksForDate(barber.id, date),
    ]);

    // What the barber already collected today (RLS only exposes their own rows).
    const { data: payments } = await supabase
      .from("payments")
      .select("amount, commission_amount")
      .eq("barber_id", barber.id)
      .gte("created_at", from)
      .lt("created_at", to);

    const totals = (payments ?? []).reduce(
      (acc, p) => ({
        turnos: acc.turnos + 1,
        cobrado: acc.cobrado + (Number(p.amount) || 0),
        comision: acc.comision + (Number(p.commission_amount) || 0),
      }),
      { turnos: 0, cobrado: 0, comision: 0 }
    );

    // One call for the whole day. A failure only hides the "corte gratis" badge; the agenda
    // itself must load regardless.
    const pendingClientIds = (appointments ?? [])
      .filter((a) => a.status === "pending")
      .map((a) => a.client_id);
    const loyalty = await clientRepo.getLoyaltyForClients(pendingClientIds).catch(() => ({}));

    const cobrado = Math.round(totals.cobrado * 100) / 100;
    const comision = Math.round(totals.comision * 100) / 100;

    return {
      success: true,
      data: {
        appointments: appointments as unknown as AgendaAppointment[],
        blocks: blocks as AgendaBlock[],
        summary: {
          turnos: totals.turnos,
          cobrado,
          comision,
          teQueda: Math.round((cobrado - comision) * 100) / 100,
        },
        loyalty,
      },
    };
  } catch {
    return { success: false, error: "No se pudo cargar la agenda" };
  }
}

export type AgendaRangeDay = {
  date: string;
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
};

const SHOP_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A month grid is 42 days and the guard rejects anything past two months. */
const MAX_RANGE_DAYS = 62;

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to && dates.length <= MAX_RANGE_DAYS) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/**
 * Calendar data for the week/month views: every day in the range comes back, empty
 * days included, so the client can render a stable grid without filling gaps.
 */
export async function getAgendaRange(input: {
  from: string;
  to: string;
}): Promise<ActionResult<{ days: AgendaRangeDay[] }>> {
  const barber = await getCurrentBarber();
  if (!barber) {
    return {
      success: false,
      error: "No se encontró un barbero asociado a tu cuenta. Contacta al administrador.",
    };
  }

  const from = input?.from;
  const to = input?.to;
  if (
    typeof from !== "string" ||
    typeof to !== "string" ||
    !SHOP_DATE_PATTERN.test(from) ||
    !SHOP_DATE_PATTERN.test(to) ||
    to < from ||
    eachDate(from, to).length > MAX_RANGE_DAYS
  ) {
    return { success: false, error: "Datos inválidos" };
  }

  try {
    const [appointments, blocks] = await Promise.all([
      appointmentRepo.getForRange(barber.id, from, to),
      barberScheduleRepo.getBlocksForRange(barber.id, from, to),
    ]);

    const days: AgendaRangeDay[] = eachDate(from, to).map((date) => ({
      date,
      appointments: [],
      blocks: [],
    }));
    const byDate = new Map(days.map((day) => [day.date, day]));

    for (const appointment of appointments ?? []) {
      byDate.get(appointment.date)?.appointments.push(appointment as unknown as AgendaAppointment);
    }
    for (const block of blocks ?? []) {
      byDate.get(block.date)?.blocks.push(block as AgendaBlock);
    }

    return { success: true, data: { days } };
  } catch {
    return { success: false, error: "No se pudo cargar la agenda" };
  }
}

/**
 * `complete_appointment` signals each refusal with a token in the raised message, so the
 * barber gets the same wording the two-step version produced instead of one catch-all error.
 */
const COMPLETE_ERROR_MESSAGES: Record<string, string> = {
  COMPLETE_NOT_STAFF: "No se encontró un barbero asociado a tu cuenta",
  // Someone else's turn is indistinguishable from a turn that is gone, by design.
  COMPLETE_NOT_FOUND: "Turno no encontrado",
  COMPLETE_NOT_PENDING: "Este turno ya no se puede completar",
  COMPLETE_INVALID_INPUT: "Datos inválidos",
  COMPLETE_REWARD_NOT_ELIGIBLE: "Este cliente ya no tiene un corte gratis disponible.",
};

function completeErrorMessage(error: unknown, fallback: string): string {
  // PostgrestError is a plain object in some supabase-js builds, so don't assume an Error.
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  for (const [token, spanish] of Object.entries(COMPLETE_ERROR_MESSAGES)) {
    if (message.includes(token)) return spanish;
  }
  return fallback;
}

/**
 * Ownership, the state transition, the payment and the commission are all settled inside
 * `complete_appointment`. Doing it there rather than here is what makes the status change
 * and the payment one transaction: the old status-then-insert pair could leave a payment on
 * a turn it had just reverted to pending, and the retry then hit the UNIQUE on
 * `appointment_id` forever.
 */
export async function completeAppointment(
  input: unknown
): Promise<ActionResult<{ appointmentId: string }>> {
  const parsed = CompleteAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { appointmentId } = parsed.data;

  try {
    await paymentRepo.completeAppointment(parsed.data);
    revalidatePath("/agenda");
    return { success: true, data: { appointmentId } };
  } catch (error) {
    return {
      success: false,
      error: completeErrorMessage(error, "No se pudo completar el turno. Intenta de nuevo."),
    };
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

    // Sin esto, tocar "Todo el día" dos veces deja dos bloqueos idénticos y borrar
    // uno de ellos deja el día bloqueado sin nada visible que lo explique.
    const existing = await barberScheduleRepo.getOverlappingBlocks(
      barber.id,
      date,
      startTime,
      endTime
    );

    if (existing.length > 0) {
      const first = existing[0]!;
      return {
        success: false,
        error: `Ya tienes bloqueado de ${formatTime(first.start_time)} a ${formatTime(first.end_time)}.`,
      };
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
