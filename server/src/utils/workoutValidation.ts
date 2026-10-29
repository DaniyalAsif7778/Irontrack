import { WORKOUT_WEEKDAYS, WORKOUT_WEEKDAY_LABELS } from "../models/workout/workout.model.js";
import type { Exercise } from "../services/workout/workoutData.js";

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input?.date ?? "")) throw new Error("date must be YYYY-MM-DD");
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
  return { date: input.date, dayType: input.dayType, dayName, exercises, totalSets, totalVolume, duration: Math.round(input.duration), actionId };
}
