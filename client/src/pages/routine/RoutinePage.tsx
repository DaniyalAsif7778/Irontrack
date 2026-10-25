import {
  Activity,
  Flame,
  Plus,
  Sun,
  Moon,
  Clock3,
  RotateCcw,
  Sunrise,
  Sunset,
  CloudSun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAnalytics } from "../../hooks/useAnalytics";
import type { Day, RoutineBlock, Task, TaskEditing } from "../../types";
import TaskCard from "./components/TaskCard";

type RoutinePageProps = {
  date: string;
  title: string;
  day: Day | null;
  dayType: Day["dayType"];
  dayLoading: boolean;
  dayError: string | null;
  setDate: (value: string) => void;
  complete: (task: Task) => void;
  edit: (value: TaskEditing) => void;
  remove: (id: string) => void;
  saveSubtasks: (task: Task, subtasks: Task["subtasks"]) => void;
  onError: (message: string) => void;
  startTask: (task: Task) => void;
  queueTask: (task: Task) => void;
  extendTask: (task: Task) => void;
  snoozeTask: (task: Task, minutes: number) => void;
  eventStats:
    | {
        days: number;
        counts: Record<string, { count: number; avgResponseMs: number | null }>;
        completionRate: number;
        totalEvents: number;
        averageResponseMs: number | null;
        recentEvents: Array<{
          eventId: string;
          date: string;
          type: string;
          occurredAt: string;
          responseTimeMs: number | null;
          pushStatus?: string;
          taskId?: { title: string } | null;
        }>;
      }
    | undefined;
};

