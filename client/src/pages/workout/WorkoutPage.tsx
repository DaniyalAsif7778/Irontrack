import { useEffect, useMemo, useRef, useState } from "react";
import { Fragment } from "react";
import { AudioLines, BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, Pause, Pencil, Play, RotateCcw, Square, TimerReset, X, Zap } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../../lib/api/api";
import { enqueueOfflineAction } from "../../lib/api/offlineQueue";
import { toast } from "sonner";
import { ironToday } from "../../utils/date";
import { useAppStore } from "../../stores/appStore";

type DayType = string;
type Exercise = { id: string; name: string; sets: number; reps: number; muscle: string; tempo: string; rest: number; cues: string[]; description?: string; setList?: { id?: string; reps: number; weight: number }[]; steps?: string[]; videoUrl?: string };
type LibraryExercise = Pick<Exercise, "id" | "name" | "muscle" | "cues" | "description" | "steps" | "videoUrl">;
type Plan = { id: string; name: string; exercises: Exercise[] };
type WorkoutLog = { _id: string; date: string; dayType: DayType; dayName?: string; exercises: { exerciseId: string; name: string; muscle: string; sets: { reps: number; weight: number }[] }[]; totalSets: number; totalVolume: number; duration: number };
type WeekDay = { key: string; label: string; planId: DayType | null };
type SetEntry = { reps: number; weight: number; completed: boolean };
type WorkoutLogPage = { items: WorkoutLog[]; nextCursor: string | null; hasMore: boolean };
type WorkoutSaveResult = { queuedOffline?: boolean; feedback?: { type: string; title: string; message: string }[] };
type ActiveWorkout = { date: string; dayType: DayType; dayName: string; startedAt: number; exerciseStartedAt?: number; elapsedBeforePause: number; pausedAt: number | null; pausedRestSeconds: number | null; entries: Record<string, SetEntry[]>; restUntil: number | null; repStartedAt?: number; repElapsedBeforePause?: number; currentExerciseIndex?: number; pendingExerciseIndex?: number | null; restMode?: "set" | "exercise" | "rep"; exerciseSnapshots?: Exercise[]; autoAdvance?: boolean; voiceCoach?: boolean; skippedExercises?: string[] };

