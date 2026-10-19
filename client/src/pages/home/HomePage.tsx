import { Activity, BarChart3, Bell, CalendarDays, CheckCircle2, ChevronRight, Dumbbell, Flame, Moon, Scale, Settings, Target, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api/api";
import type { Day, Weight } from "../../types";
import { ironToday } from "../../utils/date";

type DayType = "push" | "pull" | "legs" | "push_high" | "pull_high" | "legs_high";
type WeekDay = { key: string; label: string; dayType: DayType | null };
type WorkoutLog = { _id: string; date: string; dayType: DayType; totalSets: number; totalVolume: number; duration: number; exercises: unknown[] };
const labels: Record<DayType, string> = { push: "Push", pull: "Pull", legs: "Legs", push_high: "Push · high rep", pull_high: "Pull · high rep", legs_high: "Legs · high rep" };
const dayKey = (date: string) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${date}T12:00:00`).getDay()];
const greeting = () => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; };

export default function HomePage({ day, latest, userName = "", onRoutine }: { day: Day | null; latest: Weight | undefined; userName?: string; onRoutine: () => void }) {
  const navigate = useNavigate();
  const today = ironToday();
  const weekQuery = useQuery({ queryKey: ["workout", "week"], queryFn: () => api<WeekDay[]>("/workout-week") });
  const logsQuery = useQuery({ queryKey: ["workout", "logs", 30], queryFn: () => api<WorkoutLog[]>("/workout-logs?limit=30") });
  const week = weekQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const todayPlan = week.find(item => item.key === dayKey(today));
  const todayLog = logs.find(log => log.date === today && log.dayType === todayPlan?.dayType);
  const upcoming = useMemo(() => {
    for (let offset = 1; offset <= 7; offset++) {
      const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() + offset);
      const key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
      const found = week.find(item => item.key === key);
      if (found?.dayType) return found;
    }
    return undefined;
  }, [today, week]);
  const activeDays = new Set(logs.map(log => log.date));
  let streak = 0;
  for (let cursor = new Date(`${today}T12:00:00`); activeDays.has(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() - 1)) streak++;
  const weekStart = new Date(`${today}T12:00:00`); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekCount = logs.filter(log => { const date = new Date(`${log.date}T12:00:00`); return date >= weekStart && date <= new Date(`${today}T23:59:59`); }).length;
  const recent = logs.slice(0, 3);

  return <>
    <header className="home-header"><div><p>{greeting()}{userName ? `, ${userName}` : ""}</p><h1>Dumbbell Tracker</h1></div><button className="home-notification" type="button" aria-label="Open notifications" onClick={() => navigate("/wellness")}><Bell size={19} /></button></header>
    <button type="button" className="home-workout-hero" onClick={() => navigate("/workout")}>
      <div className="home-hero-top"><div><small>TODAY · {today}</small><h2>{todayPlan?.dayType ? labels[todayPlan.dayType] : "Recovery day"}</h2><p>{todayLog ? "Workout completed today" : todayPlan?.dayType ? `${todayPlan.label} · Tap to start` : "Active recovery & rest"}</p></div><span>{todayPlan?.dayType ? <Dumbbell /> : <Moon />}</span></div>
      <strong>{todayLog ? "View workout" : todayPlan?.dayType ? "Start workout" : "View recovery plan"}<ChevronRight size={17} /></strong>
    </button>
    <section className="home-stats-grid" aria-label="Training statistics">
      <article><span className="home-stat-icon flame"><Flame size={17} /></span><strong>{streak}d</strong><small>Streak</small></article>
      <article><span className="home-stat-icon weekly"><Target size={17} /></span><strong>{Math.min(100, Math.round(weekCount / 6 * 100))}%</strong><small>Weekly</small></article>
      <article><span className="home-stat-icon total"><TrendingUp size={17} /></span><strong>{logs.length}</strong><small>Total</small></article>
    </section>
    <section className="home-week"><h2><CalendarDays size={15} /> This week</h2><div>{week.map((item, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); const isoDate = date.toISOString().slice(0, 10); const completed = logs.some(log => log.date === isoDate && log.dayType === item.dayType); return <button type="button" key={item.key} className={`${item.key === dayKey(today) ? "today" : ""} ${completed ? "complete" : ""} ${item.dayType ? "" : "rest"}`} onClick={() => navigate("/workout")}><span>{item.label.slice(0, 3)}</span><b>{completed ? <CheckCircle2 size={14} /> : item.dayType ? labels[item.dayType].split(" · ")[0].slice(0, 1) : "·"}</b></button>; })}</div></section>
    <section className="home-recent"><h2><BarChart3 size={15} /> Recent sessions</h2>{recent.length ? recent.map(log => <article key={log._id}><i className={log.dayType.startsWith("push") ? "push" : log.dayType.startsWith("pull") ? "pull" : "legs"} /><div><b>{labels[log.dayType]}</b><small>{log.date} · {log.totalSets} sets · {log.exercises.length} exercises</small></div>{log.duration > 0 && <strong>{Math.round(log.duration / 60)}m</strong>}</article>) : <p>Complete your first workout to see your recent sessions here.</p>}</section>
    {todayPlan?.dayType === null && upcoming && <button type="button" className="home-next-workout" onClick={() => navigate("/workout")}><span><Dumbbell /></span><div><b>{labels[upcoming.dayType!]}</b><small>{upcoming.label} · Preview next workout</small></div><ChevronRight size={17} /></button>}
    <section className="home-routine-card"><div><small>TODAY’S ROUTINE</small><h2>{day?.progress.completed ?? 0} of {day?.progress.total ?? 0} tasks complete</h2><p>Move calmly from one prayer anchor to the next.</p></div><button type="button" onClick={onRoutine}>Open routine <ChevronRight size={15} /></button></section>
    <section className="home-quick-links"><button type="button" onClick={() => navigate("/analytics")}><span><Activity /></span><div><b>Analytics</b><small>View progress</small></div></button><button type="button" onClick={() => navigate("/settings")}><span><Settings /></span><div><b>Settings</b><small>Preferences</small></div></button><button type="button" onClick={() => navigate("/wellness")}><span><Bell /></span><div><b>Notifications</b><small>Reminders</small></div></button><button type="button" onClick={() => navigate("/weight")}><span><Scale /></span><div><b>Body weight</b><small>{latest ? `${latest.weight} ${latest.unit}` : "Track a weigh-in"}</small></div></button></section>
  </>;
}