export default function RoutinePage({
  date,
  title,
  day,
  dayType,
  dayLoading,
  dayError,
  setDate,
  complete,
  edit,
  remove,
  saveSubtasks,
  onError,
  startTask,
  queueTask,
  extendTask,
  snoozeTask,
  eventStats,
}: RoutinePageProps) {
  const [tab, setTab] = useState<"routine" | "analytics">("routine");
  const [now, setNow] = useState(() => new Date());
  const analytics = useAnalytics(14);
  const activity = analytics.data?.activity ?? [];
  const emptyBlocks: RoutineBlock[] = [
    { id: "fajr", label: "Fajr", tasks: [], completed: 0, total: 0 },
    { id: "dhuhr", label: "Dhuhr", tasks: [], completed: 0, total: 0 },
    { id: "asr", label: "Asr", tasks: [], completed: 0, total: 0 },
    { id: "maghrib", label: "Maghrib", tasks: [], completed: 0, total: 0 },
    { id: "isha", label: "Isha", tasks: [], completed: 0, total: 0 },
  ];
  const blocks = day?.blocks ?? emptyBlocks;
  const activeTaskId =
    blocks
      .flatMap((block) => block.tasks)
      .find((task) => task.occurrence?.status === "active")?._id ?? null;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (analytics.error) onError(analytics.error.message);
  }, [analytics.error, onError]);
  return (
    <>
      <header className="w-full flex flex-col items-start" >
        
          <div className=" w-full flex flex-row justify-between">
            <h1>Routine</h1>
            {tab === "routine" && (
              <div className="routine-header-actions">
                <input
                  aria-label="Routine date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            )}
          </div>
          <div className="w-full">
            <p>Your day, anchored by prayer and intentional tasks.</p>
          </div>
         
      </header>
      <nav className="routine-tabs" aria-label="Routine view">
        <button
          type="button"
          className={tab === "routine" ? "selected" : ""}
          onClick={() => setTab("routine")}
        >
          <Sun size={15} /> Routine
        </button>
        <button
          type="button"
          className={tab === "analytics" ? "selected" : ""}
          onClick={() => setTab("analytics")}
        >
          <Activity size={15} /> Analytics
        </button>
      </nav>
      {tab === "analytics" ? (
        <>
          <div className="dashboard routine-analytics-metrics">
            <article className="metric-card">
              <span>
                <Flame />
              </span>
              <strong>
                {activity.filter((item) => item.completed > 0).length}
              </strong>
              <small>Active days · 14 days</small>
            </article>
            <article className="metric-card">
              <span>
                <Activity />
              </span>
              <strong>{analytics.data?.periodCompleted ?? 0}</strong>
              <small>Tasks completed · 14 days</small>
            </article>
            <article className="metric-card">
              <span>
                <Sun />
              </span>
              <strong>
                {activity.length
                  ? Math.round(
                      activity.reduce((sum, day) => sum + day.rate, 0) /
                        activity.length,
                    )
                  : 0}
                %
              </strong>
              <small>Average daily completion</small>
            </article>
            <article className="metric-card">
              <span>
                <Clock3 />
              </span>
              <strong>{eventStats?.totalEvents ?? 0}</strong>
              <small>Tracked actions · {eventStats?.days ?? 14} days</small>
            </article>
          </div>
          <section className="chart-card habit-event-insights">
            <div className="section-heading">
              <h2>Habit response</h2>
              <span>Events recorded in IronTrack</span>
            </div>
            <div className="habit-event-grid">
              <article>
                <b>{eventStats?.completionRate ?? 0}%</b>
                <small>Task start-to-complete rate</small>
              </article>
              <article>
                <b>{eventStats?.counts.task_started?.count ?? 0}</b>
                <small>Tasks started</small>
              </article>
              <article>
                <b>{eventStats?.counts.task_extended?.count ?? 0}</b>
                <small>15-minute extensions</small>
              </article>
              <article>
                <b>{eventStats?.counts.task_snoozed?.count ?? 0}</b>
                <small>Snoozes</small>
              </article>
              <article>
                <b>{eventStats?.counts.reminder_ignored?.count ?? 0}</b>
                <small>Ignored reminders</small>
              </article>
              <article>
                <b>{eventStats?.counts.task_deferred?.count ?? 0}</b>
                <small>Moved to final prayer card</small>
              </article>
              <article>
                <b>
                  {eventStats?.averageResponseMs == null
                    ? "—"
                    : `${Math.round(eventStats.averageResponseMs / 60_000)}m`}
                </b>
                <small>Average response time</small>
              </article>
            </div>
            {!eventStats?.totalEvents && (
              <p className="chart-empty">
                Task response insights will appear after you start using
                reminders.
              </p>
            )}
          </section>
          {Boolean(eventStats?.recentEvents.length) && (
            <section className="chart-card">
              <div className="section-heading">
                <h2>Recent routine activity</h2>
                <span>Latest 20 actions</span>
              </div>
              <ul className="routine-event-feed">
                {eventStats?.recentEvents.map((event) => (
                  <li key={event.eventId}>
                    <span className="routine-event-dot" />
                    <div>
                      <b>
                        {event.taskId?.title ?? event.type.replace(/_/g, " ")}
                      </b>
                      <small>
                        {event.type.replace(/_/g, " ")} ·{" "}
                        {new Date(event.occurredAt).toLocaleString()}
                      </small>
                    </div>
                    <small>
                      {event.pushStatus
                        ? `Push ${event.pushStatus}`
                        : event.date}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="chart-card">
            <div className="section-heading">
              <h2>Last 14 days</h2>
              <span>Completed tasks by day</span>
            </div>
            {analytics.isPending ? (
              <p className="chart-empty">Loading routine history…</p>
            ) : (
              <div className="routine-heatmap">
                {activity.map((item) => (
                  <div
                    className="routine-heat-day"
                    key={item.date}
                    title={`${item.date}: ${item.completed}/${item.total} tasks`}
                  >
                    <span
                      className={`routine-heat-cell ${item.rate >= 75 ? "high" : item.rate >= 35 ? "medium" : item.completed ? "low" : "empty"}`}
                    >
                      <b>{item.completed}</b>
                    </span>
                    <small>
                      {new Date(`${item.date}T12:00:00`).toLocaleDateString(
                        undefined,
                        { weekday: "short" },
                      )}
                    </small>
                  </div>
                ))}
              </div>
            )}
            <div className="routine-analytics-legend">
              <span>
                Complete more tasks each day to build a steady rhythm.
              </span>
              <b>
                {
                  activity.filter((item) => item.rate === 100 && item.total > 0)
                    .length
                }{" "}
                complete days
              </b>
            </div>
          </section>
          <section className="chart-card">
            <div className="section-heading">
              <h2>Daily completion</h2>
              <span>Completions / planned tasks</span>
            </div>
            <div className="routine-bars">
              {activity.map((item) => (
                <div
                  className="routine-bar-day"
                  key={item.date}
                  title={`${item.completed} of ${item.total}`}
                >
                  <div>
                    <i
                      style={{
                        height: `${Math.max(item.rate ? 6 : 0, item.rate)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {new Date(`${item.date}T12:00:00`).toLocaleDateString(
                      undefined,
                      { day: "numeric" },
                    )}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="routine-live-head">
            <div>
              <small>{title.toUpperCase()}</small>
              <strong>
                <Clock3 size={16} />
                {now.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </strong>
            </div>
            <div className="routine-live-progress">
              <small>Progress</small>
              <b>
                {day?.progress.completed ?? 0}/{day?.progress.total ?? 0}
              </b>
            </div>
            <button
              type="button"
              title={`Reset ${title} task completions`}
              aria-label={`Reset ${title} task completions`}
              onClick={() =>
                day?.blocks
                  .flatMap((block) => block.tasks)
                  .filter((task) => task.completed)
                  .forEach(complete)
              }
            >
              <RotateCcw size={16} />
            </button>
          </section>
          <div
            className="routine-type-lock"
            aria-label={`Routine automatically selected: ${dayType}`}
          >
            <span className={dayType === "weekday" ? "selected" : "muted"}>
              <Sun size={15} /> Weekday
            </span>
            <span className={dayType === "weekend" ? "selected" : "muted"}>
              <Moon size={15} /> Weekend
            </span>
          </div>
          <p className="routine-type-hint">Routine auto-selected by day</p>
          {!day && (
            <p
              className="routine-load-state"
              role={dayError ? "alert" : "status"}
            >
              {dayLoading
                ? "Loading saved tasks. Your five prayer blocks are ready."
                : `Could not load saved tasks: ${dayError ?? "please try again"}. Your five prayer blocks are shown below.`}
            </p>
          )}
          {(!day || day.progress.total === 0) && (
            <section className="routine-empty" aria-live="polite">
              <div>
                <h2>Your routine is ready</h2>
                <p>
                  {day
                    ? "Add your first task to start building your day."
                    : "Add tasks under the prayer anchors. Saved tasks will appear here when the server is available."}
                </p>
              </div>
              <button
                type="button"
                className="settings-secondary"
                onClick={() => edit({ block: "fajr" })}
              >
                <Plus size={15} /> Add your first task
              </button>
            </section>
          )}
          <div className="blocks">
            {blocks.map((block) => {
              const prayerIndex = block.tasks.findIndex(
                (task) => task.type.toLowerCase() === "prayer",
              );
              const firstAfterPrayer =
                prayerIndex < 0
                  ? -1
                  : block.tasks.findIndex(
                      (task, index) =>
                        index > prayerIndex &&
                        task.type.toLowerCase() !== "prayer",
                    );
              const BlockIcon =
                block.id === "fajr"
                  ? Sunrise
                  : block.id === "dhuhr"
                    ? Sun
                    : block.id === "asr"
                      ? CloudSun
                      : block.id === "maghrib"
                        ? Sunset
                        : Moon;
              return (
                <section className="block" key={block.id}>
                  <div className="block-title">
                    <h2>
                      <BlockIcon /> {block.label}
                    </h2>
                    <span>
                      {block.completed}/{block.total}
                    </span>
                  </div>
                  <div className="progress">
                    <i
                      style={{
                        width: `${block.total ? (block.completed / block.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {block.tasks.map((task, index) => (
                    <div className="task-wrap" key={task._id}>
                      {(index === firstAfterPrayer ||
                        (index === 0 &&
                          task.section === `post_${block.id}`)) && (
                        <h3 className="block-divider">After {block.label}</h3>
                      )}
                      <TaskCard
                        task={task}
                        blockId={block.id}
                        complete={complete}
                        edit={edit}
                        remove={remove}
                        saveSubtasks={saveSubtasks}
                        activeTaskId={activeTaskId}
                        now={now}
                        startTask={startTask}
                        queueTask={queueTask}
                        extendTask={extendTask}
                        snoozeTask={snoozeTask}
                      />
                    </div>
                  ))}
                  <button
                    className="add"
                    onClick={() => edit({ block: block.id })}
                  >
                    <Plus size={15} /> Add task
                  </button>
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
