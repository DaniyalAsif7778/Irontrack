import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(80),
  password: z.string().min(12, "Password must be at least 12 characters").max(128),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type AuthValues = LoginValues & { name?: string };
