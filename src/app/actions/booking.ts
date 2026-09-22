"use server";

import { unstable_cache } from "next/cache";
import {
  CreateAnyBarberAppointmentSchema,
  CreateAppointmentSchema,
  LoyaltyPhoneSchema,
} from "@/lib/schemas/booking";
import { appointmentRepo } from "@/lib/repositories/appointments";
import { addMinutesToTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { createClient as createPublicClient } from "@/lib/supabase/client";
import { BUSINESS_ID, LUNCH_END, LUNCH_START } from "@/lib/constants";
import { BOOKING_DATA_TAG } from "@/lib/cache-tags";
import { DEFAULT_LOYALTY_CYCLE, toLoyaltyProgress, type LoyaltyProgress } from "@/lib/loyalty";
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

/**
 * Services, bookable barbers, business info and hours change rarely (an admin editing a
 * panel), so they're cached across requests instead of hitting Postgres on every visit to
 * the public wizard. `createPublicClient` (anon key, no session) is used here rather than
 * the cookies()-based server client — `unstable_cache` cannot read cookies() inside its
 * scope — which is fine since none of these reads are user-specific.
 */
const getCachedBookingData = unstable_cache(
  async () => {
    const supabase = createPublicClient();

    const [{ data: services }, { data: barbers }, { data: business }, { data: hours }] =
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
        supabase.rpc("public_bookable_barbers", { p_business_id: BUSINESS_ID }),
        supabase
          .from("businesses")
          .select("name, phone, address, loyalty_enabled, loyalty_cycle")
          .eq("id", BUSINESS_ID)
          .single(),
        supabase
          .from("business_hours")
          .select("day_of_week, is_open, open_time, close_time")
          .eq("business_id", BUSINESS_ID)
          .order("day_of_week"),
      ]);

    return {
      services: services ?? [],
      barbers: barbers ?? [],
      business: business ?? {
        name: "",
        phone: "",
        address: "",
        loyalty_enabled: false,
        loyalty_cycle: DEFAULT_LOYALTY_CYCLE,
      },
      // Fails open: if the hours can't be read we offer every day rather than hiding
      // days the shop is actually working.
      openDays: hours ? hours.filter((h) => h.is_open).map((h) => h.day_of_week) : [0, 1, 2, 3, 4, 5, 6],
      hours: hours ?? [],
    };
  },
  // v3: the Data Cache outlives a deploy, and a v2 entry has no loyalty fields.
  ["public-booking-data-v3"],
  { revalidate: 45, tags: [BOOKING_DATA_TAG] }
);

export async function getBookingData() {
  const cached = await getCachedBookingData();

  return {
    ...cached,
    // Resolved on the shop's clock here rather than in the browser, and outside the cache
    // since it depends on "now" — the strip means the same thing on the server render and
    // after hydration.
    dates: getShopDates(DAYS_OFFERED),
  };
}

/**
 * A turn belongs to a stretch only if all of its minutes do. Half-open, so a service
 * ending exactly at 12:00 counts as morning and one starting exactly at 13:00 as afternoon.
 */
function crossesLunch(startTime: string, durationMinutes: number): boolean {
  const endTime = addMinutesToTime(startTime, durationMinutes);
  return startTime < LUNCH_END && endTime > LUNCH_START;
}

/** The availability function knows the business hours but not the lunch break, so the break is carved out here. */
async function bookableSlots(barberId: string, date: string, durationMinutes: number): Promise<string[]> {
  const slots = await appointmentRepo.getAvailableSlots(barberId, date, durationMinutes);
  return slots.filter((slot) => !crossesLunch(slot, durationMinutes));
}

async function bookableBarberIds(): Promise<string[]> {
  const { barbers } = await getCachedBookingData();
  return barbers.map((b: { id: string }) => b.id);
}

export async function getAvailableSlots(
  barberId: string,
  date: string,
  durationMinutes: number
): Promise<{ slots: string[]; pastBefore: string | null }> {
  const bookable = await bookableSlots(barberId, date, durationMinutes);

  // Slots that already passed stay in the payload instead of being dropped: the wizard
  // shows the whole day and strikes them through. Hiding them made a same-day afternoon
  // read as if the shop never opened in the morning. `pastBefore` is the server's clock,
  // so the client never has to trust its own. The RPC still rejects a too-soon booking.
  const pastBefore =
    date === shopToday() ? addMinutesToTime(shopNowTime(), LEAD_MINUTES) : null;

  return { slots: bookable, pastBefore };
}

/** "Cualquiera disponible": a slot is offered when at least one bookable barber has it free. */
export async function getAnyBarberSlots(
  date: string,
  durationMinutes: number
): Promise<{ slots: string[]; pastBefore: string | null }> {
  const ids = await bookableBarberIds();
  const perBarber = await Promise.all(ids.map((id) => bookableSlots(id, date, durationMinutes)));
  const slots = [...new Set(perBarber.flat())].sort();
  const pastBefore =
    date === shopToday() ? addMinutesToTime(shopNowTime(), LEAD_MINUTES) : null;
  return { slots, pastBefore };
}

/**
 * Books with whichever barber is free at that time. Candidates are shuffled so "any" spreads
 * turns across the team instead of always filling the first barber; a candidate who loses the
 * slot to a concurrent booking is skipped and the next one is tried.
 */
export async function createAppointmentAnyBarber(
  input: unknown
): Promise<ActionResult<{ appointmentId: string; barberId: string }>> {
  const parsed = CreateAnyBarberAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }
  const { serviceId, date, startTime, clientName, clientPhone } = parsed.data;

  const { services } = await getCachedBookingData();
  const service = services.find((s: { id: string }) => s.id === serviceId);
  if (!service) return { success: false, error: BOOKING_ERROR_MESSAGES.BOOKING_SERVICE_NOT_FOUND! };

  const ids = await bookableBarberIds();
  const free = (
    await Promise.all(
      ids.map(async (id) => ((await bookableSlots(id, date, service.duration_minutes)).some((s) => s.slice(0, 5) === startTime) ? id : null))
    )
  ).filter((id): id is string => id !== null);

  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [free[i], free[j]] = [free[j]!, free[i]!];
  }

  for (const barberId of free) {
    const result = await createAppointment({ serviceId, barberId, date, startTime, clientName, clientPhone });
    if (result.success) return { success: true, data: { appointmentId: result.data.appointmentId, barberId } };
    if (result.error !== BOOKING_ERROR_MESSAGES.BOOKING_SLOT_TAKEN) return result;
  }

  return { success: false, error: BOOKING_ERROR_MESSAGES.BOOKING_SLOT_TAKEN! };
}

/**
 * The stamp card for whoever is typing this phone. Deliberately outside `unstable_cache`:
 * it is per client, not shared. `public_loyalty_progress` answers only numbers, never a
 * name. An unknown phone reads like a client with no stamps, but a phone with stamps does
 * reveal it belongs to a client and their paid-visit count; the owner accepted that (only
 * numbers, no personal data). Any failure is just "no card shown" — a
 * reward that could not be read must never stand in the way of a booking.
 */
export async function getLoyaltyProgress(
  phone: unknown
): Promise<ActionResult<LoyaltyProgress>> {
  const parsed = LoyaltyPhoneSchema.safeParse(phone);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("public_loyalty_progress", {
      p_business_id: BUSINESS_ID,
      p_phone: parsed.data,
    });

    const progress = error ? null : toLoyaltyProgress(data?.[0]);
    if (!progress) return { success: false, error: "No se pudo leer la tarjeta" };
    return { success: true, data: progress };
  } catch {
    return { success: false, error: "No se pudo leer la tarjeta" };
  }
}
