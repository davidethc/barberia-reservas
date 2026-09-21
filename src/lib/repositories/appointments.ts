import { createClient } from "@/lib/supabase/server";

export const appointmentRepo = {
  /**
   * Computed inside Postgres so the public wizard needs no read access to the
   * appointment book or to anyone's blocks — the anon role has neither.
   */
  async getAvailableSlots(barberId: string, date: string, durationMinutes: number) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_available_slots", {
      p_barber_id: barberId,
      p_date: date,
      p_duration_minutes: durationMinutes,
    });

    if (error) throw error;
    return data ?? [];
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

  /** All appointments (any status) for a barber on a given date — used by the agenda view. */
  async getForAgenda(barberId: string, date: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("*, services(name, duration_minutes, price), clients(name, phone)")
      .eq("barber_id", barberId)
      .eq("date", date)
      .order("start_time");

    if (error) throw error;
    return data;
  },

  /** Same shape as `getForAgenda`, but for the week/month calendar views. */
  async getForRange(barberId: string, from: string, to: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("*, services(name, duration_minutes, price), clients(name, phone)")
      .eq("barber_id", barberId)
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("start_time");

    if (error) throw error;
    return data;
  },

  /**
   * Active appointments a time range would cover. Half-open overlap (`start < rangeEnd`
   * and `end > rangeStart`) so a turn ending exactly when the range starts is not a
   * conflict. Used to stop a block from hiding a client who is actually coming.
   */
  async getActiveOverlapping(
    barberId: string,
    date: string,
    startTime: string,
    endTime: string
  ) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("id, start_time, end_time, clients(name)")
      .eq("barber_id", barberId)
      .eq("date", date)
      .not("status", "in", '("cancelled","no_show")')
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .order("start_time");

    if (error) throw error;
    return data;
  },

  /** Scoped to `barberId` to match the RLS policy. */
  async updateStatusForBarber(id: string, barberId: string, status: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .eq("barber_id", barberId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
