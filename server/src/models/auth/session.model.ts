import { Schema, model } from "mongoose";

export const AuthSession = model("AuthSession", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenId: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  userAgent: { type: String, maxlength: 512, default: "" },
  ipAddress: { type: String, maxlength: 64, default: "" },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true }));

AuthSession.schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
