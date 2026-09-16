"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUSINESS_ID } from "@/lib/constants";
import { isCurrentUserAdmin } from "@/lib/staff";
import { serviceRepo } from "@/lib/repositories/services";
import { barberRepo } from "@/lib/repositories/barbers";
import { businessHoursRepo } from "@/lib/repositories/business-hours";
import {
  clientRepo,
  type ClientListItem,
  type ClientStats,
} from "@/lib/repositories/clients";
import type { ActionResult } from "@/lib/appointment-states";
import { ClientSearchSchema, UpdateClientNotesSchema } from "@/lib/schemas/clients";
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  ReorderServicesSchema,
  ToggleActiveSchema,
  UpdateBarberSchema,
  LinkBarberAccountSchema,
  UnlinkBarberAccountSchema,
  CreateBarberWithAccountSchema,
  ResetBarberPasswordSchema,
  BusinessHoursInputSchema,
  CommissionsReportRangeSchema,
} from "@/lib/schemas/admin";

// ---------- Reads (used by the admin page Server Component) ----------

export type ClientsSnapshot = {
  items: ClientListItem[];
  hasMore: boolean;
  stats: ClientStats;
};

export async function getAdminData() {
  // Also the gate for the /admin page itself: the page renders whatever this returns.
  if (!(await isCurrentUserAdmin())) redirect("/agenda");

  const [services, barbers, businessHours, clients] = await Promise.all([
    serviceRepo.getAll(),
    barberRepo.getAll(),
    businessHoursRepo.getAll(),
    // A failing clients query shows an error inside its own tab instead of blanking /admin.
    loadClientsSnapshot().catch(() => null),
  ]);

  return { services, barbers, businessHours, clients };
}

async function loadClientsSnapshot(term = "", sort: "visits" | "recent" | "name" = "visits") {
  const [page, stats] = await Promise.all([
    clientRepo.search({ term, sort }),
    clientRepo.getStats(),
  ]);
  return { ...page, stats };
}

// ---------- Services ----------

export async function createService(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = CreateServiceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const service = await serviceRepo.create(parsed.data);
    revalidatePath("/admin");
    return { success: true, data: { id: service.id } };
  } catch {
    return { success: false, error: "No se pudo crear el servicio" };
  }
}

export async function updateService(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = UpdateServiceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const { id, ...data } = parsed.data;
    await serviceRepo.update(id, data);
    revalidatePath("/admin");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "No se pudo actualizar el servicio" };
  }
}

export async function toggleServiceActive(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = ToggleActiveSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    await serviceRepo.setActive(parsed.data.id, parsed.data.isActive);
    revalidatePath("/admin");
    return { success: true, data: { id: parsed.data.id } };
  } catch {
    return { success: false, error: "No se pudo actualizar el servicio" };
  }
}

export async function reorderServices(input: unknown): Promise<ActionResult<null>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = ReorderServicesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    await serviceRepo.reorder(parsed.data.orderedIds);
    revalidatePath("/admin");
    return { success: true, data: null };
  } catch {
    return { success: false, error: "No se pudo reordenar los servicios" };
  }
}

// ---------- Barbers ----------

export async function updateBarber(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = UpdateBarberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const { id, ...data } = parsed.data;
    await barberRepo.update(id, { ...data, photoUrl: data.photoUrl || null });
    revalidatePath("/admin");
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "No se pudo actualizar el barbero" };
  }
}

export async function toggleBarberActive(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = ToggleActiveSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    await barberRepo.setActive(parsed.data.id, parsed.data.isActive);
    revalidatePath("/admin");
    return { success: true, data: { id: parsed.data.id } };
  } catch {
    return { success: false, error: "No se pudo actualizar el barbero" };
  }
}

// ---------- Barber account linking ----------

/**
 * The linking functions signal each failure with a token in the raised message, so the panel
 * can tell "no existe la cuenta" apart from "ya está vinculada" instead of showing one
 * catch-all error.
 */
const LINK_ERROR_MESSAGES: Record<string, string> = {
  BARBER_LINK_NOT_ADMIN: "No autorizado",
  BARBER_LINK_USER_NOT_FOUND: "No existe una cuenta con ese correo",
  BARBER_LINK_ALREADY_LINKED: "Esa cuenta ya está vinculada a otro barbero",
  BARBER_LINK_BARBER_NOT_FOUND: "El barbero ya no existe",
  BARBER_UNLINK_NOT_ADMIN: "No autorizado",
  BARBER_UNLINK_SELF: "No puedes desvincular tu propia cuenta",
  BARBER_UNLINK_BARBER_NOT_FOUND: "El barbero ya no existe",
};

function linkErrorMessage(error: unknown, fallback: string): string {
  // PostgrestError is a plain object in some supabase-js builds, so don't assume an Error.
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  for (const [token, spanish] of Object.entries(LINK_ERROR_MESSAGES)) {
    if (message.includes(token)) return spanish;
  }
  return fallback;
}

export async function linkBarberAccount(
  input: unknown
): Promise<ActionResult<{ id: string; userId: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = LinkBarberAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Correo inválido" };

  try {
    const userId = await barberRepo.linkAccount(parsed.data.barberId, parsed.data.email);
    revalidatePath("/admin");
    return { success: true, data: { id: parsed.data.barberId, userId } };
  } catch (error) {
    return { success: false, error: linkErrorMessage(error, "No se pudo vincular la cuenta") };
  }
}

