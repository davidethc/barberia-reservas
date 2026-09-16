"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/staff";
import { serviceRepo } from "@/lib/repositories/services";
import { barberRepo } from "@/lib/repositories/barbers";
import { businessHoursRepo } from "@/lib/repositories/business-hours";
import type { ActionResult } from "@/lib/appointment-states";
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  ReorderServicesSchema,
  ToggleActiveSchema,
  CreateBarberSchema,
  UpdateBarberSchema,
  LinkBarberAccountSchema,
  UnlinkBarberAccountSchema,
  BusinessHoursInputSchema,
  CommissionsReportRangeSchema,
} from "@/lib/schemas/admin";

// ---------- Reads (used by the admin page Server Component) ----------

export async function getAdminData() {
  // Also the gate for the /admin page itself: the page renders whatever this returns.
  if (!(await isCurrentUserAdmin())) redirect("/agenda");

  const [services, barbers, businessHours] = await Promise.all([
    serviceRepo.getAll(),
    barberRepo.getAll(),
    businessHoursRepo.getAll(),
  ]);

  return { services, barbers, businessHours };
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

export async function createBarber(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await isCurrentUserAdmin())) return { success: false, error: "No autorizado" };

  const parsed = CreateBarberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  try {
    const barber = await barberRepo.create({
      name: parsed.data.name,
      photoUrl: parsed.data.photoUrl || null,
      pin: parsed.data.pin,
      commissionPct: parsed.data.commissionPct,
    });
    revalidatePath("/admin");
    return { success: true, data: { id: barber.id } };
  } catch {
    return { success: false, error: "No se pudo crear el barbero" };
  }
}

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
  BARBER_UNLINK_SELF: "No podés desvincular tu propia cuenta",
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
    .gte("fecha", parsed.data.from)
    .lte("fecha", parsed.data.to)
    .order("fecha", { ascending: false });

  if (error) {
    return { success: false, error: "No se pudo generar el reporte" };
  }

  return { success: true, data: data ?? [] };
}
