export type WorkoutDay = string;
export type ExerciseSet = { id?: string; reps: number; weight: number };
export type Exercise = {
  id: string; name: string; sets: number; reps: number; muscle: string;
  tempo: string; rest: number; cues: string[]; description?: string;
  setList?: ExerciseSet[]; steps?: string[]; videoUrl?: string;
};

// Labels and assignments are only used to read existing saved plans during migration.
export const legacyWorkoutNames: Record<string, string> = {
  push: "Push", pull: "Pull", legs: "Legs",
  push_high: "Push · high rep", pull_high: "Pull · high rep", legs_high: "Legs · high rep",
};

export const legacyWorkoutWeek: { key: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; planId: string | null }[] = [
  { key: "mon", planId: "push" }, { key: "tue", planId: "pull" }, { key: "wed", planId: "legs" },
  { key: "thu", planId: "push_high" }, { key: "fri", planId: "pull_high" }, { key: "sat", planId: "legs_high" }, { key: "sun", planId: null },
];
