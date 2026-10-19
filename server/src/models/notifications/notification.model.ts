import { Schema, model } from "mongoose";

const preferencesSchema = new Schema({
  taskTimes: { type: Boolean, default: true },
  workoutAtNine: { type: Boolean, default: true },
  hydration: { type: Boolean, default: false },
  movement: { type: Boolean, default: false },
}, { _id: false });

export const PushSubscription = model("PushSubscription", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
  timezone: { type: String, default: "UTC" },
  preferences: { type: preferencesSchema, default: () => ({}) },
}, { timestamps: true }));

export const PushDelivery = model("PushDelivery", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  deliveryKey: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true }));
PushDelivery.schema.index({ ownerId: 1, deliveryKey: 1 }, { unique: true });
