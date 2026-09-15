import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";

export const barberRepo = {
  async getActive() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbers")
      .select("id, name, photo_url")
      .eq("business_id", BUSINESS_ID)
      .eq("is_active", true);

    if (error) throw error;
    return data;
  },

  async getByPin(pin: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("business_id", BUSINESS_ID)
      .eq("pin", pin)
      .eq("is_active", true)
      .single();

    if (error) return null;
    return data;
  },
};
