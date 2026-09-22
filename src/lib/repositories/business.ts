import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";
import type { LoyaltySettings } from "@/lib/loyalty";

export const businessRepo = {
  async getLoyalty(): Promise<LoyaltySettings> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("businesses")
      .select("loyalty_enabled, loyalty_cycle")
      .eq("id", BUSINESS_ID)
      .single();

    if (error) throw error;
    return { enabled: data.loyalty_enabled, cycle: data.loyalty_cycle };
  },

  /** RLS (`businesses_admin_update`) is the gate; the action checks the role first too. */
  async updateLoyalty({ enabled, cycle }: LoyaltySettings): Promise<LoyaltySettings> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("businesses")
      .update({ loyalty_enabled: enabled, loyalty_cycle: cycle })
      .eq("id", BUSINESS_ID)
      .select("loyalty_enabled, loyalty_cycle")
      .single();

    if (error) throw error;
    return { enabled: data.loyalty_enabled, cycle: data.loyalty_cycle };
  },
};
