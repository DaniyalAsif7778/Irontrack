import { Schema, model } from "mongoose";

export const WORKOUT_DAYS = ["push", "pull", "legs", "push_high", "pull_high", "legs_high"] as const;

const exerciseSchema = new Schema({
  id: { type: String, required: true }, name: { type: String, required: true, trim: true },
  sets: { type: Number, required: true, min: 1, max: 20 }, reps: { type: Number, required: true, min: 1, max: 100 },
  muscle: { type: String, required: true }, tempo: { type: String, default: "3-1-2" },
  rest: { type: Number, default: 60, min: 0, max: 600 }, cues: { type: [String], default: [] },
  description: { type: String, default: "", maxlength: 4000 },
  setList: { type: [new Schema({ id: { type: String, default: "" }, reps: { type: Number, min: 1, max: 1000 }, weight: { type: Number, min: 0, max: 10000 } }, { _id: false, id: false })], default: [] },
  steps: { type: [String], default: [] }, videoUrl: { type: String, default: "", maxlength: 2048 }
}, { _id: false });

export const WorkoutPlan = model("WorkoutPlan", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  dayType: { type: String, enum: WORKOUT_DAYS, required: true },
  exercises: { type: [exerciseSchema], default: [] }
}, { timestamps: true }));
WorkoutPlan.schema.index({ ownerId: 1, dayType: 1 }, { unique: true });

const loggedSetSchema = new Schema({ reps: { type: Number, required: true, min: 0, max: 1000 }, weight: { type: Number, required: true, min: 0, max: 10000 } }, { _id: false });
const loggedExerciseSchema = new Schema({
  exerciseId: { type: String, required: true }, name: { type: String, required: true }, muscle: { type: String, default: "" },
  sets: { type: [loggedSetSchema], default: [] }
}, { _id: false });

export const WorkoutLog = model("WorkoutLog", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  date: { type: String, required: true }, dayType: { type: String, enum: WORKOUT_DAYS, required: true },
  exercises: { type: [loggedExerciseSchema], default: [] }, totalSets: { type: Number, required: true, min: 0 },
  totalVolume: { type: Number, required: true, min: 0 }, duration: { type: Number, required: true, min: 0 },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true }));
WorkoutLog.schema.index({ ownerId: 1, date: 1, dayType: 1 }, { unique: true });

export const WorkoutProgression = model("WorkoutProgression", new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  exerciseId: { type: String, required: true },
  maxReps: { type: Number, required: true, min: 0 },
  maxSets: { type: Number, required: true, min: 0 },
  sessions: { type: Number, required: true, min: 0 },
  lastDate: { type: String, required: true },
}, { timestamps: true }));
WorkoutProgression.schema.index({ ownerId: 1, exerciseId: 1 }, { unique: true });
