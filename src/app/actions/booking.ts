"use server";

import { CreateAppointmentSchema } from "@/lib/schemas/booking";
import { appointmentRepo } from "@/lib/repositories/appointments";
import { barberRepo } from "@/lib/repositories/barbers";
import { businessHoursRepo } from "@/lib/repositories/business-hours";
import { addMinutesToTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";
import {
  getShopDates,
  shopNowTime,
  shopToday,
} from "@/lib/shop-date";

/** Minimum notice for a same-day turn, so nobody books a slot already passing. */
const LEAD_MINUTES = 15;

const DAYS_OFFERED = 7;

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * The booking function signals each refusal with a token in the raised message, so a
 * client who lost the slot gets told that instead of one catch-all error.
 */
const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  BOOKING_SLOT_TAKEN: "Este horario ya fue reservado. Elige otro.",
  BOOKING_SERVICE_NOT_FOUND: "Ese servicio ya no está disponible",
  BOOKING_BARBER_NOT_FOUND: "Ese barbero ya no está disponible",
  BOOKING_BARBER_NOT_BOOKABLE: "Ese barbero no está recibiendo reservas. Elige otro.",
  BOOKING_PAST_DATE: "Esa fecha ya pasó. Elige otra.",
  BOOKING_TOO_SOON: "Ese horario está por empezar. Elige uno más tarde.",
  BOOKING_TOO_FAR: "Esa fecha está demasiado lejos. Elige otra.",
  BOOKING_INVALID_INPUT: "Datos inválidos",
};

function bookingErrorMessage(error: unknown, fallback: string): string {
  // PostgrestError is a plain object in some supabase-js builds, so don't assume an Error.
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  for (const [token, spanish] of Object.entries(BOOKING_ERROR_MESSAGES)) {
    if (message.includes(token)) return spanish;
  }
  return fallback;
}

/**
 * Availability, business hours, lead time and the client record are all resolved inside
 * `create_public_appointment`. Doing it there rather than here is what lets the anon role
 * lose its INSERT grant on `appointments` and `clients` — with a direct grant, anyone
 * holding the publishable key could write rows that skipped every check below. It also
 * makes the check and the insert one transaction, so two clients racing for the last slot
 * can no longer both win.
 */
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
  const { data: appointmentId, error } = await supabase.rpc(
    "create_public_appointment",
    {
      p_service_id: serviceId,
      p_barber_id: barberId,
      p_date: date,
      p_start_time: startTime,
      p_client_name: clientName,
      p_client_phone: clientPhone,
    }
  );

  if (error || !appointmentId) {
    return {
      success: false,
      error: bookingErrorMessage(error, "No se pudo crear la reserva. Intenta de nuevo."),
    };
  }

  return { success: true, data: { appointmentId } };
}

export async function getBookingData() {
  const supabase = await createClient();

  const [{ data: services }, barbers, { data: business }, openDays] =
    await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", BUSINESS_ID)
        .eq("is_active", true)
        .order("sort_order"),
      // Only barbers with an account: /agenda shows the signed-in barber's own day and
      // nothing else, so a turn booked with an unlinked barber is one nobody can ever open.
      // The filter has to happen in Postgres — `user_id` is not granted to the anon role.
      barberRepo.getBookable().catch(() => []),
      supabase
        .from("businesses")
        .select("name, phone, address")
        .eq("id", BUSINESS_ID)
        .single(),
      getOpenDays(),
    ]);

  return {
    services: services ?? [],
    barbers,
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
