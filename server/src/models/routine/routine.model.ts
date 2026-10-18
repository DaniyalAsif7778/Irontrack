import { Schema, model } from "mongoose";
import { BLOCKS, DAY_TYPES } from "../../constant.js";

const subtaskSchema = new Schema({ title: { type: String, required: true, trim: true }, completed: { type: Boolean, default: false } }, { _id: true });

export const RoutineTask = model("RoutineTask", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  dayType: { type: String, enum: DAY_TYPES, required: true, index: true },
  block: { type: String, enum: BLOCKS, required: true, index: true },
  order: { type: Number, default: 0 }, title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: "", maxlength: 4000 }, type: { type: String, default: "general", maxlength: 50 },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" }, category: { type: String, default: "Personal", maxlength: 80 },
  duration: { type: Number, default: 0, min: 0, max: 1440 }, dueDate: { type: String, default: "" }, reminderTime: { type: String, default: "" },
  subtasks: { type: [subtaskSchema], default: [] }
}, { timestamps: true }));

export const RoutineCompletion = model("RoutineCompletion", new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: "RoutineTask", required: true, index: true },
  date: { type: String, required: true, index: true }, completed: { type: Boolean, default: true }
}, { timestamps: true }));
RoutineCompletion.schema.index({ taskId: 1, date: 1 }, { unique: true });
