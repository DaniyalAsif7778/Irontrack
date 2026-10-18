import { Schema, model } from "mongoose";

export type UserPreferences = { weightUnit: "kg" | "lb"; focusMinutes: number; breakMinutes: number };
export type PublicUser = { id: string; name: string; email: string; preferences: UserPreferences };

type UserFields = {
  name: string;
  email: string;
  passwordHash: string;
  preferences: UserPreferences;
};

const userSchema = new Schema<UserFields>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  preferences: {
    weightUnit: { type: String, enum: ["kg", "lb"], default: "kg" },
    focusMinutes: { type: Number, min: 5, max: 120, default: 45 },
    breakMinutes: { type: Number, min: 5, max: 60, default: 15 },
  },
}, { timestamps: true });

export const User = model<UserFields>("User", userSchema);

export function toPublicUser(user: { _id: unknown; name: string; email: string; preferences?: Partial<UserPreferences> }): PublicUser {
  return {
    id: String(user._id), name: user.name, email: user.email,
    preferences: {
      weightUnit: user.preferences?.weightUnit === "lb" ? "lb" : "kg",
      focusMinutes: user.preferences?.focusMinutes ?? 45,
      breakMinutes: user.preferences?.breakMinutes ?? 15,
    },
  };
}
