import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente con la service-role key: saltea RLS por completo, así que solo puede usarse
 * detrás de un chequeo de admin en una server action.
 *
 * Deliberadamente sin cookies y sin sesión persistida. El cliente de `./server` sí guarda
 * la sesión en cookies, y crear un usuario con él dejaría al admin logueado como el barbero
 * que acaba de dar de alta.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
