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

  /** The barber row linked to a Supabase auth user, used to scope the staff-facing agenda. */
  async getByUserId(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("business_id", BUSINESS_ID)
      .eq("user_id", userId)
      .single();

    if (error) return null;
    return data;
  },

  async getAll() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("business_id", BUSINESS_ID)
      .order("name");

    if (error) throw error;
    return data;
  },

  async create(data: {
    name: string;
    photoUrl?: string | null;
    pin: string;
    commissionPct: number;
  }) {
    const supabase = await createClient();
    const { data: barber, error } = await supabase
      .from("barbers")
      .insert({
        business_id: BUSINESS_ID,
        name: data.name,
        photo_url: data.photoUrl ?? null,
        pin: data.pin,
        commission_pct: data.commissionPct,
      })
      .select()
      .single();

    if (error) throw error;
    return barber;
  },

  async update(
    id: string,
    data: { name: string; photoUrl?: string | null; pin: string; commissionPct: number }
  ) {
    const supabase = await createClient();
    const { data: barber, error } = await supabase
      .from("barbers")
      .update({
        name: data.name,
        photo_url: data.photoUrl ?? null,
        pin: data.pin,
        commission_pct: data.commissionPct,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return barber;
  },

  async setActive(id: string, isActive: boolean) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbers")
      .update({ is_active: isActive })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
