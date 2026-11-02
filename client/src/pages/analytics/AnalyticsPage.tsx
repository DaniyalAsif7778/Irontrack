import { BarChart3, CheckCircle2, ClipboardList } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsData, AnalyticsPeriod } from "../../types";
import { MetricCard } from "../../components/components";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api/api";
import { ironToday } from "../../utils/date";
import { useEffect, useState } from "react";
import { queryKeys } from "../../hooks/queryKeys";

type WorkoutReviewLog = { date: string; totalSets: number; totalVolume: number };
type EventReview = { counts: Record<string, { count: number; avgResponseMs: number | null }> };

function savedFocus(key: string) {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

const periodOptions: [AnalyticsPeriod, string][] = [["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"], ["this-month", "This month"], ["previous-month", "Previous month"], ["3m", "Last 3 months"], ["6m", "Last 6 months"], ["1y", "Last 12 months"], ["2y", "Last 2 years"], ["3y", "Last 3 years"]];

export default function AnalyticsPage({ data, period, onRange, accountId }: { data: AnalyticsData | null; period: AnalyticsPeriod; onRange: (period: AnalyticsPeriod) => void; accountId?: string }) {
  const activity = data?.activity ?? [];
  const trend = data?.weightTrend;
  const latestRate = activity.length ? activity[activity.length - 1].rate : 0;
  const chartColor = "hsl(var(--accent))";
  const axisColor = "hsl(var(--muted-foreground))";
  const workouts = useQuery({ queryKey: ["weekly-review", "workouts"], queryFn: () => api<WorkoutReviewLog[]>("/workout-logs?limit=200") });
  const events = useQuery({ queryKey: ["weekly-review", "events", "7d", ironToday()], queryFn: () => api<EventReview>(`/routine/events/analytics?period=7d&page=1`) });
  const wellness = useQuery({ queryKey: ["weekly-review", "wellness"], queryFn: () => api<Array<{ date: string; waterGlasses: number; movementBreaks: number }>>(`/wellness?days=7&through=${ironToday()}`) });
  const weeklyRoutine = useQuery({ queryKey: [...queryKeys.analytics, "7d", ironToday()], queryFn: () => api<AnalyticsData>(`/analytics?period=7d&today=${ironToday()}`), staleTime: 5 * 60_000, gcTime: 30 * 60_000 });
  const focusKey = `irontrack_weekly_focus_v1:${accountId ?? "local"}`;
  const focusOptions = ["Keep one prayer block clear", "Plan fewer training days", "Protect time for recovery"];
  const [weeklyFocus, setWeeklyFocus] = useState(() => savedFocus(focusKey));
  useEffect(() => {
    setWeeklyFocus(savedFocus(focusKey));
  }, [focusKey]);
  const weekStartDate = new Date(`${ironToday()}T12:00:00`);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStart = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, "0")}-${String(weekStartDate.getDate()).padStart(2, "0")}`;
  const weekLogs = (workouts.data ?? []).filter(log => log.date >= weekStart && log.date <= ironToday());
  const wellnessDays = wellness.data ?? [];
  const reviewLoading = workouts.isPending || events.isPending || wellness.isPending || weeklyRoutine.isPending;
  const reviewHasError = workouts.isError || events.isError || wellness.isError || weeklyRoutine.isError;
  const reloadWeeklyReview = () => { void Promise.all([workouts.refetch(), events.refetch(), wellness.refetch(), weeklyRoutine.refetch()]); };
  return <>
    <header><div><h1>Analytics</h1><p>Consistency over intensity.</p></div><label className="analytics-period-picker">Show period<select aria-label="Analytics period" value={period} onChange={event => onRange(event.target.value as AnalyticsPeriod)}>{periodOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></header>
    <div className="dashboard"><MetricCard icon={<CheckCircle2 />} value={data?.periodCompleted ?? 0} label="Period completions" /><MetricCard icon={<BarChart3 />} value={latestRate ? `${latestRate}%` : "—"} label="Today’s progress" /><MetricCard icon={<ClipboardList />} value={data?.totalCompleted ?? 0} label="All-time completions" /></div>
    <section className="chart-card"><div className="section-heading"><h2>Routine completion</h2><span>{data?.periodLabel ?? periodOptions.find(([value]) => value === period)?.[1]}</span></div>{activity.length ? <><div className="analytics-chart" role="img" aria-label={`${data?.granularity === "month" ? "Monthly" : "Daily"} chart showing ${activity.reduce((sum, point) => sum + point.completed, 0)} completed routine tasks across ${activity.length} ${data?.granularity === "month" ? "months" : "days"}.`}><ResponsiveContainer width="100%" height="100%"><BarChart data={activity} margin={{ top: 14, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="date" tickFormatter={date => format(parseISO(date), data?.granularity === "month" ? "MMM yy" : "MMM d")} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelFormatter={date => format(parseISO(String(date)), data?.granularity === "month" ? "MMMM yyyy" : "EEEE, MMM d")} /><Bar dataKey="completed" name="Completed" fill={chartColor} radius={[4, 4, 0, 0]} maxBarSize={32} /></BarChart></ResponsiveContainer></div><details className="chart-data"><summary>View {data?.granularity === "month" ? "monthly" : "daily"} completion data</summary><table><caption>Completed routine tasks by {data?.granularity === "month" ? "month" : "day"}</caption><thead><tr><th scope="col">{data?.granularity === "month" ? "Month" : "Date"}</th><th scope="col">Completed</th><th scope="col">Planned</th></tr></thead><tbody>{activity.map(point => <tr key={point.date}><th scope="row">{format(parseISO(point.date), data?.granularity === "month" ? "MMMM yyyy" : "MMM d, yyyy")}</th><td>{point.completed}</td><td>{point.total}</td></tr>)}</tbody></table></details></> : <p className="chart-empty">No routine activity in this period.</p>}</section>
    <section className="chart-card"><div className="section-heading"><h2>Weight trend</h2>{trend?.change !== null && trend?.change !== undefined && <span className={trend.change > 0 ? "change-up" : "change-down"}>{trend.change > 0 ? "+" : ""}{trend.change} {trend.latest?.unit}</span>}</div>{trend?.entries.length ? <><div className="analytics-chart analytics-chart-short" role="img" aria-label={`Line chart showing ${trend.entries.length} weight ${trend.entries.length === 1 ? "entry" : "entries"}, from ${trend.entries[0].weight} to ${trend.entries[trend.entries.length - 1].weight} ${trend.entries[trend.entries.length - 1].unit}.`}><ResponsiveContainer width="100%" height="100%"><LineChart data={trend.entries} margin={{ top: 16, right: 16, bottom: 0, left: -12 }}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="date" tickFormatter={date => format(parseISO(date), "MMM d")} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelFormatter={date => format(parseISO(String(date)), "EEEE, MMM d")} formatter={(value, _name, item) => [`${value} ${item.payload.unit}`, "Weight"]} /><Line type="monotone" dataKey="weight" name="Weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div><details className="chart-data"><summary>View weight entries</summary><table><caption>Weight by date</caption><thead><tr><th scope="col">Date</th><th scope="col">Weight</th></tr></thead><tbody>{trend.entries.map(entry => <tr key={entry.date}><th scope="row">{format(parseISO(entry.date), "MMM d, yyyy")}</th><td>{entry.weight} {entry.unit}</td></tr>)}</tbody></table></details></> : <p className="chart-empty">No weight logs in this period.</p>}</section>
    <section className="weekly-review" aria-labelledby="weekly-review-title"><div className="section-heading"><div><h2 id="weekly-review-title">Weekly review</h2><p>Review the last seven days and choose one focus for next week.</p></div><span role="status" aria-live="polite">{reviewLoading ? "Loading review" : reviewHasError ? "Some data unavailable" : "Updated"}</span></div>
      {reviewHasError && <div className="weekly-review-error" role="alert"><span>Some weekly data could not be loaded.</span><button type="button" onClick={reloadWeeklyReview}>Try again</button></div>}
      <div className="weekly-review-stats"><article><strong>{weeklyRoutine.isPending ? "…" : weeklyRoutine.isError ? "—" : weeklyRoutine.data.periodCompleted}</strong><span>Routine completions</span></article><article><strong>{workouts.isPending ? "…" : workouts.isError ? "—" : weekLogs.length}</strong><span>Workouts logged</span></article><article><strong>{workouts.isPending ? "…" : workouts.isError ? "—" : weekLogs.reduce((sum, log) => sum + log.totalVolume, 0).toLocaleString()}</strong><span>Training volume</span></article><article><strong>{events.isPending ? "…" : events.isError ? "—" : events.data?.counts.task_snoozed?.count ?? 0}</strong><span>Tasks delayed</span></article><article><strong>{wellness.isPending ? "…" : wellness.isError ? "—" : wellnessDays.filter(day => day.waterGlasses > 0 || day.movementBreaks > 0).length}</strong><span>Wellness check-ins</span></article></div>
      <div className="weekly-review-focus"><div><b>Choose one focus</b><small>This saves your selection on this account on this device; it won’t change your routine automatically.</small></div><div className="weekly-review-options">{focusOptions.map(option => <button key={option} type="button" aria-pressed={weeklyFocus === option} onClick={() => { setWeeklyFocus(option); try { localStorage.setItem(focusKey, option); } catch { /* Keep the choice for this session when browser storage is blocked. */ } }}>{option}</button>)}</div></div>
      <div className="weekly-review-links"><Link to="/routine">Review this week’s routine</Link><Link to="/schedules">Adjust a schedule</Link></div>
    </section>
  </>;
}
