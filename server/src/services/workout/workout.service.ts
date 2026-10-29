import { WorkoutLog, WorkoutPlan, WorkoutProgram, WORKOUT_WEEKDAYS, WORKOUT_WEEKDAY_LABELS } from "../../models/workout/workout.model.js";
import { legacyWorkoutNames, legacyWorkoutWeek, type Exercise } from "./workoutData.js";

function toPublicPlan(plan: { dayType: string; name?: string; exercises: Exercise[] }) {
  return { id: plan.dayType, name: plan.name?.trim() || legacyWorkoutNames[plan.dayType] || "Workout day", exercises: plan.exercises };
}

export async function listPlans(ownerId: string) {
  const saved = await WorkoutPlan.find({ ownerId }).sort({ createdAt: 1 }).lean();
  return saved.map(plan => toPublicPlan(plan as { dayType: string; name?: string; exercises: Exercise[] }));
}

export async function savePlan(ownerId: string, planId: string, name: string, exercises: Exercise[]) {
  const plan = await WorkoutPlan.findOneAndUpdate(
    { ownerId, dayType: planId },
    { $set: { ownerId, dayType: planId, name, exercises } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return toPublicPlan(plan as { dayType: string; name?: string; exercises: Exercise[] });
}

export async function deletePlan(ownerId: string, planId: string) {
  const result = await WorkoutPlan.deleteOne({ ownerId, dayType: planId });
  if (result.deletedCount) {
    const program = await WorkoutProgram.findOne({ ownerId });
    if (program) {
      program.days = program.days.map(day => day.planId === planId ? { ...day.toObject(), planId: null } : day) as typeof program.days;
      await program.save();
    }
  }
  return result.deletedCount > 0;
}

export async function listWeek(ownerId: string) {
  const program = await WorkoutProgram.findOne({ ownerId }).lean();
  if (program?.days.length === WORKOUT_WEEKDAYS.length) return program.days;

  const plans = await WorkoutPlan.find({ ownerId }).select("dayType").lean();
  const planIds = new Set(plans.map(plan => plan.dayType));
  const legacyAssignments = new Map(legacyWorkoutWeek.map(day => [day.key, day.planId]));
  return WORKOUT_WEEKDAYS.map(key => {
    const legacyPlanId = legacyAssignments.get(key) ?? null;
    return {
      key,
      label: WORKOUT_WEEKDAY_LABELS[key],
      planId: legacyPlanId && planIds.has(legacyPlanId) ? legacyPlanId : null,
    };
  });
}

export async function saveWeek(ownerId: string, days: { key: string; label: string; planId: string | null }[]) {
  const program = await WorkoutProgram.findOneAndUpdate(
    { ownerId },
    { $set: { ownerId, days } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return program?.days ?? days;
}

export async function ownerHasPlan(ownerId: string, planId: string) {
  return Boolean(await WorkoutPlan.exists({ ownerId, dayType: planId }));
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
