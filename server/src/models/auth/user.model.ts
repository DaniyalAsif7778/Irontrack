import { Schema, model } from "mongoose";

export type PrayerTimes = { fajr: string; dhuhr: string; asr: string; maghrib: string; isha: string };
export type UserPreferences = { weightUnit: "kg" | "lb"; focusMinutes: number; breakMinutes: number; prayerTimes: PrayerTimes };
export type PublicUser = { id: string; name: string; email: string; preferences: UserPreferences };

type UserFields = {
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationExpiresAt?: Date;
  preferences: UserPreferences;
};

const userSchema = new Schema<UserFields>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  // Existing accounts without this field remain usable; registrations explicitly set false.
  emailVerified: { type: Boolean, default: true },
  verificationExpiresAt: { type: Date, default: undefined },
  preferences: {
    weightUnit: { type: String, enum: ["kg", "lb"], default: "kg" },
    focusMinutes: { type: Number, min: 5, max: 120, default: 45 },
    breakMinutes: { type: Number, min: 5, max: 60, default: 15 },
    prayerTimes: {
      fajr: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$|^$/ },
      dhuhr: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$|^$/ },
      asr: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$|^$/ },
      maghrib: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$|^$/ },
      isha: { type: String, default: "", match: /^(?:[01]\d|2[0-3]):[0-5]\d$|^$/ },
    },
  },
}, { timestamps: true });

export const User = model<UserFields>("User", userSchema);
User.schema.index({ verificationExpiresAt: 1 }, { expireAfterSeconds: 0 });

export function toPublicUser(user: { _id: unknown; name: string; email: string; preferences?: Partial<UserPreferences> }): PublicUser {
  return {
    id: String(user._id), name: user.name, email: user.email,
    preferences: {
      weightUnit: user.preferences?.weightUnit === "lb" ? "lb" : "kg",
      focusMinutes: user.preferences?.focusMinutes ?? 45,
      breakMinutes: user.preferences?.breakMinutes ?? 15,
      prayerTimes: {
        fajr: user.preferences?.prayerTimes?.fajr ?? "",
        dhuhr: user.preferences?.prayerTimes?.dhuhr ?? "",
        asr: user.preferences?.prayerTimes?.asr ?? "",
        maghrib: user.preferences?.prayerTimes?.maghrib ?? "",
        isha: user.preferences?.prayerTimes?.isha ?? "",
      },
    },
  };
}
