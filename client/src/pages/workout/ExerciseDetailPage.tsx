import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Dumbbell, Trophy } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../lib/api/api";

type Session = { _id: string; date: string; exercises: { exerciseId: string; name: string; muscle: string; sets: { reps: number; weight: number }[] }[] };

export default function ExerciseDetailPage({ onError }: { onError: (message: string) => void }) {
  const { exerciseId = "" } = useParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["workout", "logs", 200], queryFn: () => api<Session[]>("/workout-logs?limit=200") });
  useEffect(() => { if (query.error) onError(query.error.message); }, [query.error, onError]);
  const sessions = useMemo(() => (query.data ?? []).flatMap(session => {
    const exercise = session.exercises.find(item => item.exerciseId === exerciseId || item.name === exerciseId);
    return exercise ? [{ ...session, exercise }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date)), [query.data, exerciseId]);
  const sets = sessions.flatMap(session => session.exercise.sets.map(set => ({ ...set, date: session.date, sessionId: session._id })));
  const bestWeight = Math.max(0, ...sets.map(set => set.weight));
  const bestVolume = Math.max(0, ...sets.map(set => set.weight * set.reps));
  const bestOneRm = Math.max(0, ...sets.map(set => set.weight > 0 ? set.weight * (1 + set.reps / 30) : 0));
  const chart = sessions.map(session => ({ date: session.date, label: new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }), weight: Math.max(0, ...session.exercise.sets.map(set => set.weight)), volume: session.exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0) }));
  const name = sessions.at(-1)?.exercise.name ?? exerciseId;
  const muscle = sessions.at(-1)?.exercise.muscle;

  return <>
    <header><div><button type="button" className="text-button detail-back" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button><h1>{name}</h1><p>{muscle || "Exercise history"} · {sessions.length} logged sessions</p></div></header>
    {query.isPending ? <section className="empty-workouts">Loading exercise history…</section> : !sessions.length ? <section className="stats-empty"><Dumbbell /><h2>No history for this exercise yet</h2><p>Log this exercise in a workout to build its progress chart and personal records.</p><button className="primary" type="button" onClick={() => navigate("/workout")}>Go to workout</button></section> : <>
      <div className="workout-stats-metrics"><Stat icon={<Trophy />} value={bestWeight ? `${bestWeight} kg` : "—"} label="Best load" /><Stat icon={<Dumbbell />} value={`${Math.round(bestVolume).toLocaleString()} kg`} label="Best set volume" /><Stat icon={<Trophy />} value={bestOneRm ? `${bestOneRm.toFixed(1)} kg` : "—"} label="Estimated 1RM" /><Stat icon={<Dumbbell />} value={sets.length} label="Logged sets" /></div>
      <section className="chart-card"><div className="section-heading"><h2>Load progression</h2><span>Top set each session</span></div><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 14, right: 12, bottom: 0, left: -15 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, color: "hsl(var(--foreground))" }} /><Line type="monotone" dataKey="weight" name="Top load (kg)" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} /></LineChart></ResponsiveContainer></div></section>
      <section className="chart-card"><div className="section-heading"><h2>Session sets</h2><span>Newest first</span></div><div className="workout-history-list">{[...sessions].reverse().map(session => <article className="workout-history-row" key={session._id}><div className="history-row-top"><b>{new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</b><span>{session.exercise.sets.length} sets</span></div><div className="exercise-set-history">{session.exercise.sets.map((set, index) => <span key={index}>Set {index + 1}<b>{set.weight} kg × {set.reps}</b></span>)}</div></article>)}</div></section>
    </>}
  </>;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) { return <div className="workout-stat"><span>{icon}</span><b>{value}</b><small>{label}</small></div>; }
