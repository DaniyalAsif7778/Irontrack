import { WORKOUT_DAYS } from "../../models/workout/workout.model.js";

export type WorkoutDay = typeof WORKOUT_DAYS[number];
export type Exercise = {
  id: string; name: string; sets: number; reps: number; muscle: string;
  tempo: string; rest: number; cues: string[];
};

const basePlans: Record<"push" | "pull" | "legs", Exercise[]> = {
  push: [
    { id: "push-floor-press", name: "Dumbbell Floor Press", sets: 3, reps: 10, muscle: "Chest", tempo: "3-1-2", rest: 60, cues: ["Keep your wrists stacked over your elbows.", "Lower until your upper arms rest lightly on the floor."] },
    { id: "push-shoulder-press", name: "Standing Shoulder Press", sets: 3, reps: 10, muscle: "Shoulders", tempo: "2-1-2", rest: 60, cues: ["Brace your midsection and avoid leaning back.", "Press in a smooth, controlled path."] },
    { id: "push-squeeze-press", name: "Dumbbell Squeeze Press", sets: 3, reps: 12, muscle: "Chest", tempo: "3-1-2", rest: 60, cues: ["Keep the dumbbells gently pressed together.", "Use a comfortable range of motion."] },
    { id: "push-lateral-raise", name: "Lateral Raise", sets: 3, reps: 12, muscle: "Shoulders", tempo: "2-1-3", rest: 45, cues: ["Use a light weight and soft elbows.", "Stop around shoulder height."] },
    { id: "push-triceps-extension", name: "Overhead Triceps Extension", sets: 3, reps: 12, muscle: "Triceps", tempo: "3-1-2", rest: 45, cues: ["Keep your elbows pointing forward.", "Choose a load you can control throughout."] }
  ],
  pull: [
    { id: "pull-row", name: "Single-arm Dumbbell Row", sets: 3, reps: 10, muscle: "Back", tempo: "2-1-3", rest: 60, cues: ["Support one hand on a stable surface.", "Pull toward your hip without twisting."] },
    { id: "pull-reverse-fly", name: "Bent-over Reverse Fly", sets: 3, reps: 12, muscle: "Rear shoulders", tempo: "2-1-3", rest: 45, cues: ["Keep your back long and knees soft.", "Use a light load and avoid swinging."] },
    { id: "pull-pullover", name: "Dumbbell Pullover", sets: 3, reps: 10, muscle: "Back", tempo: "3-1-2", rest: 60, cues: ["Keep ribs comfortably down.", "Move only through a pain-free range."] },
    { id: "pull-curl", name: "Alternating Biceps Curl", sets: 3, reps: 10, muscle: "Biceps", tempo: "2-1-3", rest: 45, cues: ["Keep elbows near your sides.", "Lower each rep with control."] },
    { id: "pull-hammer-curl", name: "Hammer Curl", sets: 3, reps: 10, muscle: "Biceps", tempo: "2-1-3", rest: 45, cues: ["Keep palms facing each other.", "Avoid rocking your torso."] }
  ],
  legs: [
    { id: "legs-goblet-squat", name: "Goblet Squat", sets: 3, reps: 10, muscle: "Quadriceps", tempo: "3-1-2", rest: 75, cues: ["Keep your whole foot grounded.", "Use a depth that feels stable and comfortable."] },
    { id: "legs-rdl", name: "Dumbbell Romanian Deadlift", sets: 3, reps: 10, muscle: "Hamstrings", tempo: "3-1-2", rest: 75, cues: ["Push your hips back with a soft knee bend.", "Keep the dumbbells close to your legs."] },
    { id: "legs-reverse-lunge", name: "Reverse Lunge", sets: 3, reps: 8, muscle: "Glutes", tempo: "2-1-2", rest: 60, cues: ["Hold a wall for balance if needed.", "Step back to a comfortable stance."] },
    { id: "legs-glute-bridge", name: "Dumbbell Glute Bridge", sets: 3, reps: 12, muscle: "Glutes", tempo: "2-1-2", rest: 45, cues: ["Keep your ribs relaxed.", "Pause briefly at the top without overextending."] },
    { id: "legs-calf-raise", name: "Standing Calf Raise", sets: 3, reps: 15, muscle: "Calves", tempo: "2-1-3", rest: 45, cues: ["Hold a stable support if needed.", "Move slowly through a comfortable range."] }
  ]
};

const highRep = (exercises: Exercise[]): Exercise[] => exercises.map(exercise => ({
  ...exercise, id: `${exercise.id}-high`, reps: exercise.reps + 5, rest: Math.max(20, exercise.rest - 10), cues: [...exercise.cues]
}));

export const defaultWorkoutPlans: Record<WorkoutDay, Exercise[]> = {
  push: basePlans.push,
  pull: basePlans.pull,
  legs: basePlans.legs,
  push_high: highRep(basePlans.push),
  pull_high: highRep(basePlans.pull),
  legs_high: highRep(basePlans.legs)
};

export const workoutWeek = [
  { key: "mon", label: "Monday", dayType: "push" as const },
  { key: "tue", label: "Tuesday", dayType: "pull" as const },
  { key: "wed", label: "Wednesday", dayType: "legs" as const },
  { key: "thu", label: "Thursday", dayType: "push_high" as const },
  { key: "fri", label: "Friday", dayType: "pull_high" as const },
  { key: "sat", label: "Saturday", dayType: "legs_high" as const },
  { key: "sun", label: "Sunday", dayType: null }
];
