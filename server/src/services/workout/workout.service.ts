import { WORKOUT_DAYS, WorkoutLog, WorkoutPlan } from "../../models/workout/workout.model.js";
import { defaultWorkoutPlans, workoutWeek } from "./workoutData.js";
import type { Exercise } from "./workoutData.js";

export async function listPlans(ownerId: string) {
  const saved = await WorkoutPlan.find({ ownerId }).lean();
  const byDay = new Map(saved.map(plan => [plan.dayType, plan.exercises]));
  return WORKOUT_DAYS.map(dayType => ({ dayType, exercises: byDay.get(dayType) ?? defaultWorkoutPlans[dayType] }));
}

export function savePlan(ownerId: string, dayType: string, exercises: Exercise[]) {
  return WorkoutPlan.findOneAndUpdate({ ownerId, dayType }, { ownerId, dayType, exercises }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
}

export async function listLogs(ownerId: string, limitValue: unknown) {
  const limit = Math.min(Math.max(Number(limitValue ?? 30), 1), 200);
  return WorkoutLog.find({ ownerId }).sort({ date: -1, completedAt: -1 }).limit(limit).lean();
}

export async function saveLog(ownerId: string, data: ReturnType<typeof import("../../utils/workoutValidation.js").workoutLogPayload>) {
  if (data.actionId) {
    const existingAction = await WorkoutLog.findOne({ ownerId, actionId: data.actionId });
    if (existingAction) return existingAction;
  }
  if (await WorkoutLog.exists({ ownerId, date: data.date, dayType: data.dayType })) return null;
  return WorkoutLog.create({ ...data, ownerId });
}

export { workoutWeek };
