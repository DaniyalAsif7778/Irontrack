import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { ExerciseLibrary, WorkoutLog, WorkoutPlan, WorkoutProgram, WORKOUT_WEEKDAYS, WORKOUT_WEEKDAY_LABELS } from "../../models/workout/workout.model.js";
import { legacyWorkoutNames, legacyWorkoutWeek, type Exercise } from "./workoutData.js";
import type { workoutProgramPayload } from "../../utils/workoutValidation.js";

type ExerciseReference = { exerciseId: string; sets: number; reps: number; rest: number; tempo: string; setList: { id?: string; reps: number; weight: number }[] };
type ExerciseDefinition = { id: string; name: string; muscle: string; description?: string; cues?: string[]; steps?: string[]; videoUrl?: string };
type StoredPlan = { dayType: string; name?: string; exercises: ExerciseReference[] };

const validStableId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);

function legacyExerciseId(planId: string, index: number, legacyId: unknown) {
  if (validStableId(legacyId)) return legacyId;
  return `legacy-${createHash("sha256").update(`${planId}:${index}:${String(legacyId ?? "")}`).digest("hex").slice(0, 32)}`;
}

async function migrateLegacyPlans(ownerId: string) {
  const ownerObjectId = new Types.ObjectId(ownerId);
  const saved = await WorkoutPlan.collection.find({ ownerId: ownerObjectId }).toArray();
  const definitions = new Map<string, ExerciseDefinition>();
  const planUpdates: { updateOne: { filter: { _id: unknown }; update: { $set: { exercises: ExerciseReference[] } } } }[] = [];

  for (const plan of saved) {
    const refs: ExerciseReference[] = [];
    let changed = false;
    for (const [index, rawValue] of (plan.exercises ?? []).entries()) {
      const raw = rawValue as Record<string, any>;
      if (typeof raw.exerciseId === "string" && raw.exerciseId) {
        refs.push({ exerciseId: raw.exerciseId, sets: raw.sets, reps: raw.reps, rest: raw.rest, tempo: raw.tempo ?? "3-1-2", setList: raw.setList ?? [] });
        continue;
      }
      changed = true;
      const id = legacyExerciseId(plan.dayType, index, raw.id);
      if (!definitions.has(id)) definitions.set(id, {
        id, name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Untitled exercise",
        muscle: typeof raw.muscle === "string" && raw.muscle.trim() ? raw.muscle.trim() : "General",
        description: raw.description ?? "", cues: raw.cues ?? [], steps: raw.steps ?? [], videoUrl: raw.videoUrl ?? "",
      });
      refs.push({ exerciseId: id, sets: raw.sets, reps: raw.reps, rest: raw.rest ?? 60, tempo: raw.tempo ?? "3-1-2", setList: raw.setList ?? [] });
    }
    if (changed) planUpdates.push({ updateOne: { filter: { _id: plan._id as Types.ObjectId }, update: { $set: { exercises: refs } } } });
  }

  if (definitions.size) {
    const operations = [...definitions.values()].map(definition => ({
      updateOne: {
        filter: { ownerId: ownerObjectId, exerciseId: definition.id },
        update: { $setOnInsert: { ownerId: ownerObjectId, exerciseId: definition.id, name: definition.name, muscle: definition.muscle, description: definition.description, cues: definition.cues, steps: definition.steps, videoUrl: definition.videoUrl } },
        upsert: true,
      },
    }));
    try { await ExerciseLibrary.bulkWrite(operations, { ordered: false }); }
    catch (error) { if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error; }
  }
  if (planUpdates.length) await WorkoutPlan.collection.bulkWrite(planUpdates as any, { ordered: true });
}

function publicExercise(reference: ExerciseReference, definition?: ExerciseDefinition): Exercise {
  return {
    id: reference.exerciseId,
    name: definition?.name ?? "Unavailable exercise",
    muscle: definition?.muscle ?? "General",
    description: definition?.description ?? "",
    cues: definition?.cues ?? [],
    steps: definition?.steps ?? [],
    videoUrl: definition?.videoUrl ?? "",
    sets: reference.sets, reps: reference.reps, rest: reference.rest, tempo: reference.tempo,
    setList: reference.setList ?? [],
  };
}

function toPublicPlan(plan: StoredPlan, library: Map<string, ExerciseDefinition>) {
  return {
    id: plan.dayType,
    name: plan.name?.trim() || legacyWorkoutNames[plan.dayType] || "Workout day",
    exercises: (plan.exercises ?? []).map(reference => publicExercise(reference, library.get(reference.exerciseId))),
  };
}

