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

  async getAll() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", BUSINESS_ID)
      .order("sort_order");

    if (error) throw error;
    return data;
  },

  async create(data: {
    name: string;
    description?: string | null;
    durationMinutes: number;
    price: number;
    sortOrder?: number;
  }) {
    const supabase = await createClient();
    const { data: service, error } = await supabase
      .from("services")
      .insert({
        business_id: BUSINESS_ID,
        name: data.name,
        description: data.description ?? null,
        duration_minutes: data.durationMinutes,
        price: data.price,
        sort_order: data.sortOrder ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return service;
  },

  async update(
    id: string,
    data: {
      name: string;
      description?: string | null;
      durationMinutes: number;
      price: number;
    }
  ) {
    const supabase = await createClient();
    const { data: service, error } = await supabase
      .from("services")
      .update({
        name: data.name,
        description: data.description ?? null,
        duration_minutes: data.durationMinutes,
        price: data.price,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return service;
  },

  async setActive(id: string, isActive: boolean) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("services")
      .update({ is_active: isActive })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async reorder(orderedIds: string[]) {
    const supabase = await createClient();
    await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from("services").update({ sort_order: index }).eq("id", id)
      )
    );
  },
};
