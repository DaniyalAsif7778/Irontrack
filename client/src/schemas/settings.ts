import { z } from "zod";

export const settingsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name must be 80 characters or fewer"),
  weightUnit: z.enum(["kg", "lb"]),
  focusMinutes: z.number().int().min(5).max(120),
  breakMinutes: z.number().int().min(5).max(60),
});

export type SettingsValues = z.infer<typeof settingsSchema>;
