import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, CalendarDays, Clock3, Dumbbell, Flame, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../lib/api/api";
import { ironToday } from "../../utils/date";

type DayType = "push" | "pull" | "legs" | "push_high" | "pull_high" | "legs_high";
type SetLog = { reps: number; weight: number };
type ExerciseLog = { exerciseId: string; name: string; muscle: string; sets: SetLog[] };
type WorkoutLog = { _id: string; date: string; dayType: DayType; exercises: ExerciseLog[]; totalSets: number; totalVolume: number; duration: number };
type Tab = "summary" | "overview" | "volume" | "history" | "prs";

const labels: Record<DayType, string> = { push: "Push", pull: "Pull", legs: "Legs", push_high: "Push · high rep", pull_high: "Pull · high rep", legs_high: "Legs · high rep" };
const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}m`;
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function WorkoutStatsPage({ onError }: { onError: (message: string) => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("summary");
  const query = useQuery({ queryKey: ["workout", "logs", 200], queryFn: () => api<WorkoutLog[]>("/workout-logs?limit=200") });
  const logs = query.data ?? [];
  useEffect(() => { if (query.error) onError(query.error.message); }, [query.error, onError]);
  const ordered = useMemo(() => [...logs].sort((a, b) => a.date.localeCompare(b.date)), [logs]);
  const volumeData = useMemo(() => ordered.map(log => ({ date: log.date, label: dateLabel(log.date), volume: Math.round(log.totalVolume), duration: Math.round(log.duration / 60), cumulative: 0 })), [ordered]);
  volumeData.forEach((item, index) => { item.cumulative = (volumeData[index - 1]?.cumulative ?? 0) + item.volume; });
  const exercises = useMemo(() => {
    const items = new Map<string, { id: string; name: string; muscle: string; sessions: number; bestWeight: number; bestVolume: number; bestReps: number; estimatedOneRm: number; lastDate: string }>();
    for (const log of logs) for (const exercise of log.exercises) {
      const id = exercise.exerciseId || exercise.name;
      const current = items.get(id) ?? { id, name: exercise.name, muscle: exercise.muscle, sessions: 0, bestWeight: 0, bestVolume: 0, bestReps: 0, estimatedOneRm: 0, lastDate: log.date };
      current.sessions += 1;
      current.lastDate = current.lastDate > log.date ? current.lastDate : log.date;
      for (const set of exercise.sets) {
        current.bestWeight = Math.max(current.bestWeight, set.weight);
        current.bestVolume = Math.max(current.bestVolume, set.weight * set.reps);
        current.bestReps = Math.max(current.bestReps, set.reps);
        if (set.weight > 0) current.estimatedOneRm = Math.max(current.estimatedOneRm, set.weight * (1 + set.reps / 30));
      }
      items.set(id, current);
    }
    return [...items.values()].sort((a, b) => b.estimatedOneRm - a.estimatedOneRm || b.bestWeight - a.bestWeight);
  }, [logs]);
  const muscleData = useMemo(() => {
    const totals = new Map<string, number>();
    logs.forEach(log => log.exercises.forEach(exercise => totals.set(exercise.muscle || "Other", (totals.get(exercise.muscle || "Other") ?? 0) + exercise.sets.length)));
    return [...totals].map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets).slice(0, 5);
  }, [logs]);
  const byDate = new Map(logs.map(log => [log.date, log]));
  const today = new Date(`${ironToday()}T12:00:00`);
  const heatmap = Array.from({ length: 84 }, (_, index) => {
    const date = new Date(today); date.setDate(date.getDate() - (83 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, count: logs.filter(log => log.date === key).length };
  });
  const totalSets = logs.reduce((sum, log) => sum + log.totalSets, 0);
  const totalVolume = logs.reduce((sum, log) => sum + log.totalVolume, 0);
  const avgDuration = logs.length ? Math.round(logs.reduce((sum, log) => sum + log.duration, 0) / logs.length / 60) : 0;
  const chartStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--foreground))" };

  return <>
    <header><div><h1>Workout stats</h1><p>Training history, volume, and personal records.</p></div><button type="button" className="text-button" onClick={() => navigate("/workout")}>Back to workout</button></header>
    <nav className="workout-stats-tabs" aria-label="Workout statistics">{([ ["summary", "Summary"], ["overview", "Overview"], ["volume", "Volume"], ["history", "History"], ["prs", "PRs"] ] as [Tab, string][]).map(([key, label]) => <button type="button" key={key} className={tab === key ? "selected" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {query.isPending ? <section className="empty-workouts">Loading your training history…</section> : !logs.length ? <section className="stats-empty"><Dumbbell /><h2>Your stats start with your first session</h2><p>Complete a workout and its volume, history, and PRs will appear here.</p><button className="primary" type="button" onClick={() => navigate("/workout")}>Start a workout</button></section> : <>
      <div className="workout-stats-metrics"><Stat icon={<Activity />} value={logs.length} label="Workouts" /><Stat icon={<Dumbbell />} value={totalSets} label="Sets logged" /><Stat icon={<ArrowUpRight />} value={`${Math.round(totalVolume).toLocaleString()} kg`} label="Total volume" /><Stat icon={<Clock3 />} value={`${avgDuration} min`} label="Avg. duration" /></div>
      {tab === "summary" && <div className="stats-panels"><section className="chart-card"><div className="section-heading"><h2>Training volume</h2><span>Last {Math.min(14, logs.length)} sessions</span></div><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={volumeData.slice(-14)} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartStyle} /><Bar dataKey="volume" name="Volume (kg)" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="chart-card"><div className="section-heading"><h2>Recent sessions</h2><button type="button" className="text-button" onClick={() => setTab("history")}>View all</button></div><HistoryList logs={logs.slice(0, 5)} onExercise={id => navigate(`/exercise/${encodeURIComponent(id)}`)} /></section></div>}
      {tab === "overview" && <div className="stats-panels"><section className="chart-card"><div className="section-heading"><h2>12-week activity</h2><span>{logs.length} recorded sessions</span></div><div className="workout-heatmap" aria-label="Workout activity over the last 12 weeks">{heatmap.map(day => <span key={day.key} title={`${day.key}: ${day.count} workout${day.count === 1 ? "" : "s"}`} className={`heat-${Math.min(day.count, 3)}`} />)}</div><div className="heatmap-legend"><span>Less</span>{[0,1,2,3].map(level => <i key={level} className={`heat-${level}`} />)}<span>More</span></div></section><section className="chart-card"><div className="section-heading"><h2>Sets by muscle</h2><span>All sessions</span></div>{muscleData.length ? <div className="analytics-chart analytics-chart-short"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={muscleData} dataKey="sets" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3}>{muscleData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={chartStyle} /></PieChart></ResponsiveContainer></div> : null}<div className="muscle-legend">{muscleData.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}<b>{item.sets}</b></span>)}</div></section></div>}
      {tab === "volume" && <div className="stats-panels"><section className="chart-card"><div className="section-heading"><h2>Volume per session</h2><span>kg × reps</span></div><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={volumeData.slice(-30)} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartStyle} /><Bar dataKey="volume" name="Volume (kg)" fill="hsl(var(--accent))" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="chart-card"><div className="section-heading"><h2>Cumulative volume</h2><span>kg</span></div><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={volumeData.slice(-30)} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartStyle} /><Line type="monotone" dataKey="cumulative" name="Cumulative kg" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></section></div>}
      {tab === "history" && <section className="chart-card"><div className="section-heading"><h2>Session history</h2><span>Most recent first · up to 200 sessions</span></div><HistoryList logs={[...logs].sort((a, b) => b.date.localeCompare(a.date))} onExercise={id => navigate(`/exercise/${encodeURIComponent(id)}`)} /></section>}
      {tab === "prs" && <section className="chart-card"><div className="section-heading"><h2>Personal records</h2><span>From recorded sessions</span></div><div className="pr-list">{exercises.map((exercise, index) => <button type="button" className="pr-row" key={exercise.id} onClick={() => navigate(`/exercise/${encodeURIComponent(exercise.id)}`)}><span className="pr-rank">{index === 0 ? <Trophy /> : String(index + 1).padStart(2, "0")}</span><span className="pr-main"><b>{exercise.name}</b><small>{exercise.muscle || "Exercise"} · {exercise.sessions} sessions · last {dateLabel(exercise.lastDate)}</small></span><span className="pr-value"><b>{exercise.bestWeight ? `${exercise.bestWeight} kg` : `${exercise.bestReps} reps`}</b><small>{exercise.estimatedOneRm ? `e1RM ${exercise.estimatedOneRm.toFixed(1)} kg` : `${Math.round(exercise.bestVolume)} kg·reps`}</small></span><ArrowUpRight size={16} /></button>)}</div></section>}
    </>}
  </>;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) { return <div className="workout-stat"><span>{icon}</span><b>{value}</b><small>{label}</small></div>; }

function HistoryList({ logs, onExercise }: { logs: WorkoutLog[]; onExercise: (id: string) => void }) {
  return <div className="workout-history-list">{logs.map(log => <article className="workout-history-row" key={log._id}><div className="history-row-top"><span>{dateLabel(log.date)}</span><b>{labels[log.dayType]}</b><span>{formatDuration(log.duration)}</span></div><div className="history-row-meta"><span>{log.totalSets} sets</span><span>{Math.round(log.totalVolume).toLocaleString()} kg volume</span></div><div className="history-exercises">{log.exercises.map(exercise => <button type="button" key={exercise.exerciseId || exercise.name} onClick={() => onExercise(exercise.exerciseId || exercise.name)}>{exercise.name}</button>)}</div></article>)}</div>;
}
