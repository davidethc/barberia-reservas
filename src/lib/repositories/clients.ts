import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";

export const clientRepo = {
  async findOrCreate(name: string, phone: string) {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("clients")
      .select("*")
      .eq("business_id", BUSINESS_ID)
      .eq("phone", phone)
      .single();

    if (existing) {
      await supabase
        .from("clients")
        .update({
          name,
          visit_count: (existing.visit_count ?? 0) + 1,
          last_visit: new Date().toISOString(),
        })
        .eq("id", existing.id);
      return existing;
    }

    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        business_id: BUSINESS_ID,
        name,
        phone,
        visit_count: 1,
        last_visit: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  },
};
