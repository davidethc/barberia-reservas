import { createClient } from "@/lib/supabase/server";

/** The only `barber_schedules.type` the availability engine subtracts from open slots. */
export const BLOCK_TYPE = "block";

export const barberScheduleRepo = {
  async getBlocksForDate(barberId: string, date: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barber_schedules")
      .select("id, date, start_time, end_time")
      .eq("barber_id", barberId)
      .eq("date", date)
      .eq("type", BLOCK_TYPE)
      .order("start_time");

    if (error) throw error;
    return data;
  },

  /** Blocks in a closed date range, for the week/month calendar views. */
  async getBlocksForRange(barberId: string, from: string, to: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barber_schedules")
      .select("id, date, start_time, end_time")
      .eq("barber_id", barberId)
      .eq("type", BLOCK_TYPE)
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("start_time");

    if (error) throw error;
    return data;
  },

  /** Half-open comparison: a block ending at 13:00 does not collide with one starting there. */
  async getOverlappingBlocks(
    barberId: string,
    date: string,
    startTime: string,
    endTime: string
  ) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barber_schedules")
      .select("id, start_time, end_time")
      .eq("barber_id", barberId)
      .eq("date", date)
      .eq("type", BLOCK_TYPE)
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .order("start_time");

    if (error) throw error;
    return data;
  },

  async createBlock(data: {
    barberId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) {
    const supabase = await createClient();
    const { data: block, error } = await supabase
      .from("barber_schedules")
      .insert({
        barber_id: data.barberId,
        date: data.date,
        start_time: data.startTime,
        end_time: data.endTime,
        type: BLOCK_TYPE,
      })
      .select("id, date, start_time, end_time")
      .single();

    if (error) throw error;
    return block;
  },

  /**
   * Scoped to `barberId` as well as `id`: RLS already refuses another barber's row, but
   * the filter keeps the outcome a plain "0 rows" instead of depending on the policy.
   */
  async deleteBlockForBarber(id: string, barberId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barber_schedules")
      .delete()
      .eq("id", id)
      .eq("barber_id", barberId)
      .eq("type", BLOCK_TYPE)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};