async function libraryMap(ownerId: string, exerciseIds: string[]) {
  if (!exerciseIds.length) return new Map<string, ExerciseDefinition>();
  const items = await ExerciseLibrary.find({ ownerId, exerciseId: { $in: [...new Set(exerciseIds)] } }).lean();
  return new Map(items.map(item => [item.exerciseId, {
    id: item.exerciseId, name: item.name, muscle: item.muscle, description: item.description,
    cues: item.cues, steps: item.steps, videoUrl: item.videoUrl,
  }]));
}

export async function listPlans(ownerId: string) {
  await migrateLegacyPlans(ownerId);
  const saved = await WorkoutPlan.find({ ownerId }).sort({ createdAt: 1 }).lean() as unknown as StoredPlan[];
  const ids = saved.flatMap(plan => plan.exercises.map(exercise => exercise.exerciseId));
  const library = await libraryMap(ownerId, ids);
  return saved.map(plan => toPublicPlan(plan, library));
}

export async function listExerciseLibrary(ownerId: string) {
  await migrateLegacyPlans(ownerId);
  const saved = await ExerciseLibrary.find({ ownerId }).sort({ name: 1, exerciseId: 1 }).lean();
  return saved.map(item => ({ id: item.exerciseId, name: item.name, muscle: item.muscle, description: item.description, cues: item.cues, steps: item.steps, videoUrl: item.videoUrl }));
}

function definitionFromExercise(exercise: Exercise): ExerciseDefinition {
  return { id: exercise.id, name: exercise.name, muscle: exercise.muscle, description: exercise.description ?? "", cues: exercise.cues ?? [], steps: exercise.steps ?? [], videoUrl: exercise.videoUrl ?? "" };
}

function referenceFromExercise(exercise: Exercise): ExerciseReference {
  return { exerciseId: exercise.id, sets: exercise.sets, reps: exercise.reps, rest: exercise.rest, tempo: exercise.tempo, setList: exercise.setList ?? [] };
}

