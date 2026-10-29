import { FormEvent, useEffect, useMemo, useState } from "react";
import { Fragment } from "react";
import { BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, Pause, Play, RotateCcw, Square, TimerReset, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../../lib/api/api";
import { enqueueOfflineAction } from "../../lib/api/offlineQueue";
import { toast } from "sonner";
import { ironToday } from "../../utils/date";

type DayType = string;
type Exercise = { id: string; name: string; sets: number; reps: number; muscle: string; tempo: string; rest: number; cues: string[]; description?: string; setList?: { id?: string; reps: number; weight: number }[]; steps?: string[]; videoUrl?: string };
type Plan = { id: string; name: string; exercises: Exercise[] };
type WorkoutLog = { _id: string; date: string; dayType: DayType; dayName?: string; exercises: { exerciseId: string; name: string; muscle: string; sets: { reps: number; weight: number }[] }[]; totalSets: number; totalVolume: number; duration: number };
type WeekDay = { key: string; label: string; planId: DayType | null };
type SetEntry = { reps: number; weight: number; completed: boolean };
type ActiveWorkout = { date: string; dayType: DayType; dayName: string; startedAt: number; exerciseStartedAt?: number; elapsedBeforePause: number; pausedAt: number | null; pausedRestSeconds: number | null; entries: Record<string, SetEntry[]>; restUntil: number | null; currentExerciseIndex?: number; restMode?: "set" | "exercise" | "rep" };

const activeKey = "irontrack_active_workout_v1";
const legacyDayLabels: Record<string, string> = { push: "Push", pull: "Pull", legs: "Legs", push_high: "Push · high rep", pull_high: "Pull · high rep", legs_high: "Legs · high rep" };
const readActive = (): ActiveWorkout | null => {
  try { const value = localStorage.getItem(activeKey); if (!value) return null; const parsed = JSON.parse(value) as Partial<ActiveWorkout> & Pick<ActiveWorkout, "date" | "dayType" | "startedAt" | "entries">; return { ...parsed, dayName: parsed.dayName ?? legacyDayLabels[parsed.dayType] ?? "Workout day", exerciseStartedAt: parsed.exerciseStartedAt ?? parsed.startedAt, elapsedBeforePause: parsed.elapsedBeforePause ?? 0, pausedAt: parsed.pausedAt ?? null, pausedRestSeconds: parsed.pausedRestSeconds ?? null, restUntil: parsed.restUntil ?? null, currentExerciseIndex: parsed.currentExerciseIndex ?? 0, restMode: parsed.restMode ?? "set" } as ActiveWorkout; } catch { return null; }
};
const todayWeekKey = () => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${ironToday()}T12:00:00`).getDay()];
const elapsedText = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function Workout({ onError, accountId }: { onError: (message: string) => void; accountId?: string }) {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState(todayWeekKey());
  const [active, setActive] = useState<ActiveWorkout | null>(readActive);
  const [now, setNow] = useState(Date.now());
  const [editingPlan, setEditingPlan] = useState(false);
  const [editingWeek, setEditingWeek] = useState(false);
  const [weekDraft, setWeekDraft] = useState<WeekDay[]>([]);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ["workout", "plans"], queryFn: () => api<Plan[]>("/workout-plans") });
  const weekQuery = useQuery({ queryKey: ["workout", "week"], queryFn: () => api<WeekDay[]>("/workout-week") });
  const logsQuery = useQuery({ queryKey: ["workout", "logs", 30], queryFn: () => api<WorkoutLog[]>("/workout-logs?limit=30") });
  const plans = plansQuery.data ?? [];
  const week = weekQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const loaded = !plansQuery.isPending && !weekQuery.isPending && !logsQuery.isPending;
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
  const savePlanMutation = useMutation({
    mutationFn: ({ planId, name, exercises }: { planId: DayType; name: string; exercises: Exercise[] }) => api<Plan>(`/workout-plans/${planId}`, { method: "PUT", body: JSON.stringify({ name, exercises }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workout", "plans"] }),
  });
  const saveWeekMutation = useMutation({
    mutationFn: (days: WeekDay[]) => api<WeekDay[]>("/workout-week", { method: "PUT", body: JSON.stringify({ days }) }),
    onSuccess: days => queryClient.setQueryData(["workout", "week"], days),
  });
  useEffect(() => {
    const error = plansQuery.error ?? weekQuery.error ?? logsQuery.error;
    if (error) onError(error.message);
  }, [plansQuery.error, weekQuery.error, logsQuery.error, onError]);
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [active]);
  useEffect(() => { if (active) localStorage.setItem(activeKey, JSON.stringify(active)); else localStorage.removeItem(activeKey); }, [active]);

  const selected = week.find(day => day.key === selectedKey) ?? week.find(day => day.key === todayWeekKey());
  const plan = plans.find(item => item.id === selected?.planId);
  useEffect(() => { if (plan && !editingPlan) setNameDraft(plan.name); }, [plan?.id, plan?.name, editingPlan]);
  const activePlan = active ? plans.find(item => item.id === active.dayType) : undefined;
  const sessionTotalSets = activePlan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? plan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
  const currentExerciseIndex = active && activePlan?.exercises.length ? Math.min(active.currentExerciseIndex ?? 0, activePlan.exercises.length - 1) : 0;
  const currentExercise = activePlan?.exercises[currentExerciseIndex];
  const done = selected?.planId ? logs.find(log => log.date === ironToday() && log.dayType === selected.planId) : undefined;
  const elapsed = active ? active.elapsedBeforePause + (active.pausedAt ? 0 : Math.max(0, Math.floor((now - active.startedAt) / 1000))) : 0;
  const exerciseElapsed = active ? Math.max(0, Math.floor(((active.pausedAt ?? now) - (active.exerciseStartedAt ?? active.startedAt)) / 1000)) : 0;
  const restSeconds = active?.pausedAt ? active.pausedRestSeconds ?? 0 : active?.restUntil ? Math.max(0, Math.ceil((active.restUntil - now) / 1000)) : 0;
  const repTimerSeconds = currentExercise?.tempo.split(/[\s-]+/).map(Number).filter(Number.isFinite).reduce((sum, value) => sum + value, 0) || 6;
  const restTotal = active?.restMode === "rep" ? repTimerSeconds : active?.restMode === "exercise" ? Math.max(currentExercise?.rest ?? 0, 60) : currentExercise?.rest ?? 60;
  const totalSets = useMemo(() => plan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0, [plan]);
  const completedSets = active ? Object.values(active.entries).reduce((sum, entries) => sum + entries.filter(entry => entry.completed).length, 0) : 0;

  function startWorkout() {
    if (!selected?.planId || !plan) return;
    const previous = [...logs].filter(log => log.dayType === selected.planId).sort((a, b) => b.date.localeCompare(a.date))[0];
    const entries = Object.fromEntries(plan.exercises.map(exercise => {
      const previousSets = previous?.exercises.find(item => item.exerciseId === exercise.id)?.sets ?? [];
      const last = previousSets.at(-1);
      return [exercise.id, Array.from({ length: exercise.sets }, (_, index) => ({ reps: previousSets[index]?.reps ?? last?.reps ?? exercise.setList?.[index]?.reps ?? exercise.reps, weight: previousSets[index]?.weight ?? last?.weight ?? exercise.setList?.[index]?.weight ?? 0, completed: false }))];
    }));
    setActive({ date: ironToday(), dayType: selected.planId, dayName: plan.name, startedAt: Date.now(), exerciseStartedAt: Date.now(), elapsedBeforePause: 0, pausedAt: null, pausedRestSeconds: null, entries, restUntil: null, currentExerciseIndex: 0, restMode: "set" });
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
      const entries = { ...current.entries, [exercise.id]: [...current.entries[exercise.id]] };
      entries[exercise.id][setIndex] = { ...entries[exercise.id][setIndex], completed: true };
      const moreSets = Object.values(entries).some(list => list.some(entry => !entry.completed));
      const exerciseFinished = entries[exercise.id].every(entry => entry.completed);
      const nextExerciseIndex = exerciseFinished ? Math.min((current.currentExerciseIndex ?? 0) + 1, Math.max(0, (activePlan?.exercises.length ?? 1) - 1)) : current.currentExerciseIndex ?? 0;
      const restMode = exerciseFinished ? "exercise" : "set";
      return { ...current, entries, currentExerciseIndex: nextExerciseIndex, exerciseStartedAt: exerciseFinished ? Date.now() : current.exerciseStartedAt, restMode, restUntil: moreSets ? Date.now() + (exerciseFinished ? Math.max(exercise.rest, 60) : exercise.rest) * 1000 : null };
    });
  }

  function startRepTimer(exercise: Exercise) {
    const seconds = exercise.tempo.split(/[\s-]+/).map(Number).filter(Number.isFinite).reduce((sum, value) => sum + value, 0) || 6;
    setActive(current => current ? { ...current, restUntil: Date.now() + seconds * 1000, restMode: "rep" } : null);
  }

  function skipExercise() {
    if (!active || !activePlan) return;
    setActive(current => current ? { ...current, currentExerciseIndex: Math.min((current.currentExerciseIndex ?? 0) + 1, activePlan.exercises.length - 1), exerciseStartedAt: Date.now(), restUntil: null, restMode: "exercise" } : null);
  }

  async function finishWorkout() {
    if (!active || finishMutation.isPending) return;
    const sessionPlan = plans.find(item => item.id === active.dayType);
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

  async function savePlan(next: Exercise[]) {
    if (!plan) return;
    try {
      await savePlanMutation.mutateAsync({ planId: plan.id, name: nameDraft.trim() || plan.name, exercises: next });
      setEditId(null);
    } catch (reason) { onError((reason as Error).message); }
  }

  async function saveWeek() {
    try {
      await saveWeekMutation.mutateAsync(weekDraft);
      setEditingWeek(false);
    } catch (reason) { onError((reason as Error).message); }
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const planId = `day-${crypto.randomUUID()}`;
    try {
      const created = await api<Plan>(`/workout-plans/${planId}`, { method: "PUT", body: JSON.stringify({ name, exercises: [] }) });
      queryClient.setQueryData<Plan[]>(["workout", "plans"], current => [...(current ?? []), created]);
      const nextWeek = week.map(day => day.key === selectedKey ? { ...day, planId } : day);
      await saveWeekMutation.mutateAsync(nextWeek);
      setSelectedKey(selectedKey);
      setNameDraft(name);
      setEditingPlan(true);
      setCreatingPlan(false);
    } catch (reason) { onError((reason as Error).message); }
  }

  async function deletePlan() {
    if (!plan || !confirm(`Delete “${plan.name}” and remove it from the weekly schedule?`)) return;
    try {
      await api(`/workout-plans/${encodeURIComponent(plan.id)}`, { method: "DELETE" });
      queryClient.setQueryData<Plan[]>(["workout", "plans"], current => (current ?? []).filter(item => item.id !== plan.id));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workout", "week"] }),
        queryClient.invalidateQueries({ queryKey: ["workout", "logs"] }),
      ]);
      setEditingPlan(false);
    } catch (reason) { onError((reason as Error).message); }
  }

  function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan) return;
    const form = new FormData(event.currentTarget);
    const exercise: Exercise = {
      id: editId && editId !== "new" ? editId : `custom-${crypto.randomUUID()}`, name: String(form.get("name") ?? "").trim(), muscle: String(form.get("muscle") ?? "").trim(),
      sets: Number(form.get("sets")), reps: Number(form.get("reps")), tempo: String(form.get("tempo") ?? "3-1-2"), rest: Number(form.get("rest")),
      cues: String(form.get("cues") ?? "").split("\n").map(line => line.trim()).filter(Boolean),
      description: String(form.get("description") ?? "").trim(),
      setList: String(form.get("setList") ?? "").split("\n").map(line => line.trim()).filter(Boolean).map((line, index) => { const [reps, weight] = line.split(/[×,]/).map(value => Number(value.trim())); return { id: editingExercise?.setList?.[index]?.id ?? `set-${index + 1}`, reps, weight }; }),
      steps: String(form.get("steps") ?? "").split("\n").map(line => line.trim()).filter(Boolean),
      videoUrl: String(form.get("videoUrl") ?? "").trim()
    };
    const next = editId && editId !== "new" ? plan.exercises.map(item => item.id === editId ? exercise : item) : [...plan.exercises, exercise];
    void savePlan(next);
  }

  function deleteExercise(exerciseId: string) {
    if (!plan) return;
    void savePlan(plan.exercises.filter(exercise => exercise.id !== exerciseId));
  }

  function addExerciseSet(exercise: Exercise) {
    const nextSets = [...(exercise.setList ?? Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }))), { id: `set-${crypto.randomUUID()}`, reps: exercise.reps, weight: 0 }];
    void savePlan(plan!.exercises.map(item => item.id === exercise.id ? { ...item, setList: nextSets, sets: nextSets.length } : item));
  }

  function removeExerciseSet(exercise: Exercise, setIndex: number) {
    const current = exercise.setList?.length ? exercise.setList : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 }));
    const nextSets = current.filter((_, index) => index !== setIndex);
    if (!nextSets.length) return;
    void savePlan(plan!.exercises.map(item => item.id === exercise.id ? { ...item, setList: nextSets, sets: nextSets.length } : item));
  }

  const editingExercise = plan?.exercises.find(exercise => exercise.id === editId);

  return <>
    <header><div><h1>Workout</h1><p>Build strength one controlled set at a time.</p></div><div className="workout-header-actions"><button type="button" className="workout-stats-link" onClick={() => navigate("/workout/stats")}><BarChart3 size={16} /> Stats</button><div className="workout-head-meta"><Dumbbell size={18} /><span>Dumbbells</span></div></div></header>
    <div className="week-strip" aria-label="Your weekly training plan">
      {week.map(day => <button type="button" key={day.key} className={selectedKey === day.key ? "selected" : ""} onClick={() => setSelectedKey(day.key)}>
        <span>{day.label.slice(0, 3)}</span><b>{day.planId ? plans.find(item => item.id === day.planId)?.name ?? "Workout" : "Rest"}</b>
        {day.planId && logs.some(log => log.date === ironToday() && log.dayType === day.planId) && <i aria-label="Completed" />}
      </button>)}
    </div>
    <div className="workout-program-actions"><button type="button" className="text-button" onClick={() => { setWeekDraft(week); setEditingWeek(value => !value); }}>Edit weekly schedule</button><button type="button" className="text-button" onClick={() => setCreatingPlan(true)}>+ Create workout day</button></div>
    {creatingPlan && <section className="workout-schedule-editor"><form onSubmit={createPlan}><label>Workout day name<input name="name" required maxLength={80} autoFocus placeholder="e.g. Upper body strength" /></label><div className="schedule-editor-actions"><button type="button" className="text-button" onClick={() => setCreatingPlan(false)}>Cancel</button><button type="submit" className="start-workout">Create workout day</button></div></form></section>}
    {editingWeek && <section className="workout-schedule-editor" aria-label="Edit weekly schedule">
      <div className="schedule-editor-heading"><div><h2>Set your training week</h2><p>Choose a workout for each weekday. Leave a day at Rest when you want recovery.</p></div></div>
      <div className="schedule-day-list">{weekDraft.map(day => <label key={day.key}><span>{day.label}</span><select aria-label={`${day.label} workout`} value={day.planId ?? ""} onChange={event => setWeekDraft(current => current.map(item => item.key === day.key ? { ...item, planId: event.target.value || null } : item))}><option value="">Rest day</option>{plans.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>)}</div>
      <div className="schedule-editor-actions"><button type="button" className="text-button" onClick={() => setEditingWeek(false)}>Cancel</button><button type="button" className="start-workout" disabled={saveWeekMutation.isPending} onClick={() => void saveWeek()}>{saveWeekMutation.isPending ? "Saving…" : "Save weekly schedule"}</button></div>
    </section>}
    {active ? <section className="active-workout">
      <div className="active-workout-top"><div><span className={`live-dot ${active.pausedAt ? "paused" : ""}`} /> {active.pausedAt ? "Paused" : "In progress"}</div><strong><Clock3 size={16} /> {elapsedText(elapsed)}</strong><div className="workout-session-controls"><button type="button" className="session-control" onClick={togglePause}>{active.pausedAt ? <Play size={15} /> : <Pause size={15} />}{active.pausedAt ? "Resume" : "Pause"}</button><button type="button" className="session-control session-stop" onClick={stopWorkout}><X size={15} /> End</button></div></div>
      <h2>{active.dayName}</h2>
      <p>{completedSets} sets logged. Record each set as you go.</p>
      <div className="session-progress"><button type="button" aria-label="End workout" onClick={stopWorkout}><ChevronLeft size={18} /></button><div><i style={{ width: `${sessionTotalSets ? completedSets / sessionTotalSets * 100 : 0}%` }} /></div><span>{currentExercise ? currentExerciseIndex + 1 : activePlan?.exercises.length ?? 0}/{activePlan?.exercises.length ?? 0}</span></div>
      <div className="exercise-pills" aria-label="Workout exercises">{activePlan?.exercises.map((exercise, index) => { const complete = (active.entries[exercise.id] ?? []).every(entry => entry.completed); return <button type="button" key={exercise.id} className={`${index === currentExerciseIndex ? "current" : ""} ${complete ? "complete" : ""}`} onClick={() => setActive(current => current ? { ...current, currentExerciseIndex: index, exerciseStartedAt: Date.now() } : null)} aria-label={`Go to exercise ${index + 1}: ${exercise.name}`}>{index + 1}</button>; })}</div>
      <div className="session-clock-row"><span><Clock3 size={14} /> Workout <b>{elapsedText(elapsed)}</b></span><span><TimerReset size={14} /> Exercise <b>{elapsedText(exerciseElapsed)}</b></span></div>
      {restSeconds > 0 && <div className="session-countdown"><div className="countdown-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" /><circle cx="50" cy="50" r="44" style={{ strokeDasharray: 276.46, strokeDashoffset: 276.46 * (1 - restSeconds / Math.max(1, restTotal)) }} /></svg><b>{restSeconds}</b><small>sec</small></div><p>{active.pausedAt ? "Timer paused" : active.restMode === "exercise" ? "Rest between exercises" : active.restMode === "rep" ? "Rep tempo timer" : "Rest between sets"}</p>{!active.pausedAt && <button type="button" onClick={() => setActive(current => current ? { ...current, restUntil: null } : null)}>Skip timer</button>}</div>}
      {!activePlan ? <p className="empty-workouts">Loading workout plan…</p> : completedSets >= sessionTotalSets ? <section className="session-done"><span>🏆</span><h2>Workout Complete!</h2><div><article><b>{completedSets}</b><small>Sets</small></article><article><b>{elapsedText(elapsed)}</b><small>Duration</small></article><article><b>{activePlan.exercises.length}</b><small>Exercises</small></article><article><b>{activePlan.exercises.reduce((sum, exercise) => sum + (active.entries[exercise.id] ?? []).reduce((total, set) => total + set.reps * set.weight, 0), 0).toLocaleString()} kg</b><small>Volume</small></article></div><button type="button" className="finish-workout" disabled={finishMutation.isPending || Boolean(active.pausedAt)} onClick={() => void finishWorkout()}><Square size={15} />{finishMutation.isPending ? "Saving workout…" : "Save workout and return"}</button></section> : currentExercise ? <article className="session-exercise session-current-exercise">
        <div className="session-exercise-title"><div><p className="session-muscle">{currentExercise.muscle}</p><h3>{currentExercise.name}</h3></div><strong>{(active.entries[currentExercise.id] ?? []).filter(entry => entry.completed).length + 1}<small>/{currentExercise.sets} set</small></strong></div>
        {currentExercise.description && <p className="exercise-cue">{currentExercise.description}</p>}
        <div className="session-rep-grid"><div><b>{currentExercise.reps}</b><small>reps</small></div><div><b>{currentExercise.tempo}</b><small>tempo</small></div><div><b>{currentExercise.rest || 60}s</b><small>rest</small></div></div>
        {currentExercise.cues.length > 0 && <div className="session-cues"><b>Cues</b>{currentExercise.cues.map((cue, index) => <p key={index}><ChevronRight size={13} />{cue}</p>)}</div>}
        <div className="session-exercises"><div className="set-head"><span>Set</span><span>Reps</span><span>Load</span><span /></div>
        {(active.entries[currentExercise.id] ?? []).map((entry, index) => <div className={`set-row ${entry.completed ? "set-done" : ""}`} key={`${currentExercise.id}-${index}`}>
          <span className="set-number">{index + 1}</span><input type="number" min="0" max="1000" value={entry.reps} disabled={entry.completed || Boolean(active.pausedAt)} aria-label={`${currentExercise.name} set ${index + 1} reps`} onChange={event => editSet(currentExercise.id, index, "reps", Number(event.target.value))} /><input type="number" min="0" step="0.5" max="10000" value={entry.weight || ""} placeholder="0" disabled={entry.completed || Boolean(active.pausedAt)} aria-label={`${currentExercise.name} set ${index + 1} weight`} onChange={event => editSet(currentExercise.id, index, "weight", Number(event.target.value))} /><span>{entry.completed && <Check size={15} />}</span>
        </div>)}</div>
        <button type="button" className="finish-workout" disabled={!((active.entries[currentExercise.id] ?? []).some(entry => !entry.completed)) || restSeconds > 0 || Boolean(active.pausedAt)} onClick={() => completeSet(currentExercise, (active.entries[currentExercise.id] ?? []).findIndex(entry => !entry.completed))}><Check size={16} /> Done — Set {(active.entries[currentExercise.id] ?? []).filter(entry => entry.completed).length + 1} of {currentExercise.sets}</button>
        <div className="session-bottom-actions"><button type="button" disabled={Boolean(active.pausedAt)} onClick={() => startRepTimer(currentExercise)}><TimerReset size={14} /> Rep Timer</button><button type="button" onClick={skipExercise}><ChevronRight size={14} /> Skip Exercise</button></div>
      </article> : null}
    </section> : <>
    {!loaded ? <section className="rest-day"><h2>Loading your training plan</h2></section> : !selected?.planId ? <section className="rest-day"><div className="rest-mark"><RotateCcw /></div><h2>{plans.length ? "Recovery day" : "Start with your own workout"}</h2><p>{plans.length ? "This day is set aside for rest. Assign a workout day here whenever your schedule changes." : "Create a workout day, add your exercises, then choose which days you want to train."}</p>{!plans.length && <button type="button" className="start-workout" onClick={() => setCreatingPlan(true)}>Create your first workout day</button>}</section> : !plan ? <section className="rest-day"><h2>Workout day unavailable</h2><p>This schedule entry no longer has a saved plan. Edit your weekly schedule to choose another workout or rest day.</p></section> : <>
        <section className="workout-overview"><div className="overview-copy"><span className="program-label">{selected.label}</span>{editingPlan ? <label className="workout-name-field">Workout day name<input aria-label="Workout day name" maxLength={80} value={nameDraft} onChange={event => setNameDraft(event.target.value)} /></label> : <h2>{plan.name}</h2>}<p>{plan.exercises.length} exercises · {totalSets} working sets · Dumbbells</p></div><div className="overview-action">{done ? <span className="workout-complete"><Check size={16} /> Completed today</span> : <button type="button" className="start-workout" disabled={!plan.exercises.length} onClick={startWorkout}><Play size={16} fill="currentColor" /> Start workout</button>}</div></section>
        <div className="workout-section-title"><div><h2>Exercises in this workout</h2><p>Adjust sets, reps, rest, and coaching cues to fit your plan.</p></div>{!done && <button type="button" className="text-button" onClick={() => { setEditingPlan(value => !value); setNameDraft(plan.name); setEditId(null); }}>{editingPlan ? "Done editing" : "Edit plan"}</button>}</div>
        {plan.exercises.length ? <div className="exercise-list">{plan.exercises.map((exercise, index) => { const setList: NonNullable<Exercise["setList"]> = exercise.setList?.length ? exercise.setList : Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: 0 })); const volume = setList.reduce((sum, set) => sum + set.reps * set.weight, 0); return <article className={`exercise-card ${done ? "exercise-locked" : ""}`} key={exercise.id}><div className="exercise-index">{String(index + 1).padStart(2, "0")}</div><div className="exercise-main"><div className="exercise-card-heading"><h3>{exercise.name}</h3>{editingPlan && !done && <div><button type="button" className="text-button" onClick={() => setEditId(exercise.id)}>Edit</button><button type="button" className="text-button danger-text" onClick={() => deleteExercise(exercise.id)}>Remove</button></div>}</div><p>{exercise.muscle} · {volume.toLocaleString()} kg vol</p><div className="exercise-stats"><span><b>{exercise.sets}</b> sets</span><span><b>{exercise.reps}</b> reps</span><span><b>{exercise.rest}</b> sec rest</span><span><b>{exercise.tempo}</b> tempo</span></div>{exercise.description && <p className="exercise-description">{exercise.description}</p>}<div className="exercise-plan-sets"><b>Set</b><b>Reps × Weight</b>{setList.map((set, setIndex) => <Fragment key={set.id ?? setIndex}><span>{setIndex + 1}</span><span>{set.reps} reps × {set.weight}kg {editingPlan && !done && <button type="button" className="text-button set-edit-button" onClick={() => setEditId(exercise.id)}>Edit</button>}{editingPlan && !done && setList.length > 1 && <button type="button" className="text-button danger-text set-edit-button" onClick={() => removeExerciseSet(exercise, setIndex)}>Remove</button>}</span></Fragment>)}</div>{editingPlan && !done && <button type="button" className="add-plan-set" onClick={() => addExerciseSet(exercise)}>＋ Add set</button>}{exercise.steps?.length ? <ol className="exercise-steps">{exercise.steps.map((step, stepIndex) => <li key={stepIndex}><span>{stepIndex + 1}</span>{step}</li>)}</ol> : exercise.cues[0] && <small>{exercise.cues[0]}</small>}{exercise.videoUrl && <a className="exercise-video" href={exercise.videoUrl} target="_blank" rel="noreferrer">↗ Watch demo</a>}</div></article>; })}</div> : <section className="workout-empty"><p>No exercises yet. Add your first movement to this day.</p>{!done && <button type="button" onClick={() => { setEditingPlan(true); setEditId("new"); }}>＋ Add exercise</button>}</section>}
        {editingPlan && !done && <><button type="button" className="add-exercise" onClick={() => setEditId("new")}><span>+</span> Add exercise</button><div className="workout-plan-actions"><button type="button" className="start-workout" disabled={savePlanMutation.isPending} onClick={() => void savePlan(plan.exercises)}>{savePlanMutation.isPending ? "Saving…" : "Save workout day"}</button><button type="button" className="text-button danger-text" onClick={() => void deletePlan()}>Delete workout day</button></div></>}
        {done && <section className="session-receipt"><div><Check size={17} /><b>Workout complete</b></div><span>{done.totalSets} sets · {Math.round(done.duration / 60)} min · {Math.round(done.totalVolume).toLocaleString()} kg total volume</span></section>}
      </>}
      <section className="recent-workouts"><div className="workout-section-title"><div><h2>Recent sessions</h2><p>Your latest logged training days.</p></div></div>{logs.length ? logs.slice(0, 5).map(log => <div className="recent-row" key={log._id}><span className="recent-date">{new Date(`${log.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><b>{log.dayName || legacyDayLabels[log.dayType] || plans.find(item => item.id === log.dayType)?.name || "Workout day"}</b><span>{log.totalSets} sets</span><span>{Math.round(log.duration / 60)} min</span></div>) : <p className="empty-workouts">Finish your first session to start building a training history.</p>}</section>
    </>}
    {editId && <div className="modal"><form onSubmit={saveExercise}><header><h2>{editId === "new" ? "Add exercise" : "Edit exercise"}</h2><button type="button" onClick={() => setEditId(null)} aria-label="Close">×</button></header><label>Name<input name="name" required defaultValue={editingExercise?.name ?? ""} /></label><div className="form-grid"><label>Muscle group<input name="muscle" required defaultValue={editingExercise?.muscle ?? ""} /></label><label>Sets<input name="sets" type="number" min="1" max="20" defaultValue={editingExercise?.sets ?? 3} /></label><label>Reps<input name="reps" type="number" min="1" max="100" defaultValue={editingExercise?.reps ?? 10} /></label><label>Rest seconds<input name="rest" type="number" min="0" max="600" defaultValue={editingExercise?.rest ?? 60} /></label><label>Tempo<input name="tempo" defaultValue={editingExercise?.tempo ?? "3-1-2"} /></label></div><label>Description<textarea name="description" maxLength={4000} defaultValue={editingExercise?.description ?? ""} placeholder="What this exercise focuses on" /></label><label>Set targets<textarea name="setList" defaultValue={(editingExercise?.setList?.length ? editingExercise.setList : Array.from({ length: editingExercise?.sets ?? 3 }, () => ({ reps: editingExercise?.reps ?? 10, weight: 0 }))).map(set => `${set.reps}, ${set.weight}`).join("\n")} placeholder="One set per line: reps, weight in kg" /></label><label>Step-by-step instructions<textarea name="steps" defaultValue={editingExercise?.steps?.join("\n") ?? ""} placeholder="One instruction per line" /></label><label>Form cues<textarea name="cues" defaultValue={editingExercise?.cues.join("\n") ?? ""} placeholder="One cue per line" /></label><label>Demo video URL<input name="videoUrl" type="url" maxLength={2048} defaultValue={editingExercise?.videoUrl ?? ""} placeholder="https://…" /></label><button className="primary">Save exercise</button></form></div>}
  </>;
}
