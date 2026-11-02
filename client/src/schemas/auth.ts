import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

export const forgotPasswordSchema = loginSchema.pick({ email: true });

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(80),
  password: z.string().min(15, "Use at least 15 characters").max(128)
    .refine(value => new TextEncoder().encode(value).length <= 72, "Password must fit within 72 UTF-8 bytes."),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type AuthValues = LoginValues & { name?: string };
