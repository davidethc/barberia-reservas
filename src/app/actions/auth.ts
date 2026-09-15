"use server";

import { createClient } from "@/lib/supabase/server";
import { SignInSchema } from "@/lib/schemas/auth";
import type { ActionResult } from "@/lib/appointment-states";

export async function signIn(input: unknown): Promise<ActionResult<{ userId: string }>> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Correo o contraseña inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { success: false, error: "Credenciales incorrectas" };
  }

  return { success: true, data: { userId: data.user.id } };
}

export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, error: "No se pudo cerrar sesión" };
  }

  return { success: true, data: null };
}
