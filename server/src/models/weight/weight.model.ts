import { Schema, model } from "mongoose";

export const WeightLog = model("WeightLog", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  date: { type: String, required: true },
  weight: { type: Number, required: true, min: 1, max: 1000 },
  unit: { type: String, enum: ["kg", "lb"], required: true }
}, { timestamps: true }));
WeightLog.schema.index({ ownerId: 1, date: 1 }, { unique: true });
