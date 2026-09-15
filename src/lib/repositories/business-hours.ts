import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";

export const businessHoursRepo = {
  async getAll() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("business_hours")
      .select("*")
      .eq("business_id", BUSINESS_ID)
      .order("day_of_week");

    if (error) throw error;
    return data;
  },

  async update(
    dayOfWeek: number,
    data: { openTime: string; closeTime: string; isOpen: boolean }
  ) {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("business_hours")
      .update({
        open_time: data.openTime,
        close_time: data.closeTime,
        is_open: data.isOpen,
      })
      .eq("business_id", BUSINESS_ID)
      .eq("day_of_week", dayOfWeek)
      .select()
      .single();

    if (error) throw error;
    return updated;
  },
};
