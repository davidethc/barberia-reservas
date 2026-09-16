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
