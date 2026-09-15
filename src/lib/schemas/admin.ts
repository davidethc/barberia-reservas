import { z } from "zod";

export const ServiceInputSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  durationMinutes: z.number().int().positive("Debe ser mayor a 0"),
  price: z.number().nonnegative("No puede ser negativo"),
});

export const CreateServiceSchema = ServiceInputSchema;
export const UpdateServiceSchema = ServiceInputSchema.extend({
  id: z.string().uuid(),
});

export const ReorderServicesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export const ToggleActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export const BarberInputSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
  photoUrl: z.string().trim().url("URL inválida").optional().nullable().or(z.literal("")),
  pin: z.string().regex(/^\d{4,6}$/, "PIN de 4 a 6 dígitos"),
  commissionPct: z.number().min(0).max(100),
});

export const CreateBarberSchema = BarberInputSchema;
export const UpdateBarberSchema = BarberInputSchema.extend({
  id: z.string().uuid(),
});

export const BusinessHoursInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  isOpen: z.boolean(),
});

export const CommissionsReportRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ServiceInput = z.infer<typeof ServiceInputSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;
export type BarberInput = z.infer<typeof BarberInputSchema>;
export type UpdateBarberInput = z.infer<typeof UpdateBarberSchema>;
export type BusinessHoursInput = z.infer<typeof BusinessHoursInputSchema>;
export type CommissionsReportRange = z.infer<typeof CommissionsReportRangeSchema>;
