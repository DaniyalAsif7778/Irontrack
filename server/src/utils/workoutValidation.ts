import { WORKOUT_WEEKDAYS, WORKOUT_WEEKDAY_LABELS } from "../models/workout/workout.model.js";
import type { Exercise } from "../services/workout/workoutData.js";
import { isValidDateKey } from "./dateValidation.js";

const isPlanId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);

export function workoutPlanPayload(input: any) {
  if (!Array.isArray(input?.exercises) || input.exercises.length > 40) throw new Error("exercises must be a list of up to 40 items");
  const exercises: Exercise[] = input.exercises.map((exercise: any) => {
    if (!exercise || typeof exercise.id !== "string" || !exercise.id.trim()) throw new Error("every exercise needs an id");
    if (typeof exercise.name !== "string" || !exercise.name.trim()) throw new Error("every exercise needs a name");
    if (typeof exercise.muscle !== "string" || !exercise.muscle.trim()) throw new Error("every exercise needs a muscle group");
    if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20) throw new Error("sets must be from 1 to 20");
    if (!Number.isInteger(exercise.reps) || exercise.reps < 1 || exercise.reps > 100) throw new Error("reps must be from 1 to 100");
    if (!Number.isFinite(exercise.rest) || exercise.rest < 0 || exercise.rest > 600) throw new Error("rest must be from 0 to 600 seconds");
    if (typeof exercise.tempo !== "string") throw new Error("tempo must be text");
    if (!Array.isArray(exercise.cues) || exercise.cues.some((cue: unknown) => typeof cue !== "string")) throw new Error("cues must be a list of text");
    const setList = exercise.setList === undefined ? Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 })) : exercise.setList;
    if (!Array.isArray(setList) || setList.length > 20 || setList.some((set: any) => !Number.isInteger(set?.reps) || set.reps < 1 || set.reps > 1000 || !Number.isFinite(set?.weight) || set.weight < 0 || set.weight > 10000)) throw new Error("set list must contain valid reps and weight");
    const steps = exercise.steps ?? [];
    if (!Array.isArray(steps) || steps.some((step: unknown) => typeof step !== "string")) throw new Error("steps must be a list of text");
    const description = exercise.description ?? "", videoUrl = exercise.videoUrl ?? "";
    if (typeof description !== "string" || description.length > 4000) throw new Error("description must be text under 4000 characters");
    if (typeof videoUrl !== "string" || videoUrl.length > 2048) throw new Error("video URL must be text under 2048 characters");
    if (videoUrl) { let parsed: URL; try { parsed = new URL(videoUrl); } catch { throw new Error("video URL must be a valid URL"); } if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("video URL must use HTTP or HTTPS"); }
    return { id: exercise.id.trim(), name: exercise.name.trim(), muscle: exercise.muscle.trim(), sets: exercise.sets, reps: exercise.reps, rest: exercise.rest, tempo: exercise.tempo.trim(), cues: exercise.cues.map((cue: string) => cue.trim()).filter(Boolean), description, setList: setList.map((set: any, index: number) => ({ id: typeof set.id === "string" && set.id.trim() ? set.id.trim() : `set-${index + 1}`, reps: set.reps, weight: set.weight })), steps: steps.map((step: string) => step.trim()).filter(Boolean), videoUrl: videoUrl.trim() };
  });
  if (new Set(exercises.map(exercise => exercise.id)).size !== exercises.length) throw new Error("exercise ids must be unique");
  return exercises;
}

export function workoutPlanDataPayload(input: any) {
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) {
    throw new Error("workout day name must contain 1 to 80 characters");
  }
  return { name: input.name.trim(), exercises: workoutPlanPayload(input) };
}

export function workoutExercisePayload(input: any, exerciseId: string) {
  if (!isPlanId(exerciseId)) throw new Error("exercise ID is invalid");
  return workoutPlanPayload({ exercises: [{ ...input, id: exerciseId }] })[0];
}

type ExerciseLibraryPayload = { id: string; name: string; muscle: string; description: string; cues: string[]; steps: string[]; videoUrl: string };
type WorkoutProgramPayload = { plans: { id: string; name: string; exercises: { exerciseId: string; sets: number; reps: number; rest: number; tempo: string; setList: { id: string; reps: number; weight: number }[] }[] }[]; days: { key: string; label: string; planId: string | null }[]; exerciseLibrary: ExerciseLibraryPayload[] };

