import { createClient } from "@/lib/supabase/server";
import { BUSINESS_ID } from "@/lib/constants";
import { toLoyaltyProgress, type LoyaltyProgress } from "@/lib/loyalty";

export type ClientSort = "visits" | "recent" | "name";

export type ClientListItem = {
  id: string;
  name: string;
  phone: string;
  visit_count: number | null;
  last_visit: string | null;
  notes: string | null;
  /** Filled by the admin actions when the stamp card is readable; absent otherwise. */
  loyalty?: LoyaltyProgress | null;
};

export type ClientStats = {
  total: number;
  returning: number;
  recent: number;
};

const CLIENT_FIELDS = "id, name, phone, visit_count, last_visit, notes";

export const CLIENTS_PAGE_SIZE = 25;

/** A client counts as a regular from the second visit on. */
const RETURNING_MIN_VISITS = 2;
const RECENT_WINDOW_DAYS = 30;

/**
 * PostgREST parses `or=(...)` as its own little grammar, so a raw term could close the group
 * and append filters of its own. Everything outside the allowed set is dropped before it gets
 * there, and the LIKE wildcards that survive are escaped so they match literally.
 */
function toLikePattern(term: string): string {
  const safe = term
    .replace(/[^\p{L}\p{N} '\-+.@]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const escaped = safe.replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

function daysAgoISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export const clientRepo = {
  // The booking flow's find-or-create now lives in `create_public_appointment`: the anon
  // role holds no grant on `clients` at all.

  async search({
    term = "",
    sort = "visits",
    offset = 0,
    limit = CLIENTS_PAGE_SIZE,
  }: {
    term?: string;
    sort?: ClientSort;
    offset?: number;
    limit?: number;
  }): Promise<{ items: ClientListItem[]; hasMore: boolean }> {
    const supabase = await createClient();

    let query = supabase
      .from("clients")
      .select(CLIENT_FIELDS)
      .eq("business_id", BUSINESS_ID);

    const trimmed = term.trim();
    if (trimmed) {
      const pattern = toLikePattern(trimmed);
      const filters = [`name.ilike.${pattern}`, `phone.ilike.${pattern}`];

      // Phones are typed with spaces and dashes as often as not, so also try the bare digits.
      const digits = trimmed.replace(/\D/g, "");
      if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);

      query = query.or(filters.join(","));
    }

    if (sort === "name") {
      query = query.order("name", { ascending: true });
    } else if (sort === "recent") {
      query = query
        .order("last_visit", { ascending: false, nullsFirst: false })
        .order("visit_count", { ascending: false, nullsFirst: false });
    } else {
      query = query
        .order("visit_count", { ascending: false, nullsFirst: false })
        .order("last_visit", { ascending: false, nullsFirst: false });
    }

    // One extra row is the cheapest way to know whether a "ver más" button belongs there.
    const { data, error } = await query.range(offset, offset + limit);
    if (error) throw error;

    const rows = (data ?? []) as ClientListItem[];
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  },

  async getStats(): Promise<ClientStats> {
    const supabase = await createClient();

    const base = () =>
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("business_id", BUSINESS_ID);

    const [total, returning, recent] = await Promise.all([
      base(),
      base().gte("visit_count", RETURNING_MIN_VISITS),
      base().gte("last_visit", daysAgoISO(RECENT_WINDOW_DAYS)),
    ]);

    const firstError = total.error ?? returning.error ?? recent.error;
    if (firstError) throw firstError;

    return {
      total: total.count ?? 0,
      returning: returning.count ?? 0,
      recent: recent.count ?? 0,
    };
  },

  /**
   * Stamp progress for a batch of clients, in one call. `staff_client_loyalty` is security
   * definer on purpose: a barber only sees their own turns through RLS, and a client's stamps
   * count visits with every barber. Scoped in Postgres to the caller's shop.
   */
  async getLoyaltyForClients(clientIds: string[]): Promise<Record<string, LoyaltyProgress>> {
    if (clientIds.length === 0) return {};
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("staff_client_loyalty", {
      p_client_ids: [...new Set(clientIds)],
    });

    if (error) throw error;

    const byClient: Record<string, LoyaltyProgress> = {};
    for (const row of data ?? []) {
      const progress = toLoyaltyProgress(row);
      if (progress) byClient[row.client_id] = progress;
    }
    return byClient;
  },

  async updateNotes(id: string, notes: string): Promise<ClientListItem> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("clients")
      .update({ notes: notes || null })
      .eq("id", id)
      .eq("business_id", BUSINESS_ID)
      .select(CLIENT_FIELDS)
      .single();

    if (error) throw error;
    return data as ClientListItem;
  },
};
