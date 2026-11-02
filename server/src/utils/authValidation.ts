import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(15).max(128).refine(value => Buffer.byteLength(value, "utf8") <= 72, "Password must fit within 72 UTF-8 bytes."),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal("DELETE"),
}).strict();

export const emailSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
}).strict();

export const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();

export const resetPasswordSchema = tokenSchema.extend({
  password: z.string().min(15).max(128).refine(value => Buffer.byteLength(value, "utf8") <= 72, "Password must fit within 72 UTF-8 bytes."),
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
    }).strict().refine(value => {
      const configured = [value.fajr, value.dhuhr, value.asr, value.maghrib, value.isha].filter(Boolean);
      return configured.every((time, index) => index === 0 || time > configured[index - 1]);
    }, "Prayer times must be in Fajr-to-Isha order.").optional(),
  }).strict().optional(),
}).strict().refine(value => value.name !== undefined || value.preferences !== undefined, "Provide at least one setting to update");
