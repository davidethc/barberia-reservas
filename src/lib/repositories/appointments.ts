import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID, SLOT_INTERVAL_MINUTES } from "@/lib/constants";

export const appointmentRepo = {
  async getByBarberAndDate(barberId: string, date: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("*, services(name, duration_minutes, price), clients(name, phone)")
      .eq("barber_id", barberId)
      .eq("date", date)
      .not("status", "in", '("cancelled","no_show")')
      .order("start_time");

    if (error) throw error;
    return data;
  },

  async getAvailableSlots(barberId: string, date: string, durationMinutes: number) {
    const supabase = await createClient();

    const { data: hours } = await supabase
      .from("business_hours")
      .select("open_time, close_time, is_open")
      .eq("business_id", BUSINESS_ID)
      .eq("day_of_week", new Date(date + "T12:00:00").getDay())
      .single();

    if (!hours?.is_open) return [];

    const [{ data: booked }, { data: blocks }] = await Promise.all([
      supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("barber_id", barberId)
        .eq("date", date)
        .not("status", "in", '("cancelled","no_show")'),
      supabase
        .from("barber_schedules")
        .select("start_time, end_time")
        .eq("barber_id", barberId)
        .eq("date", date)
        .eq("type", "block"),
    ]);

    const slots: string[] = [];
    const openMinutes = timeToMinutes(hours.open_time);
    const closeMinutes = timeToMinutes(hours.close_time);

    for (let m = openMinutes; m + durationMinutes <= closeMinutes; m += SLOT_INTERVAL_MINUTES) {
      const slotStart = minutesToTime(m);
      const slotEnd = minutesToTime(m + durationMinutes);

      const isBooked = (booked ?? []).some(
        (b) => b.start_time < slotEnd && b.end_time > slotStart
      );
      const isBlocked = (blocks ?? []).some(
        (b) => b.start_time < slotEnd && b.end_time > slotStart
      );

      if (!isBooked && !isBlocked) {
        slots.push(slotStart);
      }
    }

    return slots;
  },

  async create(data: {
    barberId: string;
    serviceId: string;
    clientId: string;
    date: string;
    startTime: string;
    endTime: string;
    source?: string;
  }) {
    const supabase = await createClient();
    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        business_id: BUSINESS_ID,
        barber_id: data.barberId,
        service_id: data.serviceId,
        client_id: data.clientId,
        date: data.date,
        start_time: data.startTime,
        end_time: data.endTime,
        source: data.source ?? "online",
      })
      .select()
      .single();

    if (error) throw error;
    return appointment;
  },

  async updateStatus(id: string, status: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
