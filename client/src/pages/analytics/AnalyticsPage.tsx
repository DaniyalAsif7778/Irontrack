import { BarChart3, CheckCircle2, ClipboardList } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsData } from "../../types";
import { MetricCard } from "../../components/components";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api/api";
import { ironToday } from "../../utils/date";
import { useState } from "react";

type WorkoutReviewLog = { date: string; totalSets: number; totalVolume: number };
type EventReview = { counts: Record<string, { count: number; avgResponseMs: number | null }> };

export default function AnalyticsPage({ data, onRange }: { data: AnalyticsData | null; onRange: (days: number) => void }) {
  const activity = data?.activity ?? [];
  const trend = data?.weightTrend;
  const latestRate = activity.length ? activity[activity.length - 1].rate : 0;
  const chartColor = "hsl(var(--accent))";
  const axisColor = "hsl(var(--muted-foreground))";
  const workouts = useQuery({ queryKey: ["weekly-review", "workouts"], queryFn: () => api<WorkoutReviewLog[]>("/workout-logs?limit=200") });
  const events = useQuery({ queryKey: ["weekly-review", "events"], queryFn: () => api<EventReview>("/routine/events/analytics?days=7") });
  const wellness = useQuery({ queryKey: ["weekly-review", "wellness"], queryFn: () => api<Array<{ date: string; waterGlasses: number; movementBreaks: number }>>(`/wellness?days=7&through=${ironToday()}`) });
  const focusKey = "irontrack_weekly_focus_v1";
  const focusOptions = ["Keep one prayer block clear", "Plan fewer training days", "Protect time for recovery"];
  const [weeklyFocus, setWeeklyFocus] = useState(() => localStorage.getItem(focusKey) ?? "");
  const weekStartDate = new Date(`${ironToday()}T12:00:00`);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, "0")}-${String(weekStartDate.getDate()).padStart(2, "0")}`;
  const weekLogs = (workouts.data ?? []).filter(log => log.date >= weekStart && log.date <= ironToday());
  const wellnessDays = wellness.data ?? [];
  return <>
    <header><div><h1>Analytics</h1><p>Consistency over intensity.</p></div><div className="range">{[7, 14, 30].map(days => <button key={days} className={data?.days === days ? "selected" : ""} onClick={() => onRange(days)}>{days}D</button>)}</div></header>
    <div className="dashboard"><MetricCard icon={<CheckCircle2 />} value={data?.periodCompleted ?? 0} label="Period completions" /><MetricCard icon={<BarChart3 />} value={latestRate ? `${latestRate}%` : "—"} label="Today’s progress" /><MetricCard icon={<ClipboardList />} value={data?.totalCompleted ?? 0} label="All-time completions" /></div>
    <section className="chart-card"><div className="section-heading"><h2>Daily completion</h2><span>{data?.days ?? 7} days</span></div>{activity.length ? <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={activity} margin={{ top: 14, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="date" tickFormatter={date => format(parseISO(date), "MMM d")} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelFormatter={date => format(parseISO(String(date)), "EEEE, MMM d")} /><Bar dataKey="completed" name="Completed" fill={chartColor} radius={[4, 4, 0, 0]} maxBarSize={32} /></BarChart></ResponsiveContainer></div> : <p className="chart-empty">No routine activity in this period.</p>}</section>
    <section className="chart-card"><div className="section-heading"><h2>Weight trend</h2>{trend?.change !== null && trend?.change !== undefined && <span className={trend.change > 0 ? "change-up" : "change-down"}>{trend.change > 0 ? "+" : ""}{trend.change} {trend.latest?.unit}</span>}</div>{trend?.entries.length ? <div className="analytics-chart analytics-chart-short"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend.entries} margin={{ top: 16, right: 16, bottom: 0, left: -12 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="date" tickFormatter={date => format(parseISO(date), "MMM d")} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelFormatter={date => format(parseISO(String(date)), "EEEE, MMM d")} formatter={(value, _name, item) => [`${value} ${item.payload.unit}`, "Weight"]} /><Line type="monotone" dataKey="weight" name="Weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <p className="chart-empty">No weight logs in this period.</p>}</section>
    <section className="weekly-review" aria-labelledby="weekly-review-title"><div className="section-heading"><div><h2 id="weekly-review-title">Weekly review</h2><p>Review the last seven days and choose one focus for next week.</p></div><span>{workouts.isPending || events.isPending ? "Updating" : "Your data"}</span></div>
      <div className="weekly-review-stats"><article><strong>{data?.activity.slice(-7).reduce((sum, day) => sum + day.completed, 0) ?? 0}</strong><span>Routine completions</span></article><article><strong>{weekLogs.length}</strong><span>Workouts logged</span></article><article><strong>{weekLogs.reduce((sum, log) => sum + log.totalVolume, 0).toLocaleString()}</strong><span>Training volume</span></article><article><strong>{events.data?.counts.task_snoozed?.count ?? 0}</strong><span>Tasks delayed</span></article><article><strong>{wellnessDays.filter(day => day.waterGlasses > 0 || day.movementBreaks > 0).length}</strong><span>Wellness check-ins</span></article></div>
      <div className="weekly-review-focus"><div><b>Choose one focus</b><small>This saves your selection on this device; it won’t change your routine automatically.</small></div><div className="weekly-review-options">{focusOptions.map(option => <button key={option} type="button" aria-pressed={weeklyFocus === option} onClick={() => { setWeeklyFocus(option); localStorage.setItem(focusKey, option); }}>{option}</button>)}</div></div>
      <div className="weekly-review-links"><Link to="/routine">Review this week’s routine</Link><Link to="/schedules">Adjust a schedule</Link></div>
    </section>
  </>;
}
