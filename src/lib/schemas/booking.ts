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

export const CompleteAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "transfer"]),
  amount: z.number().positive(),
});

export const CancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z.enum(["cancelled", "no_show"]),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type CompleteAppointmentInput = z.infer<typeof CompleteAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;
