import { Activity, Flame, Plus, Sun, Moon, Clock3, RotateCcw, Sunrise, Sunset, CloudSun } from "lucide-react";
import { useEffect, useState } from "react";
import { useAnalytics } from "../../hooks/useAnalytics";
import type { Day, Task, TaskEditing } from "../../types";
import TaskCard from "./components/TaskCard";

type RoutinePageProps = {
  date: string;
  title: string;
  day: Day | null;
  setDate: (value: string) => void;
  complete: (task: Task) => void;
  edit: (value: TaskEditing) => void;
  remove: (id: string) => void;
  saveSubtasks: (task: Task, subtasks: Task["subtasks"]) => void;
  onError: (message: string) => void;
};

export default function RoutinePage({ date, title, day, setDate, complete, edit, remove, saveSubtasks, onError }: RoutinePageProps) {
  const [tab, setTab] = useState<"routine" | "analytics">("routine");
  const [now, setNow] = useState(() => new Date());
  const analytics = useAnalytics(14);
  const activity = analytics.data?.activity ?? [];
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (analytics.error) onError(analytics.error.message); }, [analytics.error, onError]);
  return <>
    <header><div><h1>Routine</h1><p>Your day, anchored by prayer and intentional tasks.</p></div>{tab === "routine" && <div className="routine-header-actions"><input aria-label="Routine date" type="date" value={date} onChange={event => setDate(event.target.value)} /></div>}</header>
    <nav className="routine-tabs" aria-label="Routine view"><button type="button" className={tab === "routine" ? "selected" : ""} onClick={() => setTab("routine")}><Sun size={15} /> Routine</button><button type="button" className={tab === "analytics" ? "selected" : ""} onClick={() => setTab("analytics")}><Activity size={15} /> Analytics</button></nav>
    {tab === "analytics" ? <>
      <div className="dashboard routine-analytics-metrics"><article className="metric-card"><span><Flame /></span><strong>{activity.filter(item => item.completed > 0).length}</strong><small>Active days · 14 days</small></article><article className="metric-card"><span><Activity /></span><strong>{analytics.data?.periodCompleted ?? 0}</strong><small>Tasks completed · 14 days</small></article><article className="metric-card"><span><Sun /></span><strong>{activity.length ? Math.round(activity.reduce((sum, day) => sum + day.rate, 0) / activity.length) : 0}%</strong><small>Average daily completion</small></article></div>
      <section className="chart-card"><div className="section-heading"><h2>Last 14 days</h2><span>Completed tasks by day</span></div>{analytics.isPending ? <p className="chart-empty">Loading routine history…</p> : <div className="routine-heatmap">{activity.map(item => <div className="routine-heat-day" key={item.date} title={`${item.date}: ${item.completed}/${item.total} tasks`}><span className={`routine-heat-cell ${item.rate >= 75 ? "high" : item.rate >= 35 ? "medium" : item.completed ? "low" : "empty"}`}><b>{item.completed}</b></span><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</small></div>)}</div>}<div className="routine-analytics-legend"><span>Complete more tasks each day to build a steady rhythm.</span><b>{activity.filter(item => item.rate === 100 && item.total > 0).length} complete days</b></div></section>
      <section className="chart-card"><div className="section-heading"><h2>Daily completion</h2><span>Completions / planned tasks</span></div><div className="routine-bars">{activity.map(item => <div className="routine-bar-day" key={item.date} title={`${item.completed} of ${item.total}`}><div><i style={{ height: `${Math.max(item.rate ? 6 : 0, item.rate)}%` }} /></div><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric" })}</small></div>)}</div></section>
    </> : <>
    <section className="routine-live-head"><div><small>{title.toUpperCase()}</small><strong><Clock3 size={16} />{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong></div><div className="routine-live-progress"><small>Progress</small><b>{day?.progress.completed ?? 0}/{day?.progress.total ?? 0}</b></div><button type="button" title={`Reset ${title} task completions`} aria-label={`Reset ${title} task completions`} onClick={() => day?.blocks.flatMap(block => block.tasks).filter(task => task.completed).forEach(complete)}><RotateCcw size={16} /></button></section>
    <div className="routine-type-lock" aria-label={`Routine automatically selected: ${day?.dayType ?? "weekday"}`}><span className={day?.dayType === "weekday" ? "selected" : "muted"}><Sun size={15} /> Weekday</span><span className={day?.dayType === "weekend" ? "selected" : "muted"}><Moon size={15} /> Weekend</span></div><p className="routine-type-hint">Routine auto-selected by day</p>
    {day && day.progress.total === 0 && <section className="routine-empty" aria-live="polite">
      <div><h2>Your routine is ready</h2><p>The backup had no routine tasks. Add the first one to start building your day.</p></div>
      <button type="button" className="settings-secondary" onClick={() => edit({ block: day.blocks[0]?.id ?? "fajr" })}><Plus size={15} /> Add your first task</button>
    </section>}
    <div className="blocks">{day?.blocks.map(block => {
      const prayerIndex = block.tasks.findIndex(task => task.type.toLowerCase() === "prayer");
      const firstAfterPrayer = prayerIndex < 0 ? -1 : block.tasks.findIndex((task, index) => index > prayerIndex && task.type.toLowerCase() !== "prayer");
      const BlockIcon = block.id === "fajr" ? Sunrise : block.id === "dhuhr" ? Sun : block.id === "asr" ? CloudSun : block.id === "maghrib" ? Sunset : Moon;
      return <section className="block" key={block.id}>
        <div className="block-title"><h2><BlockIcon /> {block.label}</h2><span>{block.completed}/{block.total}</span></div>
        <div className="progress"><i style={{ width: `${block.total ? block.completed / block.total * 100 : 0}%` }} /></div>
        {block.tasks.map((task, index) => <div className="task-wrap" key={task._id}>
          {(index === firstAfterPrayer || (index === 0 && task.section === `post_${block.id}`)) && <h3 className="block-divider">After {block.label}</h3>}
          <TaskCard task={task} blockId={block.id} complete={complete} edit={edit} remove={remove} saveSubtasks={saveSubtasks} />
        </div>)}
        <button className="add" onClick={() => edit({ block: block.id })}><Plus size={15} /> Add task</button>
      </section>;
    })}</div>
    </>}
  </>;
}