function exerciseDefinitionPayload(input: any): ExerciseLibraryPayload {
  if (!input || !isPlanId(input.id) || typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120) throw new Error("exercise library entries need a valid ID and name");
  if (typeof input.muscle !== "string" || !input.muscle.trim() || input.muscle.trim().length > 80) throw new Error("exercise muscle group is required");
  const description = input.description ?? "", videoUrl = input.videoUrl ?? "";
  const cues = input.cues ?? [], steps = input.steps ?? [];
  if (typeof description !== "string" || description.length > 4000) throw new Error("exercise description must be under 4000 characters");
  if (!Array.isArray(cues) || cues.length > 40 || cues.some((cue: unknown) => typeof cue !== "string" || cue.length > 300)) throw new Error("exercise cues must be a list of short text");
  if (!Array.isArray(steps) || steps.length > 40 || steps.some((step: unknown) => typeof step !== "string" || step.length > 500)) throw new Error("exercise steps must be a list of text");
  if (typeof videoUrl !== "string" || videoUrl.length > 2048) throw new Error("video URL must be under 2048 characters");
  if (videoUrl) { let parsed: URL; try { parsed = new URL(videoUrl); } catch { throw new Error("video URL must be a valid URL"); } if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("video URL must use HTTP or HTTPS"); }
  return { id: input.id.trim(), name: input.name.trim(), muscle: input.muscle.trim(), description, cues: cues.map((cue: string) => cue.trim()).filter(Boolean), steps: steps.map((step: string) => step.trim()).filter(Boolean), videoUrl: videoUrl.trim() };
}

export function workoutProgramPayload(input: any, _ownedPlanIds: string[], ownedExerciseIds: string[]): WorkoutProgramPayload {
  if (!Array.isArray(input?.plans) || input.plans.length > 20) throw new Error("workout program must contain up to 20 workout days");
  if (!Array.isArray(input?.exerciseLibrary) || input.exerciseLibrary.length > 500) throw new Error("exercise library must contain up to 500 exercises");
  const plans = input.plans.map((plan: any) => {
    if (!plan || !isPlanId(plan.id)) throw new Error("workout day ID is invalid");
    if (typeof plan.name !== "string" || !plan.name.trim() || plan.name.trim().length > 80) throw new Error("workout day name must contain 1 to 80 characters");
    if (!Array.isArray(plan.exercises) || plan.exercises.length > 40) throw new Error("each workout day can contain up to 40 exercises");
    const exerciseIds = new Set<string>();
    const exercises = plan.exercises.map((exercise: any) => {
      if (!exercise || !isPlanId(exercise.exerciseId)) throw new Error("workout exercises must reference a valid exercise ID");
      if (exerciseIds.has(exercise.exerciseId)) throw new Error("exercise IDs must be unique within a workout day");
      exerciseIds.add(exercise.exerciseId);
      if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20) throw new Error("sets must be from 1 to 20");
      if (!Number.isInteger(exercise.reps) || exercise.reps < 1 || exercise.reps > 100) throw new Error("reps must be from 1 to 100");
      if (!Number.isFinite(exercise.rest) || exercise.rest < 0 || exercise.rest > 600) throw new Error("rest must be from 0 to 600 seconds");
      if (typeof exercise.tempo !== "string" || exercise.tempo.length > 40) throw new Error("tempo must be text under 40 characters");
      const setList = exercise.setList ?? [];
      if (!Array.isArray(setList) || setList.length > 20 || setList.some((set: any) => !Number.isInteger(set?.reps) || set.reps < 1 || set.reps > 1000 || !Number.isFinite(set?.weight) || set.weight < 0 || set.weight > 10000)) throw new Error("set list must contain valid reps and weight");
      return { exerciseId: exercise.exerciseId, sets: exercise.sets, reps: exercise.reps, rest: exercise.rest, tempo: exercise.tempo.trim(), setList: setList.map((set: any, index: number) => ({ id: typeof set.id === "string" && set.id.trim() ? set.id.trim() : `set-${index + 1}`, reps: set.reps, weight: set.weight })) };
    });
    return { id: plan.id, name: plan.name.trim(), exercises };
  });
  if (new Set(plans.map((plan: { id: string }) => plan.id)).size !== plans.length) throw new Error("workout day IDs must be unique");
  const exerciseLibrary = input.exerciseLibrary.map(exerciseDefinitionPayload);
  if (new Set(exerciseLibrary.map((exercise: { id: string }) => exercise.id)).size !== exerciseLibrary.length) throw new Error("exercise library IDs must be unique");
  const availableExercises = new Set([...ownedExerciseIds, ...exerciseLibrary.map((exercise: { id: string }) => exercise.id)]);
  for (const plan of plans) for (const exercise of plan.exercises) {
    if (!availableExercises.has(exercise.exerciseId)) throw new Error("exercise must belong to this account's exercise library");
  }
  const days = workoutWeekPayload({ days: input.days }, plans.map((plan: { id: string }) => plan.id)).days;
  return { plans, days, exerciseLibrary };
}

