import { z } from "zod";

export const CreateAppointmentSchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  clientName: z.string().min(2).max(100).trim(),
  clientPhone: z.string().regex(/^0\d{9}$/, "Formato: 09XXXXXXXX"),
});

export const CreateAnyBarberAppointmentSchema = CreateAppointmentSchema.omit({ barberId: true });

/**
 * Two shapes, never a relaxed one: a normal charge keeps `amount > 0` exactly as before, and
 * a free turn carries no amount or method at all — Postgres sets both to 0 / 'reward'.
 */
export const CompleteAppointmentSchema = z.union([
  z.object({
    redeemReward: z.literal(true),
    appointmentId: z.string().uuid(),
  }),
  z.object({
    redeemReward: z.literal(false).optional(),
    appointmentId: z.string().uuid(),
    paymentMethod: z.enum(["cash", "transfer"]),
    amount: z.number().positive(),
  }),
]);

export const LoyaltyPhoneSchema = z.string().trim().regex(/^0\d{9}$/);

export const CancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z.enum(["cancelled", "no_show"]),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type CompleteAppointmentInput = z.infer<typeof CompleteAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;
