import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";
import type { Database } from "@/types/database";

export type BarberRole = "admin" | "barber";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

/**
 * Takes the Supabase client as an argument because the proxy builds its own client and
 * cannot use the cookies()-based one the repository methods create.
 */
export async function getRoleByUserId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<BarberRole | null> {
  const { data, error } = await supabase
    .from("barbers")
    .select("role")
    .eq("business_id", BUSINESS_ID)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return isAdminRole(data.role) ? "admin" : "barber";
}

const STAFF_FIELDS =
  "id, business_id, user_id, name, photo_url, commission_pct, is_active, created_at, role";

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

  /**
   * `pin` is deliberately absent: the column is no longer granted to the anon or
   * authenticated roles, so any `select *` on `barbers` is refused outright. Only
   * `admin_list_barbers()` hands it back, and only to an admin.
   */
  async getByUserId(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbers")
      .select(STAFF_FIELDS)
      .eq("business_id", BUSINESS_ID)
      .eq("user_id", userId)
      .single();

    if (error) return null;
    return data;
  },

  /** Admin-only, and gated inside Postgres rather than here: the PIN travels with these rows. */
  async getAll() {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_barbers");

    if (error) throw error;
    return data ?? [];
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
      .select("id")
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
      .select("id")
      .single();

    if (error) throw error;
    return barber;
  },

  /**
   * Both linking calls go through SECURITY DEFINER functions: auth.users is not readable by
   * the anon/authenticated client, so the email lookup has to happen inside Postgres. The
   * raised error is passed through untouched for the action layer to map to a message.
   */
  async linkAccount(barberId: string, email: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("link_barber_account", {
      p_barber_id: barberId,
      p_email: email,
    });

    if (error) throw error;
    return data;
  },

  async unlinkAccount(barberId: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("unlink_barber_account", {
      p_barber_id: barberId,
    });

    if (error) throw error;
  },

  async setActive(id: string, isActive: boolean) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbers")
      .update({ is_active: isActive })
      .eq("id", id)
      .select("id")
      .single();

    if (error) throw error;
    return data;
  },
};
