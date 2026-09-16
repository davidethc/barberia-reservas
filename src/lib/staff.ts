import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { barberRepo, isAdminRole } from "@/lib/repositories/barbers";

/**
 * The barber row linked to the signed-in user, or null when there is no session or no
 * linked row. Cached per request so the agenda and admin gates don't re-query on render.
 */
export const getCurrentBarber = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return barberRepo.getByUserId(user.id);
});

export async function isCurrentUserAdmin(): Promise<boolean> {
  const barber = await getCurrentBarber();
  return isAdminRole(barber?.role);
}