export function workoutWeekPayload(input: any, ownedPlanIds: string[]) {
  if (!Array.isArray(input?.days) || input.days.length !== WORKOUT_WEEKDAYS.length) {
    throw new Error("weekly schedule must contain exactly seven days");
  }
  const byKey = new Map<string, any>();
  for (const day of input.days) {
    if (!day || !WORKOUT_WEEKDAYS.includes(day.key)) throw new Error("weekly schedule contains an invalid weekday");
    if (byKey.has(day.key)) throw new Error("weekday keys must be unique");
    byKey.set(day.key, day);
  }
  if (byKey.size !== WORKOUT_WEEKDAYS.length) throw new Error("weekly schedule must include each unique weekday");
  return {
    days: WORKOUT_WEEKDAYS.map(key => {
      const planId = byKey.get(key).planId;
      if (planId !== null && !isPlanId(planId)) throw new Error("weekday plan assignment is invalid");
      if (planId !== null && !ownedPlanIds.includes(planId)) throw new Error("workout day must belong to this account");
      return { key, label: WORKOUT_WEEKDAY_LABELS[key], planId };
    }),
  };
}

export function workoutLogPayload(input: any) {
  const date = input?.date;
  if (!isValidDateKey(date)) throw new Error("date must be a real calendar day in YYYY-MM-DD format");
  if (!isPlanId(input.dayType)) throw new Error("invalid workout day");
  const dayName = typeof input.dayName === "string" ? input.dayName.trim() : "";
  if (dayName.length > 80) throw new Error("workout day name is too long");
  if (!Array.isArray(input.exercises)) throw new Error("exercises must be a list");
  if (!Number.isFinite(input.duration) || input.duration < 0 || input.duration > 86400) throw new Error("duration must be between 0 and 86400 seconds");
  const exercises = input.exercises.map((exercise: any) => {
    if (typeof exercise?.exerciseId !== "string" || typeof exercise?.name !== "string") throw new Error("each logged exercise needs an id and name");
    if (!Array.isArray(exercise.sets)) throw new Error("each logged exercise needs a set list");
    const sets = exercise.sets.map((set: any) => {
      if (!Number.isInteger(set?.reps) || set.reps < 0 || set.reps > 1000 || !Number.isFinite(set?.weight) || set.weight < 0 || set.weight > 10000) throw new Error("sets need valid reps and weight");
      return { reps: set.reps, weight: set.weight };
    });
    return { exerciseId: exercise.exerciseId, name: exercise.name, muscle: typeof exercise.muscle === "string" ? exercise.muscle : "", sets };
  });
  const totalSets = exercises.reduce((total: number, exercise: { sets: unknown[] }) => total + exercise.sets.length, 0);
  const totalVolume = exercises.reduce((total: number, exercise: { sets: { reps: number; weight: number }[] }) => total + exercise.sets.reduce((sum, set) => sum + set.reps * set.weight, 0), 0);
  const actionId = typeof input.actionId === "string" && input.actionId.length <= 120 ? input.actionId : "";
  return { date, dayType: input.dayType, dayName, exercises, totalSets, totalVolume, duration: Math.round(input.duration), actionId };
}

export function workoutLogLimit(input: unknown) {
  if (input === undefined || input === null) return 30;
  if (typeof input !== "string" || !input.trim()) throw new Error("limit must be a whole number");
  const parsed = Number(input);
  if (!Number.isSafeInteger(parsed)) throw new Error("limit must be a whole number");
  return Math.min(Math.max(parsed, 1), 200);
}

export type WorkoutLogCursor = { date: string; completedAt: string; id: string };

export function workoutLogCursor(input: unknown): WorkoutLogCursor | null {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input !== "string" || input.length > 512) throw new Error("cursor is invalid");
  try {
    const parsed = JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as Partial<WorkoutLogCursor>;
    if (!isValidDateKey(parsed.date) || typeof parsed.completedAt !== "string" || !Number.isFinite(Date.parse(parsed.completedAt)) || typeof parsed.id !== "string" || !/^[a-f0-9]{24}$/i.test(parsed.id)) {
      throw new Error("invalid cursor fields");
    }
    return { date: parsed.date, completedAt: new Date(parsed.completedAt).toISOString(), id: parsed.id };
  } catch {
    throw new Error("cursor is invalid");
  }
}
