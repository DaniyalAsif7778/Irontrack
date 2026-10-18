import { Schema, model } from "mongoose";

const wellnessSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  date: { type: String, required: true },
  waterGlasses: { type: Number, required: true, default: 0, min: 0, max: 100 },
  movementBreaks: { type: Number, required: true, default: 0, min: 0, max: 100 },
}, { timestamps: true });

wellnessSchema.index({ ownerId: 1, date: 1 }, { unique: true });
export const WellnessLog = model("WellnessLog", wellnessSchema);
