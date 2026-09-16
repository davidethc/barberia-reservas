import { z } from "zod";

/** Rejects `24:00` and friends, which pass a loose `\d{2}:\d{2}` but break the `time` column. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const CreateBlockSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    startTime: z.string().regex(TIME_PATTERN, "Hora de inicio inválida"),
    endTime: z.string().regex(TIME_PATTERN, "Hora de fin inválida"),
  })
  // "HH:MM" strings compare correctly as text, so no parsing is needed here.
  .refine((value) => value.endTime > value.startTime, {
    message: "La hora de fin tiene que ser posterior a la de inicio",
    path: ["endTime"],
  });

export const DeleteBlockSchema = z.object({
  blockId: z.string().uuid(),
});

export type CreateBlockInput = z.infer<typeof CreateBlockSchema>;
export type DeleteBlockInput = z.infer<typeof DeleteBlockSchema>;
