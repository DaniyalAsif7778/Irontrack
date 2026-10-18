import { defaultWorkoutPlans, type Exercise, type WorkoutDay } from "../services/workout/workoutData.js";
import { workoutLogPayload, workoutPlanPayload } from "./workoutValidation.js";

const dayAliases: Record<string, WorkoutDay> = {
  push: "push", pull: "pull", legs: "legs",
  push_high: "push_high", pull_high: "pull_high", legs_high: "legs_high",
  push_high_rep: "push_high", pull_high_rep: "pull_high", legs_high_rep: "legs_high",
};

type WorkoutImport = {
  plans: { dayType: WorkoutDay; exercises: Exercise[] }[];
  logs: ReturnType<typeof workoutLogPayload>[];
  progression: { exerciseId: string; maxReps: number; maxSets: number; sessions: number; lastDate: string }[];
};

export function extractWorkoutExport(payload: unknown): WorkoutImport {
  const root = payload as any;
  if (root?.app !== "IronTrack" || root?.scope !== "workout" || !root?.data || typeof root.data !== "object") {
    throw new Error("This is not an IronTrack workout export");
  }

  const plans: WorkoutImport["plans"] = [];
  const exercisesByDay = new Map<WorkoutDay, Exercise[]>();
  const exercisesById = new Map<string, any>();
  for (const [sourceDay, rawExercises] of Object.entries(root.data.custom_workout_plan ?? {})) {
    const dayType = dayAliases[sourceDay];
    if (!dayType || !Array.isArray(rawExercises)) continue;
    const exercises = workoutPlanPayload({ exercises: rawExercises.map((exercise: any) => ({
      id: exercise?.id,
      name: exercise?.name,
      sets: exercise?.sets,
      reps: exercise?.reps,
      muscle: exercise?.muscle || "General",
      tempo: typeof exercise?.tempo === "string" ? exercise.tempo : "3-1-2",
      rest: Number.isFinite(exercise?.rest) ? exercise.rest : 60,
      cues: Array.isArray(exercise?.cues) ? exercise.cues : [],
    })) });
    plans.push({ dayType, exercises });
    exercisesByDay.set(dayType, exercises);
    for (const exercise of rawExercises) if (typeof exercise?.id === "string") exercisesById.set(exercise.id, exercise);
  }

  const logs: WorkoutImport["logs"] = [];
  for (const [sourceKey, rawLog] of Object.entries(root.data.ppl_workout_logs ?? {})) {
    if (!rawLog || typeof rawLog !== "object") continue;
    const log = rawLog as any;
    const date = typeof log.date === "string" ? log.date : sourceKey.slice(0, 10);
    const sourceDay = typeof log.dayType === "string" ? log.dayType : sourceKey.slice(11);
    const dayType = dayAliases[sourceDay];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !dayType) continue;
    const planExercises = exercisesByDay.get(dayType) ?? defaultWorkoutPlans[dayType];
    const planById = new Map(planExercises.map(exercise => [exercise.id, exercise]));
    const loggedExercises = Object.entries(log.completedSets ?? {}).flatMap(([exerciseId, rawSets]) => {
      if (!Array.isArray(rawSets)) return [];
      const planExercise = planById.get(exerciseId);
      const sourceExercise = exercisesById.get(exerciseId);
      const sets = rawSets.flatMap((value: unknown, index: number) => {
        const savedSet = value && typeof value === "object" ? value as any : null;
        const reps = typeof value === "number" ? value : Number(savedSet?.reps);
        const fallbackWeight = Number(sourceExercise?.setList?.[index]?.weight ?? 0);
        const weight = Number.isFinite(savedSet?.weight) && savedSet.weight >= 0 ? savedSet.weight : Number.isFinite(fallbackWeight) && fallbackWeight >= 0 ? fallbackWeight : 0;
        return Number.isInteger(reps) && reps >= 0 && reps <= 1000 ? [{ reps, weight }] : [];
      });
      return sets.length ? [{
        exerciseId,
        name: planExercise?.name ?? sourceExercise?.name ?? exerciseId.replace(/[-_]+/g, " "),
        muscle: planExercise?.muscle ?? sourceExercise?.muscle ?? "General",
        sets,
      }] : [];
    });
    const rawDuration = Number(log.duration);
    // Early IronTrack exports stored session lengths in minutes; newer ones use seconds.
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration <= 180 ? rawDuration * 60 : rawDuration) : 0;
    logs.push(workoutLogPayload({ date, dayType, exercises: loggedExercises, duration }));
  }

  const progression = Object.entries(root.data.ppl_progression ?? {}).flatMap(([exerciseId, raw]: [string, any]) => {
    if (!raw || typeof raw !== "object") return [];
    const maxReps = Number(raw.maxReps), maxSets = Number(raw.maxSets), sessions = Number(raw.sessions);
    const lastDate = typeof raw.lastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastDate) ? raw.lastDate : "1970-01-01";
    if (![maxReps, maxSets, sessions].every(value => Number.isInteger(value) && value >= 0 && value <= 10000)) return [];
    return [{ exerciseId, maxReps, maxSets, sessions, lastDate }];
  });

  return {
    plans,
    logs,
    progression,
  };
}