export async function unlinkBarberAccount(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = UnlinkBarberAccountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    await barberRepo.unlinkAccount(parsed.data.barberId);
    revalidatePath("/admin");
    return { success: true, data: { id: parsed.data.barberId } };
  } catch (error) {
    return { success: false, error: linkErrorMessage(error, "No se pudo desvincular la cuenta") };
  }
}

// ---------- Clients ----------

export async function searchClients(
  input: unknown
): Promise<ActionResult<{ items: ClientListItem[]; hasMore: boolean; offset: number }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = ClientSearchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Búsqueda inválida" };

  try {
    const page = await clientRepo.search(parsed.data);
    return { success: true, data: { ...page, offset: parsed.data.offset } };
  } catch {
    return { success: false, error: "No se pudieron cargar los clientes" };
  }
}

export async function getClientStats(): Promise<ActionResult<ClientStats>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  try {
    return { success: true, data: await clientRepo.getStats() };
  } catch {
    return { success: false, error: "No se pudieron cargar los datos de clientes" };
  }
}

export async function updateClientNotes(
  input: unknown
): Promise<ActionResult<ClientListItem>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = UpdateClientNotesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const client = await clientRepo.updateNotes(parsed.data.id, parsed.data.notes);
    revalidatePath("/admin");
    return { success: true, data: client };
  } catch {
    return { success: false, error: "No se pudo guardar la nota" };
  }
}

// ---------- Alta de barbero con su acceso ----------

function authErrorMessage(message: string, fallback: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already been registered") || lower.includes("already registered")) {
    return "Ya existe una cuenta con ese correo. Usa 'Vincular cuenta' en su lugar.";
  }
  if (lower.includes("password")) return "La contraseña no cumple el mínimo";
  if (lower.includes("email") && lower.includes("invalid")) {
    return "Supabase rechazó ese correo. Prueba con otra dirección.";
  }
  if (lower.includes("rate limit")) {
    return "Supabase está limitando los intentos. Espera un momento y vuelve a probar.";
  }
  return fallback;
}

export async function createBarberWithAccount(
  input: unknown
): Promise<ActionResult<{ id: string; email: string; userId: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = CreateBarberWithAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { email, password, name, photoUrl, pin, commissionPct } = parsed.data;
  const admin = createAdminClient();

  // `email_confirm` evita el correo de verificación: el acceso se entrega en mano, y el
  // mailer del plan gratuito además está limitado por tasa.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !created.user) {
    return {
      success: false,
      error: authErrorMessage(authError?.message ?? "", "No se pudo crear la cuenta"),
    };
  }

  try {
    const barber = await barberRepo.insertWithAccount(admin, {
      name,
      photoUrl,
      pin,
      commissionPct,
      userId: created.user.id,
    });

    revalidatePath("/admin");
    return { success: true, data: { id: barber.id, email, userId: created.user.id } };
  } catch {
    // Sin esto el correo queda ocupado por una cuenta que el admin no ve en ningún lado,
    // y el segundo intento fallaría con "ya existe" sin forma de salir.
    await admin.auth.admin.deleteUser(created.user.id);
    return { success: false, error: "No se pudo crear el barbero. Intenta de nuevo." };
  }
}

export async function resetBarberPassword(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = ResetBarberPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { barberId, password } = parsed.data;
  const admin = createAdminClient();

  const { data: barber } = await admin
    .from("barbers")
    .select("user_id")
    .eq("id", barberId)
    .eq("business_id", BUSINESS_ID)
    .single();

  if (!barber?.user_id) {
    return { success: false, error: "Ese barbero todavía no tiene cuenta" };
  }

  const { error } = await admin.auth.admin.updateUserById(barber.user_id, { password });

  if (error) {
    return {
      success: false,
      error: authErrorMessage(error.message, "No se pudo cambiar la contraseña"),
    };
  }

  return { success: true, data: { id: barberId } };
}

// ---------- Business hours ----------

export async function updateBusinessHours(input: unknown): Promise<ActionResult<null>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = BusinessHoursInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    await businessHoursRepo.update(parsed.data.dayOfWeek, parsed.data);
    revalidatePath("/admin");
    return { success: true, data: null };
  } catch {
    return { success: false, error: "No se pudo actualizar el horario" };
  }
}

// ---------- Commissions report ----------

export type CommissionRow = {
  barber_id: string | null;
  name: string | null;
  fecha: string | null;
  total_servicios: number | null;
  ingreso_total: number | null;
  comision_total: number | null;
  business_id: string | null;
};

export async function getCommissionsReport(
  input: unknown
): Promise<ActionResult<CommissionRow[]>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = CommissionsReportRangeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Rango de fechas inválido" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("barber_commissions")
    .select("*")
    // The view aggregates payments across every shop, so the report has to scope itself.
    .eq("business_id", BUSINESS_ID)
    .gte("fecha", parsed.data.from)
    .lte("fecha", parsed.data.to)
    .order("fecha", { ascending: false });

  if (error) {
    return { success: false, error: "No se pudo generar el reporte" };
  }

  return { success: true, data: data ?? [] };
}