export async function savePlan(ownerId: string, planId: string, name: string, exercises: Exercise[]) {
  const owner = new Types.ObjectId(ownerId);
  if (exercises.length) await ExerciseLibrary.bulkWrite(exercises.map(exercise => ({
    updateOne: { filter: { ownerId: owner, exerciseId: exercise.id }, update: { $set: { ownerId: owner, exerciseId: exercise.id, ...definitionFromExercise(exercise) } }, upsert: true },
  })), { ordered: true });
  await WorkoutPlan.findOneAndUpdate(
    { ownerId, dayType: planId },
    { $set: { ownerId, dayType: planId, name, exercises: exercises.map(referenceFromExercise) } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  const saved = (await listPlans(ownerId)).find(plan => plan.id === planId);
  return saved!;
}

export async function savePlanExercise(ownerId: string, planId: string, exercise: Exercise, planName?: string, dayKey?: string) {
  const owner = new Types.ObjectId(ownerId);
  const plan = await WorkoutPlan.findOne({ ownerId: owner, dayType: planId }).lean() as unknown as StoredPlan | null;
  if (!plan && (!planName || !dayKey || !WORKOUT_WEEKDAYS.includes(dayKey as typeof WORKOUT_WEEKDAYS[number]))) throw new Error("A new workout day needs a name and weekday");
  if (!plan && await WorkoutPlan.countDocuments({ ownerId: owner }) >= 20) throw new Error("You can save up to 20 workout days");
  const existing = (plan?.exercises ?? []).some(item => item.exerciseId === exercise.id);
  if (plan && !existing && (plan.exercises?.length ?? 0) >= 40) throw new Error("A workout day can contain up to 40 exercises");

  // These writes are idempotent and deliberately avoid requiring replica-set transactions.
  await ExerciseLibrary.findOneAndUpdate(
    { ownerId: owner, exerciseId: exercise.id },
    { $set: { ownerId: owner, exerciseId: exercise.id, name: exercise.name, muscle: exercise.muscle, description: exercise.description ?? "", cues: exercise.cues ?? [], steps: exercise.steps ?? [], videoUrl: exercise.videoUrl ?? "" } },
    { upsert: true, new: true, runValidators: true },
  );

  const reference = referenceFromExercise(exercise);
  if (!plan) {
    try {
      await WorkoutPlan.findOneAndUpdate(
        { ownerId: owner, dayType: planId },
        { $setOnInsert: { ownerId: owner, dayType: planId, name: planName, exercises: [reference] } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    }
    await WorkoutPlan.updateOne(
      { ownerId: owner, dayType: planId, "exercises.exerciseId": { $ne: exercise.id } },
      { $push: { exercises: reference } },
      { runValidators: true },
    );
  } else if (existing) {
    await WorkoutPlan.updateOne(
      { ownerId: owner, dayType: planId, "exercises.exerciseId": exercise.id },
      { $set: { "exercises.$": reference, ...(planName ? { name: planName } : {}) } },
      { runValidators: true },
    );
  } else {
    const appended = await WorkoutPlan.updateOne(
      { ownerId: owner, dayType: planId, "exercises.exerciseId": { $ne: exercise.id } },
      { $push: { exercises: reference }, ...(planName ? { $set: { name: planName } } : {}) },
      { runValidators: true },
    );
    if (appended.matchedCount === 0) await WorkoutPlan.updateOne(
      { ownerId: owner, dayType: planId, "exercises.exerciseId": exercise.id },
      { $set: { "exercises.$": reference, ...(planName ? { name: planName } : {}) } },
      { runValidators: true },
    );
  }

  if (dayKey && WORKOUT_WEEKDAYS.includes(dayKey as typeof WORKOUT_WEEKDAYS[number])) {
    const days = await listWeek(ownerId) as { key: string; label: string; planId: string | null }[];
    await saveWeek(ownerId, days.map(day => day.key === dayKey ? { ...day, planId } : day));
  }
  return exercise;
}

export async function saveWorkoutProgram(ownerId: string, data: ReturnType<typeof workoutProgramPayload>) {
  const owner = new Types.ObjectId(ownerId);
  if (data.exerciseLibrary.length) await ExerciseLibrary.bulkWrite(data.exerciseLibrary.map((definition: ExerciseDefinition) => ({
        updateOne: {
          filter: { ownerId: owner, exerciseId: definition.id },
          update: { $set: { ownerId: owner, exerciseId: definition.id, name: definition.name, muscle: definition.muscle, description: definition.description, cues: definition.cues, steps: definition.steps, videoUrl: definition.videoUrl } },
          upsert: true,
        },
      })), { ordered: true });
  if (data.plans.length) await WorkoutPlan.bulkWrite(data.plans.map((plan: { id: string; name: string; exercises: ExerciseReference[] }) => ({
        updateOne: {
          filter: { ownerId: owner, dayType: plan.id },
          update: { $set: { ownerId: owner, dayType: plan.id, name: plan.name, exercises: plan.exercises } },
          upsert: true,
        },
      })) as any, { ordered: true });
  await WorkoutPlan.deleteMany({ ownerId: owner, dayType: { $nin: data.plans.map((plan: { id: string }) => plan.id) } });
  await WorkoutProgram.findOneAndUpdate(
    { ownerId: owner }, { $set: { ownerId: owner, days: data.days } },
    { upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
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
    return { key, label: WORKOUT_WEEKDAY_LABELS[key], planId: legacyPlanId && planIds.has(legacyPlanId) ? legacyPlanId : null };
  });
}

export async function saveWeek(ownerId: string, days: { key: string; label: string; planId: string | null }[]) {
  const program = await WorkoutProgram.findOneAndUpdate(
    { ownerId }, { $set: { ownerId, days } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return program?.days ?? days;
}

export async function ownerHasPlan(ownerId: string, planId: string) {
  return Boolean(await WorkoutPlan.exists({ ownerId, dayType: planId }));
}

export async function listLogs(ownerId: string, limit: number) {
  return WorkoutLog.find({ ownerId }).sort({ date: -1, completedAt: -1 }).limit(limit).lean();
}

export async function saveLog(ownerId: string, data: ReturnType<typeof import("../../utils/workoutValidation.js").workoutLogPayload>) {
  if (data.actionId) {
    const existingAction = await WorkoutLog.findOne({ ownerId, actionId: data.actionId });
    if (existingAction) return existingAction;
  }
  if (await WorkoutLog.exists({ ownerId, date: data.date, dayType: data.dayType })) return null;
  try { return await WorkoutLog.create({ ...data, ownerId }); }
  catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    if (data.actionId) {
      const existingAction = await WorkoutLog.findOne({ ownerId, actionId: data.actionId });
      if (existingAction) return existingAction;
    }
    if (await WorkoutLog.exists({ ownerId, date: data.date, dayType: data.dayType })) return null;
    throw error;
  }
}
