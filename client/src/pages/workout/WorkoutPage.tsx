import { useEffect, useMemo, useRef, useState } from "react";
import { Fragment } from "react";
import { AudioLines, BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, Pause, Pencil, Play, RotateCcw, Square, TimerReset, X, Zap } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../../lib/api/api";
import { enqueueOfflineAction } from "../../lib/api/offlineQueue";
import { toast } from "sonner";
import { ironToday } from "../../utils/date";

type DayType = string;
type Exercise = { id: string; name: string; sets: number; reps: number; muscle: string; tempo: string; rest: number; cues: string[]; description?: string; setList?: { id?: string; reps: number; weight: number }[]; steps?: string[]; videoUrl?: string };
type LibraryExercise = Pick<Exercise, "id" | "name" | "muscle" | "cues" | "description" | "steps" | "videoUrl">;
type Plan = { id: string; name: string; exercises: Exercise[] };
type WorkoutLog = { _id: string; date: string; dayType: DayType; dayName?: string; exercises: { exerciseId: string; name: string; muscle: string; sets: { reps: number; weight: number }[] }[]; totalSets: number; totalVolume: number; duration: number };
type WeekDay = { key: string; label: string; planId: DayType | null };
type SetEntry = { reps: number; weight: number; completed: boolean };
type ActiveWorkout = { date: string; dayType: DayType; dayName: string; startedAt: number; exerciseStartedAt?: number; elapsedBeforePause: number; pausedAt: number | null; pausedRestSeconds: number | null; entries: Record<string, SetEntry[]>; restUntil: number | null; currentExerciseIndex?: number; pendingExerciseIndex?: number | null; restMode?: "set" | "exercise" | "rep"; exerciseSnapshots?: Exercise[]; autoAdvance?: boolean; voiceCoach?: boolean; skippedExercises?: string[] };