const activeKey = (accountId?: string) => `irontrack_active_workout_v1:${accountId ?? "local"}`;
const workoutNameSuggestionsKey = (accountId?: string) => `irontrack_workout_name_suggestions_v1:${accountId ?? "local"}`;
function readWorkoutNameSuggestions(accountId?: string): string[] {
  try {
    const names = JSON.parse(localStorage.getItem(workoutNameSuggestionsKey(accountId)) ?? "[]");
    return Array.isArray(names) ? names.filter((name): name is string => typeof name === "string" && name.trim().length > 0 && name.trim().length <= 80) : [];
  } catch { return []; }
}
function tempoParts(tempo: string): [number, number, number] {
  const values = tempo.split(/[\s-]+/).map(Number);
  return values.length === 3 && values.every(value => Number.isInteger(value) && value >= 0 && value <= 10) ? values as [number, number, number] : [3, 1, 2];
}
const spokenCount = (count: number) => numberWords[count - 1] ?? String(count);
const legacyDayLabels: Record<string, string> = { push: "Push", pull: "Pull", legs: "Legs", push_high: "Push · high rep", pull_high: "Pull · high rep", legs_high: "Legs · high rep" };
const poundsPerKilogram = 2.2046226218;
/** Workout weights stay stored in kg so logs and volume charts use one consistent unit. */
const toDisplayWeight = (kilograms: number, unit: "kg" | "lb") => unit === "lb" ? Number((kilograms * poundsPerKilogram).toFixed(1)) : kilograms;
const toStoredWeight = (weight: number, unit: "kg" | "lb") => unit === "lb" ? weight / poundsPerKilogram : weight;
/** Restore only this account's saved session so a shared browser cannot show another user's workout. */
const readActive = (storageKey: string): ActiveWorkout | null => {
  try { const value = localStorage.getItem(storageKey); if (!value) return null; const parsed = JSON.parse(value) as Partial<ActiveWorkout> & Pick<ActiveWorkout, "date" | "dayType" | "startedAt" | "entries">; const coachEnabled = Boolean(parsed.autoAdvance || parsed.voiceCoach); return { ...parsed, dayName: parsed.dayName ?? legacyDayLabels[parsed.dayType] ?? "Workout day", exerciseStartedAt: parsed.exerciseStartedAt ?? parsed.startedAt, elapsedBeforePause: parsed.elapsedBeforePause ?? 0, pausedAt: parsed.pausedAt ?? null, pausedRestSeconds: parsed.pausedRestSeconds ?? null, restUntil: parsed.restUntil ?? null, repElapsedBeforePause: parsed.repElapsedBeforePause ?? 0, currentExerciseIndex: parsed.currentExerciseIndex ?? 0, pendingExerciseIndex: parsed.pendingExerciseIndex ?? null, restMode: parsed.restMode ?? "set", autoAdvance: coachEnabled, voiceCoach: coachEnabled, skippedExercises: parsed.skippedExercises ?? [] } as ActiveWorkout; } catch { return null; }
};
const todayWeekKey = () => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${ironToday()}T12:00:00`).getDay()];
const elapsedText = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const numberWords = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function tempoCountCues(exercise: Exercise, elapsedSeconds = 0) {
  const labels = ["Lower", "Hold", "Lift"];
  let offset = 0;
  return tempoParts(exercise.tempo).flatMap((seconds, phase) => {
    const cues = Array.from({ length: seconds }, (_, index) => ({ at: (offset + index) * 1000, text: index === 0 ? `${labels[phase]}, ${spokenCount(index + 1)}` : spokenCount(index + 1) }));
    offset += seconds;
    return cues;
  }).filter(cue => cue.at >= elapsedSeconds * 1000);
}

export default function Workout({ onError, accountId }: { onError: (message: string) => void; accountId?: string }) {
  const navigate = useNavigate();
  const workoutStorageKey = activeKey(accountId);
  const weightUnit = useAppStore(state => state.preferences.weightUnit);
  const [selectedKey, setSelectedKey] = useState(todayWeekKey());
  const [active, setActive] = useState<ActiveWorkout | null>(() => readActive(workoutStorageKey));
  const [now, setNow] = useState(Date.now());
  const [editingProgram, setEditingProgram] = useState(false);
  const [weekDraft, setWeekDraft] = useState<WeekDay[]>([]);
  const [planDrafts, setPlanDrafts] = useState<Plan[]>([]);
  const [exerciseLibraryDraft, setExerciseLibraryDraft] = useState<LibraryExercise[]>([]);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [assignmentDayKey, setAssignmentDayKey] = useState<string | null>(null);
  const [savedWorkoutNames, setSavedWorkoutNames] = useState(() => readWorkoutNameSuggestions(accountId));
  const [newWorkoutName, setNewWorkoutName] = useState("");
  const [showNewWorkoutName, setShowNewWorkoutName] = useState(false);
  const spokenSetCue = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ["workout", "plans"], queryFn: () => api<Plan[]>("/workout-plans") });
  const weekQuery = useQuery({ queryKey: ["workout", "week"], queryFn: () => api<WeekDay[]>("/workout-week") });
  const libraryQuery = useQuery({ queryKey: ["workout", "exercise-library"], queryFn: () => api<LibraryExercise[]>("/exercise-library") });
  const logsQuery = useQuery({ queryKey: ["workout", "logs", 30], queryFn: () => api<WorkoutLogPage>("/workout-logs?limit=30") });
  const plans = plansQuery.data ?? [];
  const week = weekQuery.data ?? [];
  const exerciseLibrary = libraryQuery.data ?? [];
  const logs = logsQuery.data?.items ?? [];
  useEffect(() => { setSavedWorkoutNames(readWorkoutNameSuggestions(accountId)); }, [accountId]);
  const loaded = !plansQuery.isPending && !weekQuery.isPending && !libraryQuery.isPending && !logsQuery.isPending;
  const finishMutation = useMutation({
    mutationFn: async (payload: { date: string; dayType: DayType; dayName: string; exercises: { exerciseId: string; name: string; muscle: string; sets: { reps: number; weight: number }[] }[]; duration: number; actionId: string }) => {
      try { return await api<WorkoutSaveResult>("/workout-logs", { method: "POST", body: JSON.stringify(payload) }); }
      catch (error) {
        if (!accountId || !(error instanceof ApiError && error.status === 0)) throw error;
        await enqueueOfflineAction({ id: payload.actionId, accountId, kind: "workout_log", path: "/workout-logs", body: payload });
        return { queuedOffline: true };
      }
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workout", "logs"] }),
      queryClient.invalidateQueries({ queryKey: ["workout", "week"] }),
    ]),
  });
  const saveProgramMutation = useMutation({
    mutationFn: (payload: { days: WeekDay[]; exerciseLibrary: LibraryExercise[]; plans: { id: string; name: string; exercises: { exerciseId: string; sets: number; reps: number; rest: number; tempo: string; setList: NonNullable<Exercise["setList"]> }[] }[] }) => api<{ plans: Plan[]; days: WeekDay[]; exerciseLibrary: LibraryExercise[] }>("/workout-program", { method: "PUT", body: JSON.stringify(payload) }),
    onSuccess: result => {
      queryClient.setQueryData(["workout", "plans"], result.plans);
      queryClient.setQueryData(["workout", "week"], result.days);
      queryClient.setQueryData(["workout", "exercise-library"], result.exerciseLibrary);
    },
  });
  const saveExerciseMutation = useMutation({
    mutationFn: ({ planId, planName, dayKey, exercise }: { planId: string; planName: string; dayKey: string; exercise: Exercise }) => api<Exercise>(`/workout-plans/${encodeURIComponent(planId)}/exercises/${encodeURIComponent(exercise.id)}`, { method: "PUT", body: JSON.stringify({ ...exercise, planName, dayKey }) }),
    onSuccess: (saved, variables) => {
      const updatePlanExercises = (items: Plan[]) => {
        const hasPlan = items.some(item => item.id === variables.planId);
        const updated = items.map(item => {
        const hasExercise = item.exercises.some(exercise => exercise.id === saved.id);
        const exercises = item.exercises.map(exercise => exercise.id !== saved.id ? exercise : {
          ...exercise, name: saved.name, muscle: saved.muscle, description: saved.description, cues: saved.cues, steps: saved.steps, videoUrl: saved.videoUrl,
          ...(item.id === variables.planId ? { sets: saved.sets, reps: saved.reps, rest: saved.rest, tempo: saved.tempo, setList: saved.setList } : {}),
        });
        if (item.id === variables.planId && !hasExercise) exercises.push(saved);
        return { ...item, exercises };
        });
        return hasPlan ? updated : [...updated, { id: variables.planId, name: variables.planName, exercises: [saved] }];
      };
      queryClient.setQueryData<Plan[]>(["workout", "plans"], current => updatePlanExercises(current ?? []));
      queryClient.setQueryData<WeekDay[]>(["workout", "week"], current => current?.map(day => day.key === variables.dayKey ? { ...day, planId: variables.planId } : day));
      queryClient.setQueryData<LibraryExercise[]>(["workout", "exercise-library"], current => {
        const definition: LibraryExercise = { id: saved.id, name: saved.name, muscle: saved.muscle, description: saved.description ?? "", cues: saved.cues ?? [], steps: saved.steps ?? [], videoUrl: saved.videoUrl ?? "" };
        return current?.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? definition : item) : [...(current ?? []), definition];
      });
      setPlanDrafts(current => updatePlanExercises(current));
      setWeekDraft(current => current.map(day => day.key === variables.dayKey ? { ...day, planId: variables.planId } : day));
      setExerciseLibraryDraft(current => {
        const definition: LibraryExercise = { id: saved.id, name: saved.name, muscle: saved.muscle, description: saved.description ?? "", cues: saved.cues ?? [], steps: saved.steps ?? [], videoUrl: saved.videoUrl ?? "" };
        return current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? definition : item) : [...current, definition];
      });
      setEditingExercise(null);
      toast.success("Exercise saved");
    },
  });
  useEffect(() => {
    const error = plansQuery.error ?? weekQuery.error ?? libraryQuery.error ?? logsQuery.error;
    if (error) onError(error.message);
  }, [plansQuery.error, weekQuery.error, libraryQuery.error, logsQuery.error, onError]);
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [active]);
  useEffect(() => { if (active) localStorage.setItem(workoutStorageKey, JSON.stringify(active)); else localStorage.removeItem(workoutStorageKey); }, [active, workoutStorageKey]);
  useEffect(() => { setEditingExercise(null); setAddExerciseOpen(false); }, [selectedKey]);
  useEffect(() => {
    if (!active?.autoAdvance || active.pausedAt || active.pendingExerciseIndex == null) return;
    if (active.restUntil && active.restUntil > now) return;
    setActive(current => {
      if (!current?.autoAdvance || current.pausedAt || current.pendingExerciseIndex == null || (current.restUntil && current.restUntil > Date.now())) return current;
      return { ...current, currentExerciseIndex: current.pendingExerciseIndex, pendingExerciseIndex: null, exerciseStartedAt: Date.now() };
    });
  }, [active?.autoAdvance, active?.pausedAt, active?.pendingExerciseIndex, active?.restUntil, now]);
  const visibleWeek = editingProgram ? weekDraft : week;
  const visiblePlans = editingProgram ? planDrafts : plans;
  const visibleLibrary = editingProgram ? exerciseLibraryDraft : exerciseLibrary;
  const libraryById = useMemo(() => new Map(visibleLibrary.map(exercise => [exercise.id, exercise])), [visibleLibrary]);
  const selected = visibleWeek.find(day => day.key === selectedKey) ?? visibleWeek.find(day => day.key === todayWeekKey());
  const savedSelectedPlan = visiblePlans.find(item => item.id === selected?.planId);
  const plan = savedSelectedPlan ? {
    ...savedSelectedPlan,
    exercises: savedSelectedPlan.exercises.map(exercise => {
      const definition = libraryById.get(exercise.id);
      return definition ? { ...exercise, ...definition, sets: exercise.sets, reps: exercise.reps, rest: exercise.rest, tempo: exercise.tempo, setList: exercise.setList } : exercise;
    }),
  } : undefined;
  const savedActivePlan = active ? plans.find(item => item.id === active.dayType) : undefined;
  const activePlan = active ? { id: active.dayType, name: active.dayName, exercises: active.exerciseSnapshots ?? savedActivePlan?.exercises ?? [] } : undefined;
  const sessionTotalSets = activePlan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? plan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
  const currentExerciseIndex = active && activePlan?.exercises.length ? Math.min(active.currentExerciseIndex ?? 0, activePlan.exercises.length - 1) : 0;
  const currentExercise = activePlan?.exercises[currentExerciseIndex];
  const currentEntries = currentExercise ? active?.entries[currentExercise.id] ?? [] : [];
  const activeSetIndex = currentEntries.findIndex(entry => !entry.completed);
  const voiceAvailable = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  const done = selected?.planId ? logs.find(log => log.date === ironToday() && log.dayType === selected.planId) : undefined;
  const elapsed = active ? active.elapsedBeforePause + (active.pausedAt ? 0 : Math.max(0, Math.floor((now - active.startedAt) / 1000))) : 0;
  const exerciseElapsed = active ? Math.max(0, Math.floor(((active.pausedAt ?? now) - (active.exerciseStartedAt ?? active.startedAt)) / 1000)) : 0;
  const restSeconds = active?.pausedAt ? active.pausedRestSeconds ?? 0 : active?.restUntil ? Math.max(0, Math.ceil((active.restUntil - now) / 1000)) : 0;
  const repTimerSeconds = currentExercise?.tempo.split(/[\s-]+/).map(Number).filter(Number.isFinite).reduce((sum, value) => sum + value, 0) || 6;
  const restTotal = active?.restMode === "rep" ? repTimerSeconds : active?.restMode === "exercise" ? Math.max(currentExercise?.rest ?? 0, 60) : currentExercise?.rest ?? 60;
  const totalSets = useMemo(() => plan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0, [plan]);
  const completedSets = active ? Object.values(active.entries).reduce((sum, entries) => sum + entries.filter(entry => entry.completed).length, 0) : 0;
  const skippedExerciseIds = active?.skippedExercises ?? [];
  const skippedExerciseCount = activePlan?.exercises.filter(exercise => skippedExerciseIds.includes(exercise.id)).length ?? 0;
  const skippedSetCount = activePlan?.exercises.reduce((sum, exercise) => skippedExerciseIds.includes(exercise.id) ? sum + (active?.entries[exercise.id] ?? []).filter(entry => !entry.completed).length : sum, 0) ?? 0;
  const completedExerciseCount = activePlan?.exercises.filter(exercise => (active?.entries[exercise.id] ?? []).some(entry => entry.completed)).length ?? 0;
  const sessionProgressSets = completedSets + skippedSetCount;
  const sessionDone = Boolean(active && sessionTotalSets > 0 && sessionProgressSets >= sessionTotalSets);
  useEffect(() => {
    if (!(active?.voiceCoach || active?.autoAdvance) || active.pausedAt || !currentExercise || !voiceAvailable) return;
    const synthesis = window.speechSynthesis;
    const language = navigator.language.toLowerCase();
    const voices = synthesis.getVoices?.() ?? [];
    const matchingVoice = voices.find(voice => voice.lang.toLowerCase() === language)
      ?? voices.find(voice => voice.default && voice.lang.split("-")[0].toLowerCase() === language.split("-")[0]);
    const timers: number[] = [];
    const speak = (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = navigator.language;
      utterance.rate = 0.95;
      if (matchingVoice) utterance.voice = matchingVoice;
      synthesis.speak(utterance);
    };
    synthesis.cancel();
    const repIsRunning = active.restMode === "rep" && active.restUntil != null && active.restUntil > Date.now();
    if (repIsRunning) {
      const elapsedRepSeconds = (active.repElapsedBeforePause ?? 0) + Math.max(0, Math.floor((Date.now() - (active.repStartedAt ?? Date.now())) / 1000));
      for (const cue of tempoCountCues(currentExercise, elapsedRepSeconds)) {
        timers.push(window.setTimeout(() => speak(cue.text), Math.max(0, cue.at - elapsedRepSeconds * 1000)));
      }
    } else if (restSeconds === 0 && activeSetIndex >= 0) {
      const cueKey = `${active.startedAt}:${currentExercise.id}:${activeSetIndex}`;
      if (spokenSetCue.current !== cueKey) {
        spokenSetCue.current = cueKey;
        speak(`${currentExercise.name}. Set ${numberWords[activeSetIndex] ?? activeSetIndex + 1}.`);
      }
    }
    return () => { timers.forEach(window.clearTimeout); synthesis.cancel(); };
  }, [active?.voiceCoach, active?.autoAdvance, active?.pausedAt, active?.restMode, active?.restUntil, active?.repStartedAt, active?.repElapsedBeforePause, active?.startedAt, currentExercise?.id, currentExercise?.name, currentExercise?.tempo, activeSetIndex, restSeconds > 0, voiceAvailable]);
  const programIsDirty = editingProgram && (JSON.stringify(weekDraft) !== JSON.stringify(week) || JSON.stringify(planDrafts) !== JSON.stringify(plans) || JSON.stringify(exerciseLibraryDraft) !== JSON.stringify(exerciseLibrary));

  /** Snapshot the chosen plan and seed each set from the latest saved performance. */
  function startWorkout() {
    if (!selected?.planId || !plan) return;
    const previous = [...logs].filter(log => log.dayType === selected.planId).sort((a, b) => b.date.localeCompare(a.date))[0];
    const entries = Object.fromEntries(plan.exercises.map(exercise => {
      const previousSets = previous?.exercises.find(item => item.exerciseId === exercise.id)?.sets ?? [];
      const last = previousSets.at(-1);
      return [exercise.id, Array.from({ length: exercise.sets }, (_, index) => ({ reps: previousSets[index]?.reps ?? last?.reps ?? exercise.setList?.[index]?.reps ?? exercise.reps, weight: previousSets[index]?.weight ?? last?.weight ?? exercise.setList?.[index]?.weight ?? 0, completed: false }))];
    }));
    setActive({ date: ironToday(), dayType: selected.planId, dayName: plan.name, exerciseSnapshots: structuredClone(plan.exercises), startedAt: Date.now(), exerciseStartedAt: Date.now(), elapsedBeforePause: 0, pausedAt: null, pausedRestSeconds: null, entries, restUntil: null, currentExerciseIndex: 0, pendingExerciseIndex: null, restMode: "set", autoAdvance: false, voiceCoach: false, skippedExercises: [] });
  }

  /** Freeze workout, exercise, rep, and rest clocks together, then restore their remaining time. */
  function togglePause() {
    setActive(current => {
      if (!current) return null;
      if (current.pausedAt) return { ...current, startedAt: Date.now(), exerciseStartedAt: (current.exerciseStartedAt ?? current.startedAt) + (Date.now() - current.pausedAt), repStartedAt: current.restMode === "rep" && current.pausedRestSeconds ? Date.now() : current.repStartedAt, pausedAt: null, restUntil: current.pausedRestSeconds ? Date.now() + current.pausedRestSeconds * 1000 : null, pausedRestSeconds: null };
      const pausedAt = Date.now();
      const repElapsedBeforePause = current.restMode === "rep" && current.restUntil ? (current.repElapsedBeforePause ?? 0) + Math.max(0, Math.floor((pausedAt - (current.repStartedAt ?? pausedAt)) / 1000)) : current.repElapsedBeforePause;
      return { ...current, elapsedBeforePause: current.elapsedBeforePause + Math.floor((pausedAt - current.startedAt) / 1000), repElapsedBeforePause, repStartedAt: undefined, pausedAt, pausedRestSeconds: current.restUntil ? Math.max(0, Math.ceil((current.restUntil - pausedAt) / 1000)) : null, restUntil: null };
    });
  }

  function stopWorkout() {
    if (confirm("End this workout and discard its uncompleted session? Completed sets will not be saved.")) setActive(null);
  }

  function editSet(exerciseId: string, setIndex: number, field: "reps" | "weight", value: number) {
    setActive(current => {
      if (!current) return current;
      const entries = { ...current.entries, [exerciseId]: [...current.entries[exerciseId]] };
      entries[exerciseId][setIndex] = { ...entries[exerciseId][setIndex], [field]: field === "weight" ? toStoredWeight(value, weightUnit) : value };
      return { ...current, entries };
    });
  }

  /** Mark one set complete and calculate the next exercise, rest, and auto-advance state. */
  function completeSet(exercise: Exercise, setIndex: number) {
    setActive(current => {
      if (!current) return current;
      const exerciseEntries = current.entries[exercise.id];
      if (!exerciseEntries?.[setIndex] || exerciseEntries[setIndex].completed) return current;
      const entries = { ...current.entries, [exercise.id]: [...exerciseEntries] };
      entries[exercise.id][setIndex] = { ...entries[exercise.id][setIndex], completed: true };
      const skipped = current.skippedExercises ?? [];
      const moreSets = Object.entries(entries).some(([exerciseId, list]) => !skipped.includes(exerciseId) && list.some(entry => !entry.completed));
      const exerciseFinished = entries[exercise.id].every(entry => entry.completed);
      const nextExerciseIndex = exerciseFinished ? Math.min((current.currentExerciseIndex ?? 0) + 1, Math.max(0, (activePlan?.exercises.length ?? 1) - 1)) : current.currentExerciseIndex ?? 0;
      const deferExerciseChange = Boolean(current.autoAdvance && exerciseFinished && moreSets);
      const restMode = exerciseFinished ? "exercise" : "set";
      return { ...current, entries, currentExerciseIndex: deferExerciseChange ? current.currentExerciseIndex ?? 0 : nextExerciseIndex, pendingExerciseIndex: deferExerciseChange ? nextExerciseIndex : null, exerciseStartedAt: exerciseFinished && !deferExerciseChange ? Date.now() : current.exerciseStartedAt, repStartedAt: undefined, repElapsedBeforePause: 0, restMode, restUntil: moreSets ? Date.now() + (exerciseFinished ? Math.max(exercise.rest, 60) : exercise.rest) * 1000 : null };
    });
  }

  function startRepTimer(exercise: Exercise) {
    const seconds = tempoParts(exercise.tempo).reduce((sum, value) => sum + value, 0);
    if (!seconds) { toast.error("Set at least one tempo phase to 1 second or more first."); return; }
    setActive(current => current ? { ...current, repStartedAt: Date.now(), repElapsedBeforePause: 0, restUntil: Date.now() + seconds * 1000, restMode: "rep" } : null);
  }

  function skipExercise() {
    if (!active || !activePlan) return;
    setActive(current => {
      if (!current) return null;
      const exercise = activePlan.exercises[Math.min(current.currentExerciseIndex ?? 0, activePlan.exercises.length - 1)];
      if (!exercise) return current;
      const skippedExercises = [...new Set([...(current.skippedExercises ?? []), exercise.id])];
      if ((current.entries[exercise.id] ?? []).every(entry => entry.completed)) return current;
      return { ...current, skippedExercises, currentExerciseIndex: Math.min((current.currentExerciseIndex ?? 0) + 1, activePlan.exercises.length - 1), pendingExerciseIndex: null, exerciseStartedAt: Date.now(), pausedRestSeconds: null, restUntil: null, restMode: "exercise" };
    });
  }

  function toggleAutoAdvance() {
    setActive(current => {
      if (!current) return null;
      const enabled = !(current.autoAdvance || current.voiceCoach);
      if (!enabled && current.pendingExerciseIndex != null) return { ...current, autoAdvance: false, voiceCoach: false, currentExerciseIndex: current.pendingExerciseIndex, pendingExerciseIndex: null, exerciseStartedAt: Date.now() };
      return { ...current, autoAdvance: enabled, voiceCoach: enabled };
    });
  }

  function resumeSkippedExercise(exerciseId: string, exerciseIndex: number) {
    setActive(current => current ? {
      ...current,
      skippedExercises: (current.skippedExercises ?? []).filter(id => id !== exerciseId),
      currentExerciseIndex: exerciseIndex,
      pendingExerciseIndex: null,
      pausedRestSeconds: null,
      restUntil: null,
      exerciseStartedAt: Date.now(),
    } : null);
  }

  /** Save only completed sets; the API makes the action idempotent and queues offline saves. */
  async function finishWorkout() {
    if (!active || finishMutation.isPending) return;
    const sessionPlan = activePlan;
    if (!sessionPlan) return;
    const exercises = sessionPlan.exercises.map(exercise => ({
      exerciseId: exercise.id, name: exercise.name, muscle: exercise.muscle,
      sets: (active.entries[exercise.id] ?? []).filter(entry => entry.completed).map(({ reps, weight }) => ({ reps, weight }))
    })).filter(exercise => exercise.sets.length);
    if (exercises.length === 0) {
      // Skipping every exercise ends the timer without creating a misleading empty workout log.
      setActive(null);
      toast.info("No completed sets to save.");
      return;
    }
    try {
      const result = await finishMutation.mutateAsync({ date: active.date, dayType: active.dayType, dayName: active.dayName, exercises, duration: elapsed, actionId: crypto.randomUUID() });
      setActive(null);
      if (result.queuedOffline) toast.success("Workout saved on this device. It will sync when you reconnect.");
      else for (const item of result.feedback ?? []) toast.success(item.title, { description: item.message });
    } catch (reason) { onError((reason as Error).message); }
  }

  function beginProgramEdit() {
    if (active || !loaded) return;
    setWeekDraft(structuredClone(week));
    setPlanDrafts(structuredClone(plans));
    setExerciseLibraryDraft(structuredClone(exerciseLibrary));
    setEditingProgram(true);
  }

  function cancelProgramEdit() {
    if (programIsDirty && !confirm("Discard your unsaved workout changes?")) return;
    setEditingProgram(false);
    setAssignmentDayKey(null);
  }

  async function saveProgram() {
    if (!programIsDirty || saveProgramMutation.isPending) return;
    try {
      await saveProgramMutation.mutateAsync({
        days: weekDraft,
        exerciseLibrary: exerciseLibraryDraft,
        plans: planDrafts.map(item => ({
          id: item.id,
          name: item.name,
          exercises: item.exercises.map(exercise => ({ exerciseId: exercise.id, sets: exercise.sets, reps: exercise.reps, rest: exercise.rest, tempo: exercise.tempo, setList: exercise.setList ?? [] })),
        })),
      });
      setEditingProgram(false);
      setAssignmentDayKey(null);
      toast.success("Workout plan saved");
    } catch (reason) { onError((reason as Error).message); }
  }

  function beginExerciseEdit(exercise: Exercise) {
    setEditingExercise({ ...structuredClone(exercise), setList: structuredClone(exercise.setList?.length ? exercise.setList : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }))) });
  }

  function updateExerciseDraft(patch: Partial<Exercise>) {
    setEditingExercise(current => current ? { ...current, ...patch } : current);
  }

  function updateTempoPhase(index: number, value: string) {
    setEditingExercise(current => {
      if (!current) return current;
      const phases = tempoParts(current.tempo);
      phases[index] = Math.max(0, Math.min(10, Number(value) || 0));
      return { ...current, tempo: phases.join("-") };
    });
  }

  function updateDraftSet(setIndex: number, field: "reps" | "weight", value: number) {
    const storedValue = field === "weight" ? toStoredWeight(value, weightUnit) : value;
    setEditingExercise(current => current ? { ...current, setList: (current.setList ?? []).map((set, index) => index === setIndex ? { ...set, [field]: storedValue } : set) } : current);
  }

  function updateDraftSetCount(count: number) {
    setEditingExercise(current => {
      if (!current) return current;
      const setList = [...(current.setList ?? [])].slice(0, count);
      while (setList.length < count) setList.push({ id: `set-${crypto.randomUUID()}`, reps: current.reps, weight: 0 });
      return { ...current, sets: count, setList };
    });
  }

  async function saveExerciseDraft(exercise = editingExercise) {
    if (!plan || !exercise) return;
    if (!exercise.name.trim() || exercise.name.length > 120) { toast.error("Enter an exercise name up to 120 characters."); return; }
    if (!exercise.muscle.trim() || exercise.muscle.length > 80) { toast.error("Enter a muscle group up to 80 characters."); return; }
    if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20 || !Number.isInteger(exercise.reps) || exercise.reps < 1 || exercise.reps > 100 || !Number.isFinite(exercise.rest) || exercise.rest < 0 || exercise.rest > 600) { toast.error("Check the set, rep, and rest targets."); return; }
    if (exercise.tempo.length > 40 || !tempoParts(exercise.tempo).some(Boolean) || (exercise.setList?.length ?? 0) !== exercise.sets || exercise.setList?.some(set => !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 1000 || !Number.isFinite(set.weight) || set.weight < 0 || set.weight > 10000)) { toast.error("Check the tempo and set details."); return; }
    if ((exercise.description?.length ?? 0) > 4000 || (exercise.cues?.length ?? 0) > 40 || exercise.cues?.some(cue => cue.length > 300) || (exercise.steps?.length ?? 0) > 40 || exercise.steps?.some(step => step.length > 500)) { toast.error("Exercise details exceed the allowed length."); return; }
    if ((exercise.videoUrl?.length ?? 0) > 2048) { toast.error("The demo video link is too long."); return; }
    if (exercise.videoUrl) {
      try { if (!["http:", "https:"].includes(new URL(exercise.videoUrl).protocol)) throw new Error(); }
      catch { toast.error("Use a valid HTTP or HTTPS demo link."); return; }
    }
    try { await saveExerciseMutation.mutateAsync({ planId: plan.id, planName: plan.name, dayKey: selected?.key ?? selectedKey, exercise }); }
    catch (reason) { onError((reason as Error).message); }
  }

  function updateWeekAssignment(dayKey: string, planId: string | null) {
    setWeekDraft(current => current.map(day => day.key === dayKey ? { ...day, planId } : day));
  }

  function saveWorkoutNameSuggestion(value = newWorkoutName) {
    const name = value.trim().slice(0, 80);
    if (!name) return false;
    const next = [name, ...savedWorkoutNames.filter(item => item.toLocaleLowerCase() !== name.toLocaleLowerCase())].slice(0, 30);
    try { localStorage.setItem(workoutNameSuggestionsKey(accountId), JSON.stringify(next)); }
    catch { toast.error("This workout name could not be saved on this device."); return false; }
    setSavedWorkoutNames(next);
    setNewWorkoutName("");
    setShowNewWorkoutName(false);
    return true;
  }

  function chooseWorkoutName(dayKey: string, name: string) {
    if (newWorkoutName.trim()) saveWorkoutNameSuggestion(newWorkoutName);
    const matchingPlan = visiblePlans.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    const assignedId = visibleWeek.find(day => day.key === dayKey)?.planId;
    const assignedPlan = visiblePlans.find(item => item.id === assignedId);
    const planId = matchingPlan?.id ?? assignedPlan?.id ?? `day-${crypto.randomUUID()}`;
    if (!matchingPlan && assignedPlan) setPlanDrafts(current => current.map(item => item.id === assignedPlan.id ? { ...item, name } : item));
    else if (!matchingPlan) setPlanDrafts(current => [...current, { id: planId, name, exercises: [] }]);
    updateWeekAssignment(dayKey, planId);
    setSelectedKey(dayKey);
    setAssignmentDayKey(null);
    setShowNewWorkoutName(false);
  }

  function deletePlanDraft() {
    if (!plan || !confirm(`Remove “${plan.name}” from your workout plans? Past sessions stay in your history.`)) return;
    setPlanDrafts(current => current.filter(item => item.id !== plan.id));
    setWeekDraft(current => current.map(day => day.planId === plan.id ? { ...day, planId: null } : day));
  }

  function addNewExercise() {
    if (!plan) return;
    const exerciseId = `exercise-${crypto.randomUUID()}`;
    const exercise: Exercise = { id: exerciseId, name: "New exercise", muscle: "General", sets: 3, reps: 10, rest: 60, tempo: "3-1-2", cues: [], description: "", setList: [{ id: `set-${crypto.randomUUID()}`, reps: 10, weight: 0 }, { id: `set-${crypto.randomUUID()}`, reps: 10, weight: 0 }, { id: `set-${crypto.randomUUID()}`, reps: 10, weight: 0 }], steps: [], videoUrl: "" };
    setAddExerciseOpen(false);
    void saveExerciseDraft(exercise);
  }

  function addLibraryExercise(exerciseId: string) {
    if (!plan) return;
    const definition = visibleLibrary.find(item => item.id === exerciseId);
    if (!definition || plan.exercises.some(exercise => exercise.id === definition.id)) return;
    const exercise: Exercise = { ...definition, sets: 3, reps: 10, rest: 60, tempo: "3-1-2", setList: [{ id: `set-${crypto.randomUUID()}`, reps: 10, weight: 0 }, { id: `set-${crypto.randomUUID()}`, reps: 10, weight: 0 }, { id: `set-${crypto.randomUUID()}`, reps: 10, weight: 0 }] };
    setAddExerciseOpen(false);
    void saveExerciseDraft(exercise);
  }

  function deleteExercise(exerciseId: string) {
    if (!plan) return;
    setPlanDrafts(current => current.map(item => item.id === plan.id ? { ...item, exercises: item.exercises.filter(exercise => exercise.id !== exerciseId) } : item));
  }

  function addDraftSet() {
    setEditingExercise(current => {
      if (!current || (current.setList?.length ?? 0) >= 20) { toast.error("An exercise can have up to 20 sets."); return current; }
      const setList = [...(current.setList ?? []), { id: `set-${crypto.randomUUID()}`, reps: current.reps, weight: 0 }];
      return { ...current, sets: setList.length, setList };
    });
  }

  function removeDraftSet(setIndex: number) {
    setEditingExercise(current => {
      if (!current || (current.setList?.length ?? 0) <= 1) return current;
      const setList = current.setList!.filter((_, index) => index !== setIndex);
      return { ...current, sets: setList.length, setList };
    });
  }

  return <>
    <header className="workout-page-header"><div className="workout-heading-row"><div><h1>Workout</h1><p>Build strength one controlled set at a time.</p></div>{!editingProgram && <button type="button" className="start-workout workout-edit-top" disabled={active !== null || !loaded} onClick={beginProgramEdit}>Edit schedule</button>}</div><div className="workout-header-actions"><button type="button" className="workout-stats-link" onClick={() => navigate("/workout/stats")}><BarChart3 size={16} /> Stats</button><div className="workout-head-meta"><Dumbbell size={18} /><span>Dumbbells</span></div>{editingProgram && <><button type="button" className="workout-cancel-edit" onClick={cancelProgramEdit}><X size={16} /><span>Cancel changes</span></button><button type="button" className="start-workout workout-save-top" disabled={!programIsDirty || saveProgramMutation.isPending} onClick={() => void saveProgram()}>{saveProgramMutation.isPending ? "Saving…" : "Save changes"}</button></>}</div></header>
    <div className={`week-strip ${editingProgram ? "week-strip-editing" : ""}`} role="group" tabIndex={0} aria-label="Workout days">
      {visibleWeek.map(day => {
        const assignedPlan = visiblePlans.find(item => item.id === day.planId);
        const completedToday = day.planId && logs.some(log => log.date === ironToday() && log.dayType === day.planId);
        return editingProgram ? <div className={`week-day-editor ${selectedKey === day.key ? "selected" : ""}`} key={day.key}>
          <button type="button" className="week-day-select" aria-pressed={selectedKey === day.key} onClick={() => setSelectedKey(day.key)}><span>{day.label.slice(0, 3)}</span>{completedToday && <i aria-label="Completed" />}</button>
          {assignedPlan ? <div className="week-day-workout"><strong className="week-day-name">{assignedPlan.name}</strong><button type="button" data-assignment-trigger={day.key} className="week-day-change" aria-label={`Change workout for ${day.label}`} aria-expanded={assignmentDayKey === day.key} onClick={() => { if (newWorkoutName.trim()) saveWorkoutNameSuggestion(); setAssignmentDayKey(current => current === day.key ? null : day.key); }}>Change workout</button></div> : <button type="button" data-assignment-trigger={day.key} className="week-day-assign" aria-label={`Choose a workout for ${day.label}`} aria-expanded={assignmentDayKey === day.key} onClick={() => { if (newWorkoutName.trim()) saveWorkoutNameSuggestion(); setAssignmentDayKey(current => current === day.key ? null : day.key); }}>＋ Choose workout</button>}
        </div> : <button type="button" key={day.key} className={selectedKey === day.key ? "selected" : ""} onClick={() => setSelectedKey(day.key)}>
          <span>{day.label.slice(0, 3)}</span><b>{assignedPlan?.name ?? "Rest"}</b>{completedToday && <i aria-label="Completed" />}
        </button>;
      })}
    </div>
    {editingProgram && assignmentDayKey && <div className="week-assignment-panel" role="group" aria-label={`Choose a workout for ${visibleWeek.find(day => day.key === assignmentDayKey)?.label ?? "this day"}`}>
      <span>{visibleWeek.find(day => day.key === assignmentDayKey)?.label}: choose a workout name</span>
      <div>
        <button type="button" aria-pressed={!visibleWeek.find(day => day.key === assignmentDayKey)?.planId} onClick={() => { if (newWorkoutName.trim()) saveWorkoutNameSuggestion(); updateWeekAssignment(assignmentDayKey, null); setAssignmentDayKey(null); }}>Rest day</button>
        {[...new Set([...visiblePlans.map(item => item.name), ...savedWorkoutNames])].map(name => { const item = visiblePlans.find(planItem => planItem.name.toLocaleLowerCase() === name.toLocaleLowerCase()); return <button type="button" key={name} aria-pressed={Boolean(item && visibleWeek.find(day => day.key === assignmentDayKey)?.planId === item.id)} onClick={() => chooseWorkoutName(assignmentDayKey, name)}>{name}</button>; })}
        <button type="button" className="week-day-new" onClick={() => setShowNewWorkoutName(true)}>＋ New workout</button>
      </div>
      {showNewWorkoutName && <label className="week-new-workout-name">New workout name<input aria-label="New workout name" autoFocus maxLength={80} value={newWorkoutName} onChange={event => setNewWorkoutName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (saveWorkoutNameSuggestion()) chooseWorkoutName(assignmentDayKey, newWorkoutName.trim()); } else if (event.key === "Escape") { setShowNewWorkoutName(false); setNewWorkoutName(""); } }} onBlur={event => { const panel = event.currentTarget.closest(".week-assignment-panel"); if (!panel?.contains(event.relatedTarget as Node | null)) { saveWorkoutNameSuggestion(); const trigger = (event.relatedTarget as HTMLElement | null)?.closest<HTMLElement>("[data-assignment-trigger]"); if (trigger?.dataset.assignmentTrigger !== assignmentDayKey) setAssignmentDayKey(null); } }} /><button type="button" disabled={!newWorkoutName.trim()} onClick={() => { const name = newWorkoutName.trim(); if (saveWorkoutNameSuggestion(name)) chooseWorkoutName(assignmentDayKey, name); }}>Save &amp; use</button></label>}
    </div>}
    {active ? <section className="active-workout">
      <div className="active-workout-top"><div><span className={`live-dot ${active.pausedAt ? "paused" : ""}`} /> {active.pausedAt ? "Paused" : "In progress"}</div><strong><Clock3 size={16} /> {elapsedText(elapsed)}</strong><div className="workout-session-controls"><button type="button" className="session-control" onClick={togglePause}>{active.pausedAt ? <Play size={15} /> : <Pause size={15} />}{active.pausedAt ? "Resume" : "Pause"}</button><button type="button" className="session-control session-stop" onClick={stopWorkout}><X size={15} /> End</button></div></div>
      <div className="workout-mode-controls" aria-label="Workout coaching options">
        <button type="button" className={`session-control ${active.autoAdvance || active.voiceCoach ? "mode-active" : ""}`} aria-pressed={Boolean(active.autoAdvance || active.voiceCoach)} aria-label={`Auto coach ${active.autoAdvance || active.voiceCoach ? "on" : "off"}`} onClick={toggleAutoAdvance}><Zap size={15} /><AudioLines size={15} />Auto coach {active.autoAdvance || active.voiceCoach ? "On" : "Off"}{!voiceAvailable && (active.autoAdvance || active.voiceCoach) ? " · Voice unavailable" : ""}</button>
      </div>
      <h2>{active.dayName}</h2>
      <p>{completedSets} sets logged.{skippedExerciseCount > 0 ? ` ${skippedExerciseCount} exercise${skippedExerciseCount === 1 ? "" : "s"} ha${skippedExerciseCount === 1 ? "s" : "ve"} skipped sets.` : ""} Record each set as you go.</p>
      <div className="session-progress"><button type="button" aria-label="End workout" onClick={stopWorkout}><ChevronLeft size={18} /></button><div><i style={{ width: `${sessionTotalSets ? Math.min(sessionProgressSets / sessionTotalSets * 100, 100) : 0}%` }} /></div><span>{currentExercise ? currentExerciseIndex + 1 : activePlan?.exercises.length ?? 0}/{activePlan?.exercises.length ?? 0}</span></div>
      <div className="exercise-pills" aria-label="Workout exercises">{activePlan?.exercises.map((exercise, index) => { const complete = (active.entries[exercise.id] ?? []).every(entry => entry.completed); const skipped = skippedExerciseIds.includes(exercise.id); return <button type="button" key={exercise.id} className={`${index === currentExerciseIndex ? "current" : ""} ${complete ? "complete" : ""} ${skipped ? "skipped" : ""}`} onClick={() => setActive(current => current ? { ...current, skippedExercises: (current.skippedExercises ?? []).filter(id => id !== exercise.id), currentExerciseIndex: index, exerciseStartedAt: Date.now() } : null)} aria-label={`${skipped ? "Skipped" : "Go to"} exercise ${index + 1}: ${exercise.name}`}>{index + 1}</button>; })}</div>
      <div className="session-clock-row"><span><Clock3 size={14} /> Workout <b>{elapsedText(elapsed)}</b></span><span><TimerReset size={14} /> Exercise <b>{elapsedText(exerciseElapsed)}</b></span></div>
      {restSeconds > 0 && <div className="session-countdown"><div className="countdown-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="44" style={{ strokeDasharray: 276.46, strokeDashoffset: 276.46 * (1 - restSeconds / Math.max(1, restTotal)) }} /></svg><b>{restSeconds}</b><small>sec</small></div><p>{active.pausedAt ? "Timer paused" : active.autoAdvance && active.pendingExerciseIndex != null ? "Next exercise starts after rest" : active.restMode === "exercise" ? "Rest between exercises" : active.restMode === "rep" ? "Tempo count" : "Rest between sets"}</p>{!active.pausedAt && <button type="button" onClick={() => setActive(current => current ? { ...current, restUntil: null, repStartedAt: undefined, repElapsedBeforePause: 0 } : null)}>Skip timer</button>}</div>}
      {!activePlan ? <p className="empty-workouts">Loading workout plan…</p> : sessionDone ? (
        <section className="session-done"><span>🏆</span><h2>Workout Complete!</h2><div><article><b>{completedSets}</b><small>Sets</small></article><article><b>{elapsedText(elapsed)}</b><small>Duration</small></article><article><b>{completedExerciseCount}</b><small>Exercises</small></article><article><b>{activePlan.exercises.reduce((sum, exercise) => sum + (active.entries[exercise.id] ?? []).reduce((total, set) => total + set.reps * set.weight, 0), 0).toLocaleString()} kg</b><small>Volume</small></article></div>
          {skippedExerciseCount > 0 && <><p>{skippedExerciseCount} exercise{skippedExerciseCount === 1 ? " has" : "s have"} skipped sets. Only completed sets will be saved.</p><div className="session-skipped-actions">{activePlan.exercises.map((exercise, index) => skippedExerciseIds.includes(exercise.id) && <button type="button" key={exercise.id} onClick={() => resumeSkippedExercise(exercise.id, index)}>Resume {exercise.name}</button>)}</div></>}
          <button type="button" className="finish-workout" disabled={finishMutation.isPending || Boolean(active.pausedAt)} onClick={() => void finishWorkout()}><Square size={15} />{finishMutation.isPending ? "Saving workout…" : completedSets > 0 ? "Save workout and return" : "Return without saving"}</button>
        </section>
      ) : currentExercise ? <article className="session-exercise session-current-exercise">
        <div className="session-exercise-title"><div><p className="session-muscle">{currentExercise.muscle}</p><h3>{currentExercise.name}</h3></div><strong>{(active.entries[currentExercise.id] ?? []).filter(entry => entry.completed).length + 1}<small>/{currentExercise.sets} set</small></strong></div>
        {currentExercise.description && <p className="exercise-cue">{currentExercise.description}</p>}
        <div className="session-rep-grid"><div><b>{currentExercise.reps}</b><small>reps</small></div><div><b>{currentExercise.tempo}</b><small>tempo</small></div><div><b>{currentExercise.rest || 60}s</b><small>rest</small></div></div>
        {currentExercise.cues.length > 0 && <div className="session-cues"><b>Cues</b>{currentExercise.cues.map((cue, index) => <p key={index}><ChevronRight size={13} />{cue}</p>)}</div>}
        <div className="session-exercises"><div className="set-head"><span>Set</span><span>Reps</span><span>Load ({weightUnit})</span><span /></div>
        {(active.entries[currentExercise.id] ?? []).map((entry, index) => <div className={`set-row ${entry.completed ? "set-done" : ""}`} key={`${currentExercise.id}-${index}`}>
          <span className="set-number">{index + 1}</span><input type="number" min="1" max="1000" value={entry.reps || ""} placeholder="Reps" disabled={entry.completed || Boolean(active.pausedAt)} aria-label={`${currentExercise.name} set ${index + 1} reps`} onChange={event => editSet(currentExercise.id, index, "reps", Number(event.target.value))} /><input type="number" min="0" step="0.5" max="10000" value={entry.weight ? toDisplayWeight(entry.weight, weightUnit) : ""} placeholder="0" disabled={entry.completed || Boolean(active.pausedAt)} aria-label={`${currentExercise.name} set ${index + 1} weight (${weightUnit})`} onChange={event => editSet(currentExercise.id, index, "weight", Number(event.target.value))} /><span>{entry.completed && <Check size={15} />}</span>
        </div>)}</div>
        <button type="button" className="finish-workout" disabled={!currentEntries.some(entry => !entry.completed) || (currentEntries[activeSetIndex]?.reps ?? 0) < 1 || restSeconds > 0 || Boolean(active.pausedAt)} onClick={() => completeSet(currentExercise, activeSetIndex)}><Check size={16} /> Done — Set {currentEntries.filter(entry => entry.completed).length + 1} of {currentExercise.sets}</button>
        <div className="session-bottom-actions"><button type="button" disabled={Boolean(active.pausedAt) || !tempoParts(currentExercise.tempo).some(Boolean)} onClick={() => startRepTimer(currentExercise)}><TimerReset size={14} /> Start tempo count</button><button type="button" disabled={Boolean(active.pausedAt)} onClick={skipExercise}><ChevronRight size={14} /> Skip Exercise</button></div>
      </article> : null}
    </section> : <>
    {!loaded ? <section className="rest-day"><h2>Loading your training plan</h2></section> : !selected?.planId ? <section className="rest-day"><div className="rest-mark"><RotateCcw /></div><h2>{plans.length ? "Recovery day" : "Choose your first workout"}</h2><p>{plans.length ? "This day is set aside for rest. Choose a workout name whenever your schedule changes." : "Choose a workout name, add exercises, and assign the workout to the days you train."}</p><button type="button" className="start-workout" onClick={() => { beginProgramEdit(); setAssignmentDayKey(selectedKey); }}>Choose workout</button></section> : !plan ? <section className="rest-day"><h2>Workout day unavailable</h2><p>This schedule entry no longer has a saved plan. Edit your weekly schedule to choose another workout or rest day.</p></section> : <>
        <section className="workout-overview"><div className="overview-copy"><span className="program-label">{selected.label}</span><h2>{plan.name}</h2>{plan.exercises.length > 0 && <p>{plan.exercises.length} exercises · {totalSets} working sets · Dumbbells</p>}</div><div className="overview-action">{done ? <span className="workout-complete"><Check size={16} /> Completed today</span> : !editingProgram && plan.exercises.length > 0 && <button type="button" className="start-workout" onClick={startWorkout}><Play size={16} fill="currentColor" /> Start workout</button>}</div></section>
        <div className="workout-section-title"><div><h2>Exercises in this workout</h2></div></div>
        {plan.exercises.length ? <div className="exercise-list">
          {plan.exercises.map((exercise, index) => {
            const setList: NonNullable<Exercise["setList"]> = exercise.setList?.length
              ? exercise.setList
              : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }));
            const volume = setList.reduce((sum, set) => sum + set.reps * set.weight, 0);
            const isEditingExercise = editingExercise?.id === exercise.id;
            const draft = isEditingExercise ? editingExercise : null;
            return <article className={`exercise-card ${done ? "exercise-locked" : ""}`} key={exercise.id}>
              <div className="exercise-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="exercise-main">
                {draft ? <div className="exercise-edit-form">
                  <div className="exercise-edit-fields">
                    <label className="exercise-edit-wide">Exercise name<input maxLength={120} value={draft.name} onChange={event => updateExerciseDraft({ name: event.target.value })} /></label>
                    <label>Muscle group<input maxLength={80} value={draft.muscle} onChange={event => updateExerciseDraft({ muscle: event.target.value })} /></label>
                    <label>Sets<input type="number" min={1} max={20} value={draft.sets} onChange={event => updateDraftSetCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
                    <label>Target reps<input type="number" min={1} max={100} value={draft.reps || ""} onChange={event => updateExerciseDraft({ reps: Number(event.target.value) })} /></label>
                    <label>Rest seconds<input type="number" min={0} max={600} value={draft.rest} onChange={event => updateExerciseDraft({ rest: Number(event.target.value) || 0 })} /></label>
                    <fieldset className="exercise-tempo-fields exercise-edit-wide"><legend>Tempo per rep (seconds)</legend><div>{(["Lower", "Hold", "Lift"] as const).map((phase, phaseIndex) => <label key={phase}>{phase}<input aria-label={`${phase} tempo seconds`} type="number" min={0} max={10} value={tempoParts(draft.tempo)[phaseIndex]} onChange={event => updateTempoPhase(phaseIndex, event.target.value)} /></label>)}</div><small>The voice coach counts each phase when you start the tempo count.</small></fieldset>
                  </div>
                  <div className="exercise-edit-sets"><div className="exercise-edit-set-head"><b>Set</b><b>Reps</b><b>Weight ({weightUnit})</b><span /></div>
                    {(draft.setList ?? []).map((set, setIndex) => <div className="exercise-edit-set-row" key={set.id ?? setIndex}><span>{setIndex + 1}</span><input aria-label={`Set ${setIndex + 1} reps`} type="number" min={1} max={1000} value={set.reps || ""} onChange={event => updateDraftSet(setIndex, "reps", Number(event.target.value))} /><input aria-label={`Set ${setIndex + 1} weight (${weightUnit})`} type="number" min={0} max={10000} step={0.5} value={set.weight ? toDisplayWeight(set.weight, weightUnit) : ""} onChange={event => updateDraftSet(setIndex, "weight", Number(event.target.value))} /><button type="button" className="exercise-remove-set" disabled={(draft.setList?.length ?? 0) <= 1} onClick={() => removeDraftSet(setIndex)}>Remove</button></div>)}
                    <button type="button" className="exercise-add-set" disabled={(draft.setList?.length ?? 0) >= 20} onClick={addDraftSet}>＋ Add set</button>
                  </div>
                  <div className="exercise-edit-fields exercise-edit-extra">
                    <label className="exercise-edit-wide">Description<textarea maxLength={4000} value={draft.description ?? ""} onChange={event => updateExerciseDraft({ description: event.target.value })} /></label>
                    <label>Instructions<textarea maxLength={20_039} value={(draft.steps ?? []).join("\n")} onChange={event => updateExerciseDraft({ steps: event.target.value.split("\n").slice(0, 40) })} /></label>
                    <label>Form cues<textarea maxLength={12_039} value={(draft.cues ?? []).join("\n")} onChange={event => updateExerciseDraft({ cues: event.target.value.split("\n").slice(0, 40) })} /></label>
                    <label className="exercise-edit-wide">Demo video URL<input type="url" maxLength={2048} value={draft.videoUrl ?? ""} onChange={event => updateExerciseDraft({ videoUrl: event.target.value })} /></label>
                  </div>
                  <button type="button" className="exercise-save" disabled={saveExerciseMutation.isPending} onClick={() => void saveExerciseDraft()}>{saveExerciseMutation.isPending ? "Saving exercise…" : "Save exercise"}</button>
                </div> : <>
                  <div className="exercise-card-heading"><div><h3>{exercise.name}</h3><p>{exercise.muscle} · {volume.toLocaleString()} kg volume</p></div><button type="button" className="exercise-edit-button" disabled={Boolean(editingExercise) || active !== null} onClick={() => beginExerciseEdit(exercise)}><Pencil size={14} />Edit</button></div>
                  <div className="exercise-stats"><span><b>{exercise.sets}</b> sets</span><span><b>{exercise.reps}</b> reps</span><span><b>{exercise.rest}</b> sec rest</span><span><b>{exercise.tempo}</b> tempo</span></div>
                  {exercise.description && <p className="exercise-description">{exercise.description}</p>}
                  <div className="exercise-plan-sets"><b>Set</b><b>Reps × Weight ({weightUnit})</b>{setList.map((set, setIndex) => <Fragment key={set.id ?? setIndex}><span>{setIndex + 1}</span><span>{set.reps} reps × {toDisplayWeight(set.weight, weightUnit)}{weightUnit}</span></Fragment>)}</div>
                  {exercise.steps?.length ? <ol className="exercise-steps">{exercise.steps.map((step, stepIndex) => <li key={stepIndex}><span>{stepIndex + 1}</span>{step}</li>)}</ol> : exercise.cues?.[0] && <small>{exercise.cues[0]}</small>}
                  {exercise.videoUrl && <a className="exercise-video" href={exercise.videoUrl} target="_blank" rel="noreferrer">↗ Watch demo</a>}
                  {editingProgram && <button type="button" className="text-button danger-text" onClick={() => deleteExercise(exercise.id)}>Remove from day</button>}
                </>}
              </div>
            </article>;
          })}
        </div> : null}
        {(!plan.exercises.length || !active) && <div className="exercise-library-actions">
          <details className="exercise-library-picker" open={addExerciseOpen} onToggle={event => setAddExerciseOpen((event.currentTarget as HTMLDetailsElement).open)}><summary>＋ Add exercise</summary><div role="group" aria-label="Choose an exercise">{visibleLibrary.filter(item => !plan.exercises.some(exercise => exercise.id === item.id)).map(item => <button type="button" key={item.id} onClick={() => addLibraryExercise(item.id)}>{item.name}<span>{item.muscle}</span></button>)}<button type="button" className="exercise-create-option" onClick={addNewExercise}>Create a new exercise</button></div></details>
          {editingProgram && <button type="button" className="text-button danger-text" onClick={deletePlanDraft}>Delete workout day</button>}
        </div>}
        {done && <section className="session-receipt"><div><Check size={17} /><b>Workout complete</b></div><span>{done.totalSets} sets · {Math.round(done.duration / 60)} min · {Math.round(done.totalVolume).toLocaleString()} kg total volume</span></section>}
      </>}
      <section className="recent-workouts"><div className="workout-section-title"><div><h2>Recent sessions</h2><p>Your latest logged training days.</p></div></div>{logs.length ? logs.slice(0, 5).map(log => <div className="recent-row" key={log._id}><span className="recent-date">{new Date(`${log.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><b>{log.dayName || legacyDayLabels[log.dayType] || plans.find(item => item.id === log.dayType)?.name || "Workout day"}</b><span>{log.totalSets} sets</span><span>{Math.round(log.duration / 60)} min</span></div>) : <p className="empty-workouts">Finish your first session to start building a training history.</p>}</section>
    </>}
  </>;
}
