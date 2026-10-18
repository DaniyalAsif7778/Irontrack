import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3, Dumbbell, Pause, Play, RotateCcw, Square, TimerReset, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/api";
import { ironToday } from "../../utils/date";

type DayType = "push" | "pull" | "legs" | "push_high" | "pull_high" | "legs_high";
type Exercise = { id: string; name: string; sets: number; reps: number; muscle: string; tempo: string; rest: number; cues: string[] };
type Plan = { dayType: DayType; exercises: Exercise[] };
type WorkoutLog = { _id: string; date: string; dayType: DayType; exercises: { exerciseId: string; name: string; muscle: string; sets: { reps: number; weight: number }[] }[]; totalSets: number; totalVolume: number; duration: number };
type WeekDay = { key: string; label: string; dayType: DayType | null };
type SetEntry = { reps: number; weight: number; completed: boolean };
type ActiveWorkout = { date: string; dayType: DayType; startedAt: number; elapsedBeforePause: number; pausedAt: number | null; pausedRestSeconds: number | null; entries: Record<string, SetEntry[]>; restUntil: number | null };

const activeKey = "irontrack_active_workout_v1";
const dayLabels: Record<DayType, string> = { push: "Push", pull: "Pull", legs: "Legs", push_high: "Push · high rep", pull_high: "Pull · high rep", legs_high: "Legs · high rep" };
const readActive = (): ActiveWorkout | null => {
  try { const value = localStorage.getItem(activeKey); if (!value) return null; const parsed = JSON.parse(value) as Partial<ActiveWorkout> & Pick<ActiveWorkout, "date" | "dayType" | "startedAt" | "entries">; return { ...parsed, elapsedBeforePause: parsed.elapsedBeforePause ?? 0, pausedAt: parsed.pausedAt ?? null, pausedRestSeconds: parsed.pausedRestSeconds ?? null, restUntil: parsed.restUntil ?? null } as ActiveWorkout; } catch { return null; }
};
const todayWeekKey = () => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${ironToday()}T12:00:00`).getDay()];
const elapsedText = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function Workout({ onError }: { onError: (message: string) => void }) {
  const [selectedKey, setSelectedKey] = useState(todayWeekKey());
  const [active, setActive] = useState<ActiveWorkout | null>(readActive);
  const [now, setNow] = useState(Date.now());
  const [editingPlan, setEditingPlan] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const plansQuery = useQuery({ queryKey: ["workout", "plans"], queryFn: () => api<Plan[]>("/workout-plans") });
  const weekQuery = useQuery({ queryKey: ["workout", "week"], queryFn: () => api<WeekDay[]>("/workout-week") });
  const logsQuery = useQuery({ queryKey: ["workout", "logs", 30], queryFn: () => api<WorkoutLog[]>("/workout-logs?limit=30") });
  const plans = plansQuery.data ?? [];
  const week = weekQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const loaded = !plansQuery.isPending && !weekQuery.isPending && !logsQuery.isPending;
  const finishMutation = useMutation({
    mutationFn: (payload: { date: string; dayType: DayType; exercises: { exerciseId: string; name: string; muscle: string; sets: { reps: number; weight: number }[] }[]; duration: number }) => api("/workout-logs", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workout", "logs"] }),
      queryClient.invalidateQueries({ queryKey: ["workout", "week"] }),
    ]),
  });
  const savePlanMutation = useMutation({
    mutationFn: ({ dayType, exercises }: { dayType: DayType; exercises: Exercise[] }) => api<Plan>(`/workout-plans/${dayType}`, { method: "PUT", body: JSON.stringify({ exercises }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workout", "plans"] }),
  });
  useEffect(() => {
    const error = plansQuery.error ?? weekQuery.error ?? logsQuery.error;
    if (error) onError(error.message);
  }, [plansQuery.error, weekQuery.error, logsQuery.error, onError]);
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [active]);
  useEffect(() => { if (active) localStorage.setItem(activeKey, JSON.stringify(active)); else localStorage.removeItem(activeKey); }, [active]);

  const selected = week.find(day => day.key === selectedKey) ?? week.find(day => day.key === todayWeekKey());
  const plan = plans.find(item => item.dayType === selected?.dayType);
  const done = selected?.dayType ? logs.find(log => log.date === ironToday() && log.dayType === selected.dayType) : undefined;
  const elapsed = active ? active.elapsedBeforePause + (active.pausedAt ? 0 : Math.max(0, Math.floor((now - active.startedAt) / 1000))) : 0;
  const restSeconds = active?.pausedAt ? active.pausedRestSeconds ?? 0 : active?.restUntil ? Math.max(0, Math.ceil((active.restUntil - now) / 1000)) : 0;
  const totalSets = useMemo(() => plan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0, [plan]);
  const completedSets = active ? Object.values(active.entries).reduce((sum, entries) => sum + entries.filter(entry => entry.completed).length, 0) : 0;

  function startWorkout() {
    if (!selected?.dayType || !plan) return;
    const previous = [...logs].filter(log => log.dayType === selected.dayType).sort((a, b) => b.date.localeCompare(a.date))[0];
    const entries = Object.fromEntries(plan.exercises.map(exercise => {
      const previousSets = previous?.exercises.find(item => item.exerciseId === exercise.id)?.sets ?? [];
      const last = previousSets.at(-1);
      return [exercise.id, Array.from({ length: exercise.sets }, (_, index) => ({ reps: previousSets[index]?.reps ?? last?.reps ?? exercise.reps, weight: previousSets[index]?.weight ?? last?.weight ?? 0, completed: false }))];
    }));
    setActive({ date: ironToday(), dayType: selected.dayType, startedAt: Date.now(), elapsedBeforePause: 0, pausedAt: null, pausedRestSeconds: null, entries, restUntil: null });
  }

  function togglePause() {
    setActive(current => {
      if (!current) return null;
      if (current.pausedAt) return { ...current, startedAt: Date.now(), pausedAt: null, restUntil: current.pausedRestSeconds ? Date.now() + current.pausedRestSeconds * 1000 : null, pausedRestSeconds: null };
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
      return { ...current, entries, restUntil: moreSets ? Date.now() + exercise.rest * 1000 : null };
    });
  }

  async function finishWorkout() {
    if (!active || finishMutation.isPending) return;
    const sessionPlan = plans.find(item => item.dayType === active.dayType);
    if (!sessionPlan) return;
    const exercises = sessionPlan.exercises.map(exercise => ({
      exerciseId: exercise.id, name: exercise.name, muscle: exercise.muscle,
      sets: (active.entries[exercise.id] ?? []).filter(entry => entry.completed).map(({ reps, weight }) => ({ reps, weight }))
    })).filter(exercise => exercise.sets.length);
    try {
      await finishMutation.mutateAsync({ date: active.date, dayType: active.dayType, exercises, duration: elapsed });
      setActive(null);
    } catch (reason) { onError((reason as Error).message); }
  }

  async function savePlan(next: Exercise[]) {
    if (!selected?.dayType) return;
    try {
      await savePlanMutation.mutateAsync({ dayType: selected.dayType, exercises: next });
      setEditId(null);
    } catch (reason) { onError((reason as Error).message); }
  }

  function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plan) return;
    const form = new FormData(event.currentTarget);
    const exercise: Exercise = {
      id: editId && editId !== "new" ? editId : `custom-${crypto.randomUUID()}`, name: String(form.get("name") ?? "").trim(), muscle: String(form.get("muscle") ?? "").trim(),
      sets: Number(form.get("sets")), reps: Number(form.get("reps")), tempo: String(form.get("tempo") ?? "3-1-2"), rest: Number(form.get("rest")),
      cues: String(form.get("cues") ?? "").split("\n").map(line => line.trim()).filter(Boolean)
    };
    const next = editId && editId !== "new" ? plan.exercises.map(item => item.id === editId ? exercise : item) : [...plan.exercises, exercise];
    void savePlan(next);
  }

  function deleteExercise(exerciseId: string) {
    if (!plan) return;
    void savePlan(plan.exercises.filter(exercise => exercise.id !== exerciseId));
  }

  const editingExercise = plan?.exercises.find(exercise => exercise.id === editId);

  return <>
    <header><div><h1>Workout</h1><p>Build strength one controlled set at a time.</p></div><div className="workout-head-meta"><Dumbbell size={18} /><span>Dumbbells</span></div></header>
    <div className="week-strip" aria-label="Weekly training split">
      {week.map(day => <button type="button" key={day.key} className={selectedKey === day.key ? "selected" : ""} onClick={() => setSelectedKey(day.key)}>
        <span>{day.label.slice(0, 3)}</span><b>{day.dayType ? dayLabels[day.dayType].split(" · ")[0] : "Rest"}</b>
        {logs.some(log => log.date === ironToday() && log.dayType === day.dayType) && <i aria-label="Completed" />}
      </button>)}
    </div>
    {active ? <section className="active-workout">
      <div className="active-workout-top"><div><span className={`live-dot ${active.pausedAt ? "paused" : ""}`} /> {active.pausedAt ? "Paused" : "In progress"}</div><strong><Clock3 size={16} /> {elapsedText(elapsed)}</strong><div className="workout-session-controls"><button type="button" className="session-control" onClick={togglePause}>{active.pausedAt ? <Play size={15} /> : <Pause size={15} />}{active.pausedAt ? "Resume" : "Pause"}</button><button type="button" className="session-control session-stop" onClick={stopWorkout}><X size={15} /> End</button></div></div>
      <h2>{dayLabels[active.dayType]}</h2>
      <p>{completedSets} sets logged. Record each set as you go.</p>
      {restSeconds > 0 && <div className="rest-banner"><TimerReset size={18} /><span>{active.pausedAt ? "Rest paused" : "Rest between sets"}</span><b>{elapsedText(restSeconds)}</b>{!active.pausedAt && <button type="button" onClick={() => setActive(current => current ? { ...current, restUntil: null } : null)}>Skip</button>}</div>}
      <div className="session-exercises">{plans.find(item => item.dayType === active.dayType)?.exercises.map((exercise, index) => <article className="session-exercise" key={exercise.id}>
        <div className="session-exercise-title"><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{exercise.name}</h3><p>{exercise.muscle} · {exercise.tempo} tempo</p></div></div>
        {exercise.cues[0] && <p className="exercise-cue">{exercise.cues[0]}</p>}
        <div className="set-head"><span>Set</span><span>Reps</span><span>Load</span><span /></div>
        {(active.entries[exercise.id] ?? []).map((entry, index) => <div className={`set-row ${entry.completed ? "set-done" : ""}`} key={`${exercise.id}-${index}`}>
          <span className="set-number">{index + 1}</span><input type="number" min="0" max="1000" value={entry.reps} disabled={entry.completed || Boolean(active.pausedAt)} aria-label={`${exercise.name} set ${index + 1} reps`} onChange={event => editSet(exercise.id, index, "reps", Number(event.target.value))} /><input type="number" min="0" step="0.5" max="10000" value={entry.weight || ""} placeholder="0" disabled={entry.completed || Boolean(active.pausedAt)} aria-label={`${exercise.name} set ${index + 1} weight`} onChange={event => editSet(exercise.id, index, "weight", Number(event.target.value))} /><button type="button" aria-label={`Complete ${exercise.name} set ${index + 1}`} disabled={entry.completed || restSeconds > 0 || Boolean(active.pausedAt)} onClick={() => completeSet(exercise, index)}>{entry.completed ? <Check size={16} /> : "Done"}</button>
        </div>)}
      </article>)}</div>
      <button type="button" className="finish-workout" disabled={!completedSets || finishMutation.isPending || Boolean(active.pausedAt)} onClick={() => void finishWorkout()}><Square size={15} />{finishMutation.isPending ? "Saving workout…" : `Finish workout · ${completedSets}/${totalSets} sets`}</button>
    </section> : <>
    {!loaded ? <section className="rest-day"><h2>Loading your training plan</h2></section> : !week.length ? <section className="rest-day"><div className="rest-mark"><Dumbbell /></div><h2>Training plan unavailable</h2><p>Reconnect to the IronTrack server to load your plan and session history.</p></section> : !selected?.dayType ? <section className="rest-day"><div className="rest-mark"><RotateCcw /></div><h2>Rest day</h2><p>Recovery is part of the plan. Take today easy and come back ready tomorrow.</p></section> : <>
        <section className="workout-overview"><div className="overview-copy"><span className="program-label">{selected.label} program</span><h2>{dayLabels[selected.dayType]}</h2><p>{plan?.exercises.length ?? 0} exercises · {totalSets} working sets · Dumbbells</p></div><div className="overview-action">{done ? <span className="workout-complete"><Check size={16} /> Completed today</span> : <button type="button" className="start-workout" disabled={!plan?.exercises.length} onClick={startWorkout}><Play size={16} fill="currentColor" /> Start workout</button>}</div></section>
        <div className="workout-section-title"><div><h2>Training plan</h2><p>Move slowly through the lowering phase. Stop if you feel pain.</p></div><button type="button" className="text-button" onClick={() => { setEditingPlan(value => !value); setEditId(null); }}>{editingPlan ? "Done editing" : "Edit plan"}</button></div>
        <div className="exercise-list">{plan?.exercises.map((exercise, index) => <article className="exercise-card" key={exercise.id}><div className="exercise-index">{String(index + 1).padStart(2, "0")}</div><div className="exercise-main"><div className="exercise-card-heading"><h3>{exercise.name}</h3>{editingPlan && <div><button type="button" className="text-button" onClick={() => setEditId(exercise.id)}>Edit</button><button type="button" className="text-button danger-text" onClick={() => deleteExercise(exercise.id)}>Remove</button></div>}</div><p>{exercise.muscle}</p><div className="exercise-stats"><span><b>{exercise.sets}</b> sets</span><span><b>{exercise.reps}</b> reps</span><span><b>{exercise.rest}</b> sec rest</span><span><b>{exercise.tempo}</b> tempo</span></div>{exercise.cues[0] && <small>{exercise.cues[0]}</small>}</div></article>)}</div>
        {editingPlan && <button type="button" className="add-exercise" onClick={() => setEditId("new")}><span>+</span> Add exercise</button>}
        {done && <section className="session-receipt"><div><Check size={17} /><b>Workout complete</b></div><span>{done.totalSets} sets · {Math.round(done.duration / 60)} min · {Math.round(done.totalVolume).toLocaleString()} kg total volume</span></section>}
      </>}
      <section className="recent-workouts"><div className="workout-section-title"><div><h2>Recent sessions</h2><p>Your latest logged training days.</p></div></div>{logs.length ? logs.slice(0, 5).map(log => <div className="recent-row" key={log._id}><span className="recent-date">{new Date(`${log.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><b>{dayLabels[log.dayType]}</b><span>{log.totalSets} sets</span><span>{Math.round(log.duration / 60)} min</span></div>) : <p className="empty-workouts">Finish your first session to start building a training history.</p>}</section>
    </>}
    {editId && <div className="modal"><form onSubmit={saveExercise}><header><h2>{editId === "new" ? "Add exercise" : "Edit exercise"}</h2><button type="button" onClick={() => setEditId(null)} aria-label="Close">×</button></header><label>Name<input name="name" required defaultValue={editingExercise?.name ?? ""} /></label><div className="form-grid"><label>Muscle group<input name="muscle" required defaultValue={editingExercise?.muscle ?? ""} /></label><label>Sets<input name="sets" type="number" min="1" max="20" defaultValue={editingExercise?.sets ?? 3} /></label><label>Reps<input name="reps" type="number" min="1" max="100" defaultValue={editingExercise?.reps ?? 10} /></label><label>Rest seconds<input name="rest" type="number" min="0" max="600" defaultValue={editingExercise?.rest ?? 60} /></label><label>Tempo<input name="tempo" defaultValue={editingExercise?.tempo ?? "3-1-2"} /></label></div><label>Form cues<textarea name="cues" defaultValue={editingExercise?.cues.join("\n") ?? ""} placeholder="One cue per line" /></label><button className="primary">Save exercise</button></form></div>}
  </>;
}
