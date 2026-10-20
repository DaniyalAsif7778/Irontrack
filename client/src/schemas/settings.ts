import { z } from "zod";

export const settingsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name must be 80 characters or fewer"),
  weightUnit: z.enum(["kg", "lb"]),
  focusMinutes: z.number().int().min(5).max(120),
  breakMinutes: z.number().int().min(5).max(60),
  prayerTimes: z.object({
    fajr: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/, "Enter a valid time or leave it blank"),
    dhuhr: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/, "Enter a valid time or leave it blank"),
    asr: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/, "Enter a valid time or leave it blank"),
    maghrib: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/, "Enter a valid time or leave it blank"),
    isha: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/, "Enter a valid time or leave it blank"),
  }),
});

export type SettingsValues = z.infer<typeof settingsSchema>;
