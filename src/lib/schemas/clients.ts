import { z } from "zod";

export const ClientSearchSchema = z.object({
  term: z.string().trim().max(60).optional().default(""),
  sort: z.enum(["visits", "recent", "name"]).optional().default("visits"),
  offset: z.number().int().min(0).max(5000).optional().default(0),
});

export const UpdateClientNotesSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().trim().max(500, "Máximo 500 caracteres"),
});

export type ClientSearchInput = z.infer<typeof ClientSearchSchema>;
export type UpdateClientNotesInput = z.infer<typeof UpdateClientNotesSchema>;
