import { Schema, model } from "mongoose";

export type AuthChallengePurpose = "verify_email" | "reset_password";

export const AuthChallenge = model("AuthChallenge", new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  purpose: { type: String, enum: ["verify_email", "reset_password"], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true }));

AuthChallenge.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
