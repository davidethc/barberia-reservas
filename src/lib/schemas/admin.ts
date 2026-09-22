import { z } from "zod";
import { MAX_LOYALTY_CYCLE, MIN_LOYALTY_CYCLE } from "@/lib/loyalty";

export const ServiceInputSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  durationMinutes: z.number().int().positive("Debe ser mayor a 0"),
  price: z.number().nonnegative("No puede ser negativo"),
  icon: z.string().trim().min(1, "Elige un emoji").max(16).nullable().optional(),
});

export const CreateServiceSchema = ServiceInputSchema;
export const UpdateServiceSchema = ServiceInputSchema.extend({
  id: z.string().uuid(),
});

export const UploadServiceImageSchema = z.object({
  serviceId: z.string().uuid(),
});

export const RemoveServiceImageSchema = z.object({
  serviceId: z.string().uuid(),
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

export const UpdateBarberSchema = BarberInputSchema.extend({
  id: z.string().uuid(),
});

export const LinkBarberAccountSchema = z.object({
  barberId: z.string().uuid(),
  email: z.string().trim().email("Correo inválido").max(255),
});

export const UnlinkBarberAccountSchema = z.object({
  barberId: z.string().uuid(),
});

/** Supabase rechaza contraseñas de menos de 6; pedimos 8 para no entregar accesos frágiles. */
export const PASSWORD_MIN_LENGTH = 8;

export const CreateBarberWithAccountSchema = BarberInputSchema.extend({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
    .max(72, "Máximo 72 caracteres"),
});

export const ResetBarberPasswordSchema = z.object({
  barberId: z.string().uuid(),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
    .max(72, "Máximo 72 caracteres"),
});

export const BusinessHoursInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  isOpen: z.boolean(),
});

export const LoyaltySettingsSchema = z.object({
  enabled: z.boolean(),
  cycle: z
    .number()
    .int("Tiene que ser un número entero")
    .min(MIN_LOYALTY_CYCLE, `Mínimo ${MIN_LOYALTY_CYCLE}`)
    .max(MAX_LOYALTY_CYCLE, `Máximo ${MAX_LOYALTY_CYCLE}`),
});

export const CommissionsReportRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ServiceInput = z.infer<typeof ServiceInputSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;
export type BarberInput = z.infer<typeof BarberInputSchema>;
export type UpdateBarberInput = z.infer<typeof UpdateBarberSchema>;
export type LinkBarberAccountInput = z.infer<typeof LinkBarberAccountSchema>;
export type CreateBarberWithAccountInput = z.infer<typeof CreateBarberWithAccountSchema>;
export type BusinessHoursInput = z.infer<typeof BusinessHoursInputSchema>;
export type LoyaltySettingsInput = z.infer<typeof LoyaltySettingsSchema>;
export type CommissionsReportRange = z.infer<typeof CommissionsReportRangeSchema>;
