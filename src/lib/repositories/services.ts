import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";

export const serviceRepo = {
  async getActive() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", BUSINESS_ID)
      .eq("is_active", true)
      .order("sort_order");

    if (error) throw error;
    return data;
  },
};
