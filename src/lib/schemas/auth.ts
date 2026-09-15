import { z } from "zod";

export const SignInSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export type SignInInput = z.infer<typeof SignInSchema>;
