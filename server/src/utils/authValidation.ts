import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const accountSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  preferences: z.object({
    weightUnit: z.enum(["kg", "lb"]),
    focusMinutes: z.number().int().min(5).max(120),
    breakMinutes: z.number().int().min(5).max(60),
    prayerTimes: z.object({
      fajr: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/),
      dhuhr: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/),
      asr: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/),
      maghrib: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/),
      isha: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/),
    }).strict().optional(),
  }).strict().optional(),
}).strict().refine(value => value.name !== undefined || value.preferences !== undefined, "Provide at least one setting to update");