const activeKey = "irontrack_active_workout_v1";
const legacyDayLabels: Record<string, string> = { push: "Push", pull: "Pull", legs: "Legs", push_high: "Push · high rep", pull_high: "Pull · high rep", legs_high: "Legs · high rep" };
const readActive = (): ActiveWorkout | null => {
  try { const value = localStorage.getItem(activeKey); if (!value) return null; const parsed = JSON.parse(value) as Partial<ActiveWorkout> & Pick<ActiveWorkout, "date" | "dayType" | "startedAt" | "entries">; return { ...parsed, dayName: parsed.dayName ?? legacyDayLabels[parsed.dayType] ?? "Workout day", exerciseStartedAt: parsed.exerciseStartedAt ?? parsed.startedAt, elapsedBeforePause: parsed.elapsedBeforePause ?? 0, pausedAt: parsed.pausedAt ?? null, pausedRestSeconds: parsed.pausedRestSeconds ?? null, restUntil: parsed.restUntil ?? null, currentExerciseIndex: parsed.currentExerciseIndex ?? 0, pendingExerciseIndex: parsed.pendingExerciseIndex ?? null, restMode: parsed.restMode ?? "set", autoAdvance: parsed.autoAdvance ?? false, voiceCoach: parsed.voiceCoach ?? false, skippedExercises: parsed.skippedExercises ?? [] } as ActiveWorkout; } catch { return null; }
};
const todayWeekKey = () => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${ironToday()}T12:00:00`).getDay()];
const elapsedText = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const numberWords = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function tempoCountCues(tempo: string) {
  const phases = tempo.split("-").map(Number);
  if (phases.length !== 3 || phases.some(phase => !Number.isInteger(phase) || phase < 0 || phase > 10) || phases.every(phase => phase === 0)) return numberWords.slice(0, 6);
  const [lower, hold, lift] = phases;
  return [
    ...Array.from({ length: lower }, (_, index) => `lower ${numberWords[index] ?? index + 1}`),
    ...Array.from({ length: hold }, (_, index) => index === 0 ? "hold" : `hold ${numberWords[index] ?? index + 1}`),
    ...Array.from({ length: lift }, (_, index) => `lift ${numberWords[index] ?? index + 1}`),
  ];
}

type InlineFieldType = "text" | "number" | "url";
type InlinePlanFieldProps = {
  id: string;
  label: string;
  value: string | number;
  editingFieldKey: string | null;
  setEditingFieldKey: (id: string | null) => void;
  onSave: (value: string) => void;
  type?: InlineFieldType;
  displayValue?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  maxLines?: number;
  maxLineLength?: number;
  multiline?: boolean;
  required?: boolean;
  compact?: boolean;
  asHeading?: boolean;
};

function InlinePlanField({
  id, label, value, editingFieldKey, setEditingFieldKey, onSave, type = "text",
  displayValue, min, max, step, maxLength, maxLines, maxLineLength, multiline = false, required = true, compact = false, asHeading = false,
}: InlinePlanFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  const isEditing = editingFieldKey === id;

  function parseDraft() {
    const trimmed = draft.trim();
    if (required && !trimmed) return { error: "This value is required." };
    if (maxLength !== undefined && trimmed.length > maxLength) return { error: `Use ${maxLength} characters or fewer.` };
    if (maxLines !== undefined && trimmed.split("\n").length > maxLines) return { error: `Use ${maxLines} lines or fewer.` };
    if (maxLineLength !== undefined && trimmed.split("\n").some(line => line.length > maxLineLength)) return { error: `Keep each line to ${maxLineLength} characters or fewer.` };
    if (type === "number") {
      const number = Number(trimmed);
      if (!trimmed || !Number.isFinite(number) || step === 1 && !Number.isInteger(number)) return { error: "Enter a valid number." };
      if (min !== undefined && number < min) return { error: `Use ${min} or more.` };
      if (max !== undefined && number > max) return { error: `Use ${max} or less.` };
      return { value: String(number) };
    }
    if (type === "url" && trimmed) {
      try {
        const url = new URL(trimmed);
        if (!["http:", "https:"].includes(url.protocol)) return { error: "Use an HTTP or HTTPS link." };
      } catch {
        return { error: "Enter a valid web link." };
      }
    }
    return { value: trimmed };
  }

  function commit(closeOnError = false) {
    const parsed = parseDraft();
    if (parsed.error) {
      setError(parsed.error);
      if (closeOnError) {
        toast.error(`${label}: ${parsed.error}`);
        setEditingFieldKey(null);
      }
      return;
    }
    onSave(parsed.value ?? "");
    setError("");
    setEditingFieldKey(null);
  }

  useEffect(() => {
    if (!isEditing) return;
    setDraft(String(value));
    setError("");
    const field = inputRef.current ?? textareaRef.current;
    field?.focus();
    field?.select();
  }, [isEditing, value]);

  useEffect(() => {
    if (!isEditing) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) commit(true);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isEditing, draft, label, type, min, max, step, maxLength, maxLines, maxLineLength, required, onSave]);

  const fieldClassName = `inline-plan-field${compact ? " compact" : ""}${isEditing ? " editing" : ""}`;
  if (!isEditing) return <div ref={wrapperRef} className={fieldClassName}>
    <span className={compact ? "sr-only" : "inline-plan-label"}>{label}</span>
    {asHeading ? <h2 className="inline-plan-value" title={displayValue ?? String(value)}>{displayValue ?? (String(value) || "—")}</h2> : <strong className="inline-plan-value" title={displayValue ?? String(value)}>{displayValue ?? (String(value) || "—")}</strong>}
    <button type="button" className="inline-plan-icon" aria-label={`Edit ${label}`} onClick={() => { setDraft(String(value)); setError(""); setEditingFieldKey(id); }}><Pencil size={14} /></button>
  </div>;

  return <div ref={wrapperRef} className={fieldClassName}>
    <label className="inline-plan-input">
      <span className={compact ? "sr-only" : "inline-plan-label"}>{label}</span>
      {multiline
        ? <textarea ref={textareaRef} aria-label={label} maxLength={maxLength} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setEditingFieldKey(null); else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); commit(); } }} />
        : <input ref={inputRef} aria-label={label} type={type} autoComplete="off" min={min} max={max} step={step} maxLength={maxLength} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setEditingFieldKey(null); else if (event.key === "Enter") { event.preventDefault(); commit(); } }} />}
    </label>
    <div className="inline-plan-actions">
      <button type="button" className="inline-plan-icon save" aria-label={`Save ${label}`} onClick={() => commit()}><Check size={15} /></button>
      <button type="button" className="inline-plan-icon cancel" aria-label={`Cancel editing ${label}`} onClick={() => setEditingFieldKey(null)}><X size={15} /></button>
    </div>
    {error && <span className="inline-plan-error" role="alert">{error}</span>}
  </div>;
}

export default function Workout({ onError, accountId }: { onError: (message: string) => void; accountId?: string }) {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState(todayWeekKey());
  const [active, setActive] = useState<ActiveWorkout | null>(readActive);
  const [now, setNow] = useState(Date.now());
  const [editingProgram, setEditingProgram] = useState(false);
  const [weekDraft, setWeekDraft] = useState<WeekDay[]>([]);
  const [planDrafts, setPlanDrafts] = useState<Plan[]>([]);
  const [exerciseLibraryDraft, setExerciseLibraryDraft] = useState<LibraryExercise[]>([]);
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [assignmentDayKey, setAssignmentDayKey] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ["workout", "plans"], queryFn: () => api<Plan[]>("/workout-plans") });
  const weekQuery = useQuery({ queryKey: ["workout", "week"], queryFn: () => api<WeekDay[]>("/workout-week") });
  const libraryQuery = useQuery({ queryKey: ["workout", "exercise-library"], queryFn: () => api<LibraryExercise[]>("/exercise-library") });
  const logsQuery = useQuery({ queryKey: ["workout", "logs", 30], queryFn: () => api<WorkoutLog[]>("/workout-logs?limit=30") });
  const plans = plansQuery.data ?? [];
  const week = weekQuery.data ?? [];
  const exerciseLibrary = libraryQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const loaded = !plansQuery.isPending && !weekQuery.isPending && !libraryQuery.isPending && !logsQuery.isPending;
  const finishMutation = useMutation({
    mutationFn: async (payload: { date: string; dayType: DayType; dayName: string; exercises: { exerciseId: string; name: string; muscle: string; sets: { reps: number; weight: number }[] }[]; duration: number; actionId: string }) => {
      try { return await api("/workout-logs", { method: "POST", body: JSON.stringify(payload) }); }
      catch (error) {
        if (!accountId || !(error instanceof ApiError && error.status === 0)) throw error;
        enqueueOfflineAction({ id: payload.actionId, accountId, kind: "workout_log", path: "/workout-logs", body: payload });
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
  useEffect(() => {
    const error = plansQuery.error ?? weekQuery.error ?? libraryQuery.error ?? logsQuery.error;
    if (error) onError(error.message);
  }, [plansQuery.error, weekQuery.error, libraryQuery.error, logsQuery.error, onError]);
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [active]);
  useEffect(() => { if (active) localStorage.setItem(activeKey, JSON.stringify(active)); else localStorage.removeItem(activeKey); }, [active]);
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
  const sessionDone = Boolean(active && completedSets > 0 && sessionProgressSets >= sessionTotalSets);
  useEffect(() => {
    if (!active?.voiceCoach || active.pausedAt || restSeconds > 0 || !currentExercise || activeSetIndex < 0 || !voiceAvailable) return;
    const synthesis = window.speechSynthesis;
    let cancelled = false;
    let countTimer: number | undefined;
    let countIndex = 0;
    const cues = tempoCountCues(currentExercise.tempo);
    const sayCount = () => {
      if (cancelled) return;
      const utterance = new SpeechSynthesisUtterance(cues[countIndex]);
      utterance.lang = navigator.language;
      utterance.rate = 1.15;
      utterance.onend = () => {
        countIndex = (countIndex + 1) % cues.length;
        countTimer = window.setTimeout(sayCount, 200);
      };
      synthesis.speak(utterance);
    };
    const introduction = new SpeechSynthesisUtterance(`${currentExercise.name}. Set ${activeSetIndex + 1}.`);
    introduction.lang = navigator.language;
    introduction.onend = sayCount;
    synthesis.cancel();
    synthesis.speak(introduction);
    return () => {
      cancelled = true;
      if (countTimer !== undefined) window.clearTimeout(countTimer);
      synthesis.cancel();
    };
  }, [active?.voiceCoach, active?.pausedAt, active?.startedAt, currentExercise?.id, currentExercise?.name, currentExercise?.tempo, activeSetIndex, restSeconds > 0, voiceAvailable]);
  const programIsDirty = editingProgram && (JSON.stringify(weekDraft) !== JSON.stringify(week) || JSON.stringify(planDrafts) !== JSON.stringify(plans) || JSON.stringify(exerciseLibraryDraft) !== JSON.stringify(exerciseLibrary));

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

  function togglePause() {
    setActive(current => {
      if (!current) return null;
      if (current.pausedAt) return { ...current, startedAt: Date.now(), exerciseStartedAt: (current.exerciseStartedAt ?? current.startedAt) + (Date.now() - current.pausedAt), pausedAt: null, restUntil: current.pausedRestSeconds ? Date.now() + current.pausedRestSeconds * 1000 : null, pausedRestSeconds: null };
      return { ...current, elapsedBeforePause: current.elapsedBeforePause + Math.floor((Date.now() - current.startedAt) / 1000), pausedAt: Date.now(), pausedRestSeconds: current.restUntil ? Math.max(0, Math.ceil((current.restUntil - Date.now()) / 1000)) : null, restUntil: null };
    });
  }

  function stopWorkout() {
    if (confirm("End this workout and discard its uncompleted session? Completed sets will not be saved.")) setActive(null);
  }

  function editSet(exerciseId: string, setIndex: number, field: "reps" | "weight", value: number) {
    setActive(current => {
      if (!current) return current;
      const entries = { ...current.entries, [exerciseId]: [...current.entries[exerciseId]] };
      entries[exerciseId][setIndex] = { ...entries[exerciseId][setIndex], [field]: value };
      return { ...current, entries };
    });
  }

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
      return { ...current, entries, currentExerciseIndex: deferExerciseChange ? current.currentExerciseIndex ?? 0 : nextExerciseIndex, pendingExerciseIndex: deferExerciseChange ? nextExerciseIndex : null, exerciseStartedAt: exerciseFinished && !deferExerciseChange ? Date.now() : current.exerciseStartedAt, restMode, restUntil: moreSets ? Date.now() + (exerciseFinished ? Math.max(exercise.rest, 60) : exercise.rest) * 1000 : null };
    });
  }

  function startRepTimer(exercise: Exercise) {
    const seconds = exercise.tempo.split(/[\s-]+/).map(Number).filter(Number.isFinite).reduce((sum, value) => sum + value, 0) || 6;
    setActive(current => current ? { ...current, restUntil: Date.now() + seconds * 1000, restMode: "rep" } : null);
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
      if (current.autoAdvance && current.pendingExerciseIndex != null) {
        return { ...current, autoAdvance: false, currentExerciseIndex: current.pendingExerciseIndex, pendingExerciseIndex: null, exerciseStartedAt: Date.now() };
      }
      return { ...current, autoAdvance: !current.autoAdvance };
    });
  }

  function toggleVoiceCoach() {
    setActive(current => current ? { ...current, voiceCoach: !current.voiceCoach } : null);
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

  async function finishWorkout() {
    if (!active || finishMutation.isPending) return;
    const sessionPlan = activePlan;
    if (!sessionPlan) return;
    const exercises = sessionPlan.exercises.map(exercise => ({
      exerciseId: exercise.id, name: exercise.name, muscle: exercise.muscle,
      sets: (active.entries[exercise.id] ?? []).filter(entry => entry.completed).map(({ reps, weight }) => ({ reps, weight }))
    })).filter(exercise => exercise.sets.length);
    try {
      const result = await finishMutation.mutateAsync({ date: active.date, dayType: active.dayType, dayName: active.dayName, exercises, duration: elapsed, actionId: crypto.randomUUID() }) as { queuedOffline?: boolean };
      setActive(null);
      if (result.queuedOffline) toast.success("Workout saved on this device. It will sync when you reconnect.");
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
    setEditingFieldKey(null);
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
      setEditingFieldKey(null);
      setAssignmentDayKey(null);
      toast.success("Workout plan saved");
    } catch (reason) { onError((reason as Error).message); }
  }

  function updatePlanName(planId: string, name: string) {
    setPlanDrafts(current => current.map(item => item.id === planId ? { ...item, name } : item));
  }

  function updateLibraryExercise(exerciseId: string, patch: Partial<LibraryExercise>) {
    setExerciseLibraryDraft(current => current.map(item => item.id === exerciseId ? { ...item, ...patch } : item));
  }

  function updatePlanExercise(exerciseId: string, patch: Partial<Exercise>) {
    if (!plan) return;
    setPlanDrafts(current => current.map(item => item.id === plan.id ? {
      ...item,
      exercises: item.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, ...patch } : exercise),
    } : item));
  }

  function updateWeekAssignment(dayKey: string, planId: string | null) {
    setWeekDraft(current => current.map(day => day.key === dayKey ? { ...day, planId } : day));
  }

  function createPlanDraft() {
    const planId = `day-${crypto.randomUUID()}`;
    const dayKey = assignmentDayKey ?? selectedKey;
    setPlanDrafts(current => [...current, { id: planId, name: "New workout", exercises: [] }]);
    updateWeekAssignment(dayKey, planId);
    setSelectedKey(dayKey);
    setAssignmentDayKey(null);
    setEditingFieldKey(`plan:${dayKey}:${planId}:name`);
  }

  function deletePlanDraft() {
    if (!plan || !confirm(`Remove “${plan.name}” from your workout plans? Past sessions stay in your history.`)) return;
    setPlanDrafts(current => current.filter(item => item.id !== plan.id));
    setWeekDraft(current => current.map(day => day.planId === plan.id ? { ...day, planId: null } : day));
  }

  function addNewExercise() {
    if (!plan) return;
    const exerciseId = `exercise-${crypto.randomUUID()}`;
    setExerciseLibraryDraft(current => [...current, { id: exerciseId, name: "New exercise", muscle: "General", description: "", cues: [], steps: [], videoUrl: "" }]);
    setPlanDrafts(current => current.map(item => item.id === plan.id ? { ...item, exercises: [...item.exercises, { id: exerciseId, name: "New exercise", muscle: "General", sets: 3, reps: 10, rest: 60, tempo: "3-1-2", cues: [], description: "", setList: [{ id: `set-${crypto.randomUUID()}`, reps: 10, weight: 0 }], steps: [], videoUrl: "" }] } : item));
  }

  function addLibraryExercise(exerciseId: string) {
    if (!plan) return;
    const definition = exerciseLibraryDraft.find(item => item.id === exerciseId);
    if (!definition || plan.exercises.some(exercise => exercise.id === definition.id)) return;
    setPlanDrafts(current => current.map(item => item.id === plan.id ? { ...item, exercises: [...item.exercises, { ...definition, sets: 3, reps: 10, rest: 60, tempo: "3-1-2", setList: [{ id: `set-${crypto.randomUUID()}`, reps: 10, weight: 0 }] }] } : item));
  }

  function deleteExercise(exerciseId: string) {
    if (!plan) return;
    setPlanDrafts(current => current.map(item => item.id === plan.id ? { ...item, exercises: item.exercises.filter(exercise => exercise.id !== exerciseId) } : item));
  }

  function addExerciseSet(exercise: Exercise) {
    const currentSets = exercise.setList?.length ? exercise.setList : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }));
    if (currentSets.length >= 20) {
      toast.error("A workout exercise can have up to 20 sets.");
      return;
    }
    const nextSets = [...currentSets, { id: `set-${crypto.randomUUID()}`, reps: exercise.reps, weight: 0 }];
    updatePlanExercise(exercise.id, { setList: nextSets, sets: nextSets.length });
  }

  function removeExerciseSet(exercise: Exercise, setIndex: number) {
    const current = exercise.setList?.length ? exercise.setList : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }));
    const nextSets = current.filter((_, index) => index !== setIndex);
    if (!nextSets.length) return;
    updatePlanExercise(exercise.id, { setList: nextSets, sets: nextSets.length });
  }

  function updateExerciseSet(exercise: Exercise, setIndex: number, field: "reps" | "weight", value: number) {
    const sets = exercise.setList?.length ? exercise.setList : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }));
    updatePlanExercise(exercise.id, { setList: sets.map((set, index) => index === setIndex ? { ...set, [field]: value } : set) });
  }

  function updateExerciseSetCount(exercise: Exercise, count: number) {
    const currentSets: NonNullable<Exercise["setList"]> = exercise.setList?.length
      ? [...exercise.setList]
      : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }));
    const setList = currentSets.slice(0, count);
    while (setList.length < count) setList.push({ id: `set-${crypto.randomUUID()}`, reps: exercise.reps, weight: 0 });
    updatePlanExercise(exercise.id, { sets: count, setList });
  }

  return <>
    <header className="workout-page-header"><div><h1>Workout</h1><p>Build strength one controlled set at a time.</p></div><div className="workout-header-actions"><button type="button" className="workout-stats-link" onClick={() => navigate("/workout/stats")}><BarChart3 size={16} /> Stats</button><div className="workout-head-meta"><Dumbbell size={18} /><span>Dumbbells</span></div>{editingProgram ? <><button type="button" className="workout-cancel-edit" onClick={cancelProgramEdit}><X size={16} /><span>Cancel changes</span></button><button type="button" className="start-workout workout-save-top" disabled={!programIsDirty || saveProgramMutation.isPending} onClick={() => void saveProgram()}>{saveProgramMutation.isPending ? "Saving…" : "Save changes"}</button></> : <button type="button" className="start-workout" disabled={active !== null || !loaded} onClick={beginProgramEdit}>Edit plan</button>}</div></header>
    <div className={`week-strip ${editingProgram ? "week-strip-editing" : ""}`} role="group" tabIndex={0} aria-label="Workout days">
      {visibleWeek.map(day => {
        const assignedPlan = visiblePlans.find(item => item.id === day.planId);
        const completedToday = day.planId && logs.some(log => log.date === ironToday() && log.dayType === day.planId);
        return editingProgram ? <div className={`week-day-editor ${selectedKey === day.key ? "selected" : ""}`} key={day.key}>
          <button type="button" className="week-day-select" aria-pressed={selectedKey === day.key} onClick={() => setSelectedKey(day.key)}><span>{day.label.slice(0, 3)}</span>{completedToday && <i aria-label="Completed" />}</button>
          {assignedPlan ? <div className="week-day-workout">
            <InlinePlanField
              id={`plan:${day.key}:${assignedPlan.id}:name`}
              label={`${day.label} workout name`}
              value={assignedPlan.name}
              editingFieldKey={editingFieldKey}
              setEditingFieldKey={setEditingFieldKey}
              onSave={value => updatePlanName(assignedPlan.id, value)}
              maxLength={80}
              compact
            />
            <button type="button" className="week-day-change" aria-label={`Change workout for ${day.label}`} aria-expanded={assignmentDayKey === day.key} onClick={() => setAssignmentDayKey(current => current === day.key ? null : day.key)}>Change workout</button>
          </div> : <button type="button" className="week-day-assign" aria-label={`Assign workout to ${day.label}`} onClick={() => setAssignmentDayKey(current => current === day.key ? null : day.key)}>＋ Assign workout</button>}
        </div> : <button type="button" key={day.key} className={selectedKey === day.key ? "selected" : ""} onClick={() => setSelectedKey(day.key)}>
          <span>{day.label.slice(0, 3)}</span><b>{assignedPlan?.name ?? "Rest"}</b>{completedToday && <i aria-label="Completed" />}
        </button>;
      })}
    </div>
    {editingProgram && assignmentDayKey && <div className="week-assignment-panel" role="group" aria-label={`Choose a workout for ${visibleWeek.find(day => day.key === assignmentDayKey)?.label ?? "this day"}`}>
      <span>{visibleWeek.find(day => day.key === assignmentDayKey)?.label}: assign a workout</span>
      <div>
        <button type="button" aria-pressed={!visibleWeek.find(day => day.key === assignmentDayKey)?.planId} onClick={() => { updateWeekAssignment(assignmentDayKey, null); setAssignmentDayKey(null); }}>Rest day</button>
        {visiblePlans.map(item => <button type="button" key={item.id} aria-pressed={visibleWeek.find(day => day.key === assignmentDayKey)?.planId === item.id} onClick={() => { updateWeekAssignment(assignmentDayKey, item.id); setSelectedKey(assignmentDayKey); setAssignmentDayKey(null); }}>{item.name}</button>)}
        <button type="button" className="week-day-new" onClick={createPlanDraft}>＋ New workout</button>
      </div>
    </div>}
    {editingProgram && <div className="workout-program-actions"><button type="button" className="text-button" onClick={createPlanDraft}>＋ Create workout day</button></div>}
    {active ? <section className="active-workout">
      <div className="active-workout-top"><div><span className={`live-dot ${active.pausedAt ? "paused" : ""}`} /> {active.pausedAt ? "Paused" : "In progress"}</div><strong><Clock3 size={16} /> {elapsedText(elapsed)}</strong><div className="workout-session-controls"><button type="button" className="session-control" onClick={togglePause}>{active.pausedAt ? <Play size={15} /> : <Pause size={15} />}{active.pausedAt ? "Resume" : "Pause"}</button><button type="button" className="session-control session-stop" onClick={stopWorkout}><X size={15} /> End</button></div></div>
      <div className="workout-mode-controls" aria-label="Workout coaching options">
        <button type="button" className={`session-control ${active.autoAdvance ? "mode-active" : ""}`} aria-pressed={Boolean(active.autoAdvance)} onClick={toggleAutoAdvance}><Zap size={15} />Auto {active.autoAdvance ? "On" : "Off"}</button>
        <button type="button" className={`session-control ${active.voiceCoach ? "mode-active" : ""}`} aria-pressed={Boolean(active.voiceCoach)} aria-label={voiceAvailable ? `Voice coach ${active.voiceCoach ? "on" : "off"}` : "Voice coach unavailable in this browser"} disabled={!voiceAvailable} onClick={toggleVoiceCoach}><AudioLines size={15} />{voiceAvailable ? `Voice ${active.voiceCoach ? "On" : "Off"}` : "Voice unavailable"}</button>
      </div>
      <h2>{active.dayName}</h2>
      <p>{completedSets} sets logged.{skippedExerciseCount > 0 ? ` ${skippedExerciseCount} exercise${skippedExerciseCount === 1 ? "" : "s"} ha${skippedExerciseCount === 1 ? "s" : "ve"} skipped sets.` : ""} Record each set as you go.</p>
      <div className="session-progress"><button type="button" aria-label="End workout" onClick={stopWorkout}><ChevronLeft size={18} /></button><div><i style={{ width: `${sessionTotalSets ? Math.min(sessionProgressSets / sessionTotalSets * 100, 100) : 0}%` }} /></div><span>{currentExercise ? currentExerciseIndex + 1 : activePlan?.exercises.length ?? 0}/{activePlan?.exercises.length ?? 0}</span></div>
      <div className="exercise-pills" aria-label="Workout exercises">{activePlan?.exercises.map((exercise, index) => { const complete = (active.entries[exercise.id] ?? []).every(entry => entry.completed); const skipped = skippedExerciseIds.includes(exercise.id); return <button type="button" key={exercise.id} className={`${index === currentExerciseIndex ? "current" : ""} ${complete ? "complete" : ""} ${skipped ? "skipped" : ""}`} onClick={() => setActive(current => current ? { ...current, skippedExercises: (current.skippedExercises ?? []).filter(id => id !== exercise.id), currentExerciseIndex: index, exerciseStartedAt: Date.now() } : null)} aria-label={`${skipped ? "Skipped" : "Go to"} exercise ${index + 1}: ${exercise.name}`}>{index + 1}</button>; })}</div>
      <div className="session-clock-row"><span><Clock3 size={14} /> Workout <b>{elapsedText(elapsed)}</b></span><span><TimerReset size={14} /> Exercise <b>{elapsedText(exerciseElapsed)}</b></span></div>
      {restSeconds > 0 && <div className="session-countdown"><div className="countdown-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="44" style={{ strokeDasharray: 276.46, strokeDashoffset: 276.46 * (1 - restSeconds / Math.max(1, restTotal)) }} /></svg><b>{restSeconds}</b><small>sec</small></div><p>{active.pausedAt ? "Timer paused" : active.autoAdvance && active.pendingExerciseIndex != null ? "Next exercise starts after rest" : active.restMode === "exercise" ? "Rest between exercises" : active.restMode === "rep" ? "Rep tempo timer" : "Rest between sets"}</p>{!active.pausedAt && <button type="button" onClick={() => setActive(current => current ? { ...current, restUntil: null } : null)}>Skip timer</button>}</div>}
      {!activePlan ? <p className="empty-workouts">Loading workout plan…</p> : sessionDone ? (
        <section className="session-done"><span>🏆</span><h2>Workout Complete!</h2><div><article><b>{completedSets}</b><small>Sets</small></article><article><b>{elapsedText(elapsed)}</b><small>Duration</small></article><article><b>{completedExerciseCount}</b><small>Exercises</small></article><article><b>{activePlan.exercises.reduce((sum, exercise) => sum + (active.entries[exercise.id] ?? []).reduce((total, set) => total + set.reps * set.weight, 0), 0).toLocaleString()} kg</b><small>Volume</small></article></div>
          {skippedExerciseCount > 0 && <><p>{skippedExerciseCount} exercise{skippedExerciseCount === 1 ? " has" : "s have"} skipped sets. Only completed sets will be saved.</p><div className="session-skipped-actions">{activePlan.exercises.map((exercise, index) => skippedExerciseIds.includes(exercise.id) && <button type="button" key={exercise.id} onClick={() => resumeSkippedExercise(exercise.id, index)}>Resume {exercise.name}</button>)}</div></>}
          <button type="button" className="finish-workout" disabled={finishMutation.isPending || Boolean(active.pausedAt)} onClick={() => void finishWorkout()}><Square size={15} />{finishMutation.isPending ? "Saving workout…" : "Save workout and return"}</button>
        </section>
      ) : currentExercise ? <article className="session-exercise session-current-exercise">
        <div className="session-exercise-title"><div><p className="session-muscle">{currentExercise.muscle}</p><h3>{currentExercise.name}</h3></div><strong>{(active.entries[currentExercise.id] ?? []).filter(entry => entry.completed).length + 1}<small>/{currentExercise.sets} set</small></strong></div>
        {currentExercise.description && <p className="exercise-cue">{currentExercise.description}</p>}
        <div className="session-rep-grid"><div><b>{currentExercise.reps}</b><small>reps</small></div><div><b>{currentExercise.tempo}</b><small>tempo</small></div><div><b>{currentExercise.rest || 60}s</b><small>rest</small></div></div>
        {currentExercise.cues.length > 0 && <div className="session-cues"><b>Cues</b>{currentExercise.cues.map((cue, index) => <p key={index}><ChevronRight size={13} />{cue}</p>)}</div>}
        <div className="session-exercises"><div className="set-head"><span>Set</span><span>Reps</span><span>Load</span><span /></div>
        {(active.entries[currentExercise.id] ?? []).map((entry, index) => <div className={`set-row ${entry.completed ? "set-done" : ""}`} key={`${currentExercise.id}-${index}`}>
          <span className="set-number">{index + 1}</span><input type="number" min="0" max="1000" value={entry.reps} disabled={entry.completed || Boolean(active.pausedAt)} aria-label={`${currentExercise.name} set ${index + 1} reps`} onChange={event => editSet(currentExercise.id, index, "reps", Number(event.target.value))} /><input type="number" min="0" step="0.5" max="10000" value={entry.weight || ""} placeholder="0" disabled={entry.completed || Boolean(active.pausedAt)} aria-label={`${currentExercise.name} set ${index + 1} weight`} onChange={event => editSet(currentExercise.id, index, "weight", Number(event.target.value))} /><span>{entry.completed && <Check size={15} />}</span>
        </div>)}</div>
        <button type="button" className="finish-workout" disabled={!currentEntries.some(entry => !entry.completed) || restSeconds > 0 || Boolean(active.pausedAt)} onClick={() => completeSet(currentExercise, activeSetIndex)}><Check size={16} /> Done — Set {currentEntries.filter(entry => entry.completed).length + 1} of {currentExercise.sets}</button>
        <div className="session-bottom-actions"><button type="button" disabled={Boolean(active.pausedAt)} onClick={() => startRepTimer(currentExercise)}><TimerReset size={14} /> Rep Timer</button><button type="button" disabled={Boolean(active.pausedAt)} onClick={skipExercise}><ChevronRight size={14} /> Skip Exercise</button></div>
      </article> : null}
    </section> : <>
    {!loaded ? <section className="rest-day"><h2>Loading your training plan</h2></section> : !selected?.planId ? <section className="rest-day"><div className="rest-mark"><RotateCcw /></div><h2>{plans.length ? "Recovery day" : "Start with your own workout"}</h2><p>{plans.length ? "This day is set aside for rest. Assign a workout day here whenever your schedule changes." : "Create a workout day, add your exercises, then choose which days you want to train."}</p>{!plans.length && <button type="button" className="start-workout" onClick={() => { beginProgramEdit(); createPlanDraft(); }}>Create your first workout day</button>}</section> : !plan ? <section className="rest-day"><h2>Workout day unavailable</h2><p>This schedule entry no longer has a saved plan. Edit your weekly schedule to choose another workout or rest day.</p></section> : <>
        <section className="workout-overview"><div className="overview-copy"><span className="program-label">{selected.label}</span>{editingProgram ? <InlinePlanField id={`plan:${plan.id}:overview-name`} label="Workout name" value={plan.name} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updatePlanName(plan.id, value)} maxLength={80} asHeading /> : <h2>{plan.name}</h2>}<p>{plan.exercises.length} exercises · {totalSets} working sets · Dumbbells</p></div><div className="overview-action">{done ? <span className="workout-complete"><Check size={16} /> Completed today</span> : !editingProgram && <button type="button" className="start-workout" disabled={!plan.exercises.length} onClick={startWorkout}><Play size={16} fill="currentColor" /> Start workout</button>}</div></section>
        <div className="workout-section-title"><div><h2>Exercises in this workout</h2><p>Set targets are specific to this day. Exercise details are shared by ID.</p></div></div>
        {plan.exercises.length ? <div className="exercise-list">
          {plan.exercises.map((exercise, index) => {
            const setList: NonNullable<Exercise["setList"]> = exercise.setList?.length
              ? exercise.setList
              : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }));
            const volume = setList.reduce((sum, set) => sum + set.reps * set.weight, 0);
            const definition = libraryById.get(exercise.id);
            const exerciseLabel = exercise.name;
            return <article className={`exercise-card ${done ? "exercise-locked" : ""}`} key={exercise.id}>
              <div className="exercise-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="exercise-main">
                <div className="exercise-card-heading">
                  {editingProgram
                    ? <InlinePlanField id={`exercise:${exercise.id}:name`} label={`${exerciseLabel} name`} value={definition?.name ?? exercise.name} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateLibraryExercise(exercise.id, { name: value })} maxLength={120} />
                    : <h3>{exercise.name}</h3>}
                  {editingProgram && <button type="button" className="text-button danger-text" onClick={() => deleteExercise(exercise.id)}>Remove from day</button>}
                </div>
                {editingProgram && <div className="exercise-inline-fields">
                  <InlinePlanField id={`exercise:${exercise.id}:muscle`} label={`${exerciseLabel} muscle`} value={definition?.muscle ?? exercise.muscle} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateLibraryExercise(exercise.id, { muscle: value })} maxLength={80} />
                  <InlinePlanField id={`exercise:${exercise.id}:sets`} label={`${exerciseLabel} sets`} value={exercise.sets} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateExerciseSetCount(exercise, Number(value))} type="number" min={1} max={20} step={1} />
                  <InlinePlanField id={`exercise:${exercise.id}:reps`} label={`${exerciseLabel} target reps`} value={exercise.reps} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updatePlanExercise(exercise.id, { reps: Number(value) })} type="number" min={1} max={100} step={1} />
                  <InlinePlanField id={`exercise:${exercise.id}:rest`} label={`${exerciseLabel} rest seconds`} value={exercise.rest} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updatePlanExercise(exercise.id, { rest: Number(value) })} type="number" min={0} max={600} />
                  <InlinePlanField id={`exercise:${exercise.id}:tempo`} label={`${exerciseLabel} tempo`} value={exercise.tempo} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updatePlanExercise(exercise.id, { tempo: value })} maxLength={40} />
                </div>}
                <p>{exercise.muscle} · {volume.toLocaleString()} kg vol</p>
                {!editingProgram && <div className="exercise-stats"><span><b>{exercise.sets}</b> sets</span><span><b>{exercise.reps}</b> reps</span><span><b>{exercise.rest}</b> sec rest</span><span><b>{exercise.tempo}</b> tempo</span></div>}
                {exercise.description && !editingProgram && <p className="exercise-description">{exercise.description}</p>}
                <div className="exercise-plan-sets">
                  <b>Set</b><b>Reps × Weight</b>
                  {setList.map((set, setIndex) => <Fragment key={set.id ?? setIndex}>
                    <span>{setIndex + 1}</span>
                    <span className={editingProgram ? "exercise-set-edit" : ""}>
                      {editingProgram
                        ? <>
                          <InlinePlanField id={`exercise:${exercise.id}:set:${setIndex}:reps`} label={`${exerciseLabel} set ${setIndex + 1} reps`} value={set.reps} displayValue={`${set.reps} reps`} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateExerciseSet(exercise, setIndex, "reps", Number(value))} type="number" min={1} max={1000} step={1} compact />
                          <span>×</span>
                          <InlinePlanField id={`exercise:${exercise.id}:set:${setIndex}:weight`} label={`${exerciseLabel} set ${setIndex + 1} weight`} value={set.weight} displayValue={`${set.weight} kg`} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateExerciseSet(exercise, setIndex, "weight", Number(value))} type="number" min={0} max={10000} step={0.5} compact />
                          {setList.length > 1 && <button type="button" className="text-button danger-text" onClick={() => removeExerciseSet(exercise, setIndex)}>Remove</button>}
                        </>
                        : `${set.reps} reps × ${set.weight}kg`}
                    </span>
                  </Fragment>)}
                </div>
                {editingProgram && <>
                  <button type="button" className="add-plan-set" onClick={() => addExerciseSet(exercise)}>＋ Add set</button>
                  <details className="exercise-details-editor">
                    <summary>Exercise details and coaching cues</summary>
                    <InlinePlanField id={`exercise:${exercise.id}:description`} label={`${exerciseLabel} description`} value={definition?.description ?? ""} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateLibraryExercise(exercise.id, { description: value })} maxLength={4000} multiline required={false} />
                    <InlinePlanField id={`exercise:${exercise.id}:steps`} label={`${exerciseLabel} instructions`} value={(definition?.steps ?? []).join("\n")} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateLibraryExercise(exercise.id, { steps: value.split("\n").map(step => step.trim()).filter(Boolean) })} maxLength={20_039} maxLines={40} maxLineLength={500} multiline required={false} />
                    <InlinePlanField id={`exercise:${exercise.id}:cues`} label={`${exerciseLabel} form cues`} value={(definition?.cues ?? []).join("\n")} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateLibraryExercise(exercise.id, { cues: value.split("\n").map(cue => cue.trim()).filter(Boolean) })} maxLength={12_039} maxLines={40} maxLineLength={300} multiline required={false} />
                    <InlinePlanField id={`exercise:${exercise.id}:video`} label={`${exerciseLabel} demo video URL`} value={definition?.videoUrl ?? ""} editingFieldKey={editingFieldKey} setEditingFieldKey={setEditingFieldKey} onSave={value => updateLibraryExercise(exercise.id, { videoUrl: value })} type="url" maxLength={2048} required={false} />
                  </details>
                </>}
                {!editingProgram && exercise.steps?.length ? <ol className="exercise-steps">{exercise.steps.map((step, stepIndex) => <li key={stepIndex}><span>{stepIndex + 1}</span>{step}</li>)}</ol> : !editingProgram && exercise.cues[0] && <small>{exercise.cues[0]}</small>}
                {exercise.videoUrl && !editingProgram && <a className="exercise-video" href={exercise.videoUrl} target="_blank" rel="noreferrer">↗ Watch demo</a>}
              </div>
            </article>;
          })}
        </div> : <section className="workout-empty"><p>No exercises yet. Add an existing exercise or create a new one.</p></section>}
        {editingProgram && <div className="exercise-library-actions"><details className="exercise-library-picker"><summary>Add from exercise library</summary><div role="group" aria-label="Exercises in your library">{visibleLibrary.filter(item => !plan.exercises.some(exercise => exercise.id === item.id)).map(item => <button type="button" key={item.id} onClick={() => addLibraryExercise(item.id)}>{item.name}<span>{item.muscle}</span></button>)}</div></details><button type="button" className="text-button" onClick={addNewExercise}>＋ New exercise</button><button type="button" className="text-button danger-text" onClick={deletePlanDraft}>Delete workout day</button></div>}
        {done && <section className="session-receipt"><div><Check size={17} /><b>Workout complete</b></div><span>{done.totalSets} sets · {Math.round(done.duration / 60)} min · {Math.round(done.totalVolume).toLocaleString()} kg total volume</span></section>}
      </>}
      <section className="recent-workouts"><div className="workout-section-title"><div><h2>Recent sessions</h2><p>Your latest logged training days.</p></div></div>{logs.length ? logs.slice(0, 5).map(log => <div className="recent-row" key={log._id}><span className="recent-date">{new Date(`${log.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><b>{log.dayName || legacyDayLabels[log.dayType] || plans.find(item => item.id === log.dayType)?.name || "Workout day"}</b><span>{log.totalSets} sets</span><span>{Math.round(log.duration / 60)} min</span></div>) : <p className="empty-workouts">Finish your first session to start building a training history.</p>}</section>
    </>}
  </>;
}
