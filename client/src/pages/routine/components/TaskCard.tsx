import { Check, Pencil, Play, Plus, Trash2, CalendarDays, Bell, PauseCircle, AlarmClock, TimerReset, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Task } from "../../../types";

type TaskCardProps = {
  task: Task;
  blockId: string;
  complete: (task: Task) => void;
  edit: (value: { block: string; task?: Task }) => void;
  remove: (id: string) => void;
  saveSubtasks: (task: Task, subtasks: Task["subtasks"]) => void;
  activeTaskId: string | null;
  now: Date;
  startTask: (task: Task) => void;
  queueTask: (task: Task) => void;
  extendTask: (task: Task) => void;
  snoozeTask: (task: Task, minutes: number) => void;
};

export default function TaskCard({ task, blockId, complete, edit, remove, saveSubtasks, activeTaskId, now, startTask, queueTask, extendTask, snoozeTask }: TaskCardProps) {
  const [adding, setAdding] = useState(false);
  const [activeTimer, setActiveTimer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPrayer = task.type.toLowerCase() === "prayer";
  const isOverdue = Boolean(task.dueDate && task.dueDate < new Intl.DateTimeFormat("en-CA").format(new Date()) && !task.completed);
  const typeStyle: Record<string, string> = {
    prayer: "bg-chart-4/10 text-chart-4",
    deep_work: "bg-blue-400/10 text-blue-400",
    light_work: "bg-sky-400/10 text-sky-400",
    physical: "bg-green-400/10 text-green-400",
    reading: "bg-fuchsia-400/10 text-fuchsia-400",
    journaling: "bg-pink-400/10 text-pink-400",
    wind_down: "bg-indigo-400/10 text-indigo-400",
    planning: "bg-orange-400/10 text-orange-400",
  };
  const priorityStyle: Record<string, string> = {
    high: "text-destructive",
    medium: "text-chart-4",
    low: "text-primary",
  };
  const occurrence = task.occurrence;
  const isActive = occurrence?.status === "active";
  const isQueued = occurrence?.status === "queued";
  const blockEnded = isActive && occurrence?.endAt ? now.getTime() >= new Date(occurrence.endAt).getTime() : false;
  useEffect(() => {
    const started = (event: Event) => setActiveTimer((event as CustomEvent<{ taskId: string }>).detail.taskId === task._id);
    const updated = (event: Event) => setActiveTimer((event as CustomEvent<{ taskId: string | null }>).detail.taskId === task._id);
    window.addEventListener("irontrack:start-task-timer", started);
    window.addEventListener("routine-timer-update", updated);
    return () => { window.removeEventListener("irontrack:start-task-timer", started); window.removeEventListener("routine-timer-update", updated); };
  }, [task._id]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  function runMenuAction(action: () => void) {
    action();
    setMenuOpen(false);
  }

  function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget), title = String(form.get("title") ?? "").trim();
    if (!title) return;
    saveSubtasks(task, [...(task.subtasks ?? []), { title, completed: false }]);
    event.currentTarget.reset();
    setAdding(false);
  }

  function toggleSubtask(index: number) {
    saveSubtasks(task, task.subtasks.map((subtask, item) => item === index ? { ...subtask, completed: !subtask.completed } : subtask));
  }

  return <article className={`relative my-2 overflow-visible rounded-xl border border-border/75 border-l-4 border-l-border   backdrop-blur-xl transition-colors hover:bg-card/75 ${task.completed ? "bg-card/35" : ""} ${activeTimer ? "ring-2 ring-inset ring-primary" : ""}`}>
    <div className="min-w-0">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-1">
          <em className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium not-italic capitalize ${typeStyle[task.type.toLowerCase()] ?? "bg-muted text-muted-foreground"}`}>{task.type.replace(/_/g, " ")}</em>
          <span className={`text-[10px] font-semibold capitalize ${priorityStyle[task.priority] ?? "text-muted-foreground"}`}>{task.priority}</span>
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{task.category}</span>
          {task.dueDate && <span className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}><CalendarDays size={12} /> {task.dueDate}</span>}
          {task.reminderTime && <span className="inline-flex items-center gap-1 text-[10px] text-primary"><Bell size={12} /> {task.reminderTime}</span>}
          {occurrence?.status === "deferred" && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-semibold text-accent">Moved</span>}
          {isQueued && activeTaskId && <span className="rounded-full bg-chart-4/10 px-2 py-0.5 text-[9px] font-semibold text-chart-4">Next</span>}
        </div>
        <div className="relative z-30 shrink-0" ref={menuRef}>
          <button type="button" className="grid h-[30px] w-[30px] place-items-center !rounded-md !bg-transparent !p-0 text-muted-foreground hover:!bg-muted hover:!text-foreground" aria-label={`Task actions for ${task.title}`} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={`task-menu-${task._id}`} onClick={() => setMenuOpen(open => !open)}><MoreHorizontal size={18} /></button>
          {menuOpen && <div className="absolute right-0 top-[calc(100%+5px)] z-20 grid w-[190px] max-w-[calc(100vw-40px)] gap-0.5 rounded-lg border border-border/80 bg-popover/90 p-1 text-popover-foreground shadow-[0_12px_30px_hsl(var(--background)_/_0.4)] backdrop-blur-xl" id={`task-menu-${task._id}`} role="menu" aria-label={`${task.title} actions`}>
            <button type="button" className="flex min-h-9 w-full items-center gap-2.5 !rounded-md !bg-transparent px-2.5 text-left text-xs hover:!bg-muted" role="menuitem" onClick={() => runMenuAction(() => complete(task))}><Check size={15} className="shrink-0 text-muted-foreground" />{task.completed ? "Mark incomplete" : "Mark complete"}</button>
            {!isPrayer && !task.completed && isActive && blockEnded && <button type="button" className="flex min-h-9 w-full items-center gap-2.5 !rounded-md !bg-transparent px-2.5 text-left text-xs hover:!bg-muted" role="menuitem" onClick={() => runMenuAction(() => extendTask(task))}><TimerReset size={15} className="shrink-0 text-muted-foreground" />Add 15 minutes</button>}
            {!isPrayer && !task.completed && !isActive && !(isQueued && activeTaskId) && (activeTaskId ? <button type="button" className="flex min-h-9 w-full items-center gap-2.5 !rounded-md !bg-transparent px-2.5 text-left text-xs hover:!bg-muted" role="menuitem" onClick={() => runMenuAction(() => queueTask(task))}><PauseCircle size={15} className="shrink-0 text-muted-foreground" />Queue next</button> : <button type="button" className="flex min-h-9 w-full items-center gap-2.5 !rounded-md !bg-transparent px-2.5 text-left text-xs hover:!bg-muted" role="menuitem" onClick={() => runMenuAction(() => startTask(task))}><Play size={15} className="shrink-0 text-muted-foreground" />Start 45-minute block</button>)}
            {!isPrayer && !task.completed && !isActive && !isQueued && <button type="button" className="flex min-h-9 w-full items-center gap-2.5 !rounded-md !bg-transparent px-2.5 text-left text-xs hover:!bg-muted" role="menuitem" onClick={() => runMenuAction(() => snoozeTask(task, 5))}><AlarmClock size={15} className="shrink-0 text-muted-foreground" />Snooze 5 minutes</button>}
            <button type="button" className="flex min-h-9 w-full items-center gap-2.5 !rounded-md !bg-transparent px-2.5 text-left text-xs hover:!bg-muted" role="menuitem" onClick={() => runMenuAction(() => edit({ block: blockId, task }))}><Pencil size={15} className="shrink-0 text-muted-foreground" />Edit task</button>
            <button type="button" className="flex min-h-9 w-full items-center gap-2.5 !rounded-md !bg-transparent px-2.5 text-left text-xs text-destructive hover:!bg-muted" role="menuitem" onClick={() => runMenuAction(() => remove(task._id))}><Trash2 size={15} className="shrink-0" />Delete task</button>
          </div>}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2"><b className={`text-sm font-medium leading-snug text-foreground ${task.completed ? "text-muted-foreground line-through" : ""}`}>{task.title}</b>{task.completed && <em className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[8px] font-bold not-italic uppercase text-accent">Done</em>}</div>
      {task.description && !task.completed && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{task.description}</p>}
      {(task.duration > 0 || (task.startTime && task.endTime)) && <div className="mt-2.5 flex flex-wrap items-center gap-2.5 tabular-nums">{task.duration > 0 && <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{task.duration}m</span>}{task.startTime && task.endTime && <span className="border-l border-border pl-2.5 text-[11px] font-medium text-foreground">{task.startTime}–{task.endTime}</span>}</div>}
      {isActive && <p className="mt-2 flex items-center gap-1.5 text-[10px] text-primary">Started {occurrence.startedAt ? new Date(occurrence.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "now"} · ends {occurrence.endAt ? new Date(occurrence.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "soon"}</p>}
      {adding ? <form className="mt-2.5 flex flex-wrap gap-1.5" onSubmit={addSubtask}><input className="min-h-9 min-w-[120px] flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" name="title" aria-label={`New subtask for ${task.title}`} placeholder="Subtask name" autoFocus required /><button className="min-h-9 !rounded-md !bg-primary px-2.5 text-xs text-primary-foreground" type="submit">Add</button><button className="min-h-9 !rounded-md border border-border !bg-secondary px-2.5 text-xs text-secondary-foreground" type="button" onClick={() => setAdding(false)}>Cancel</button></form> : !task.completed && <button type="button" className="mt-3 inline-flex items-center gap-1.5 !rounded-md !bg-transparent !p-0 text-xs font-medium text-muted-foreground hover:!text-primary" onClick={() => setAdding(true)}><Plus size={14} /> Add subtask</button>}
      {task.subtasks?.length > 0 && <ul className="mt-2.5 grid list-none gap-1.5 p-0">{task.subtasks.map((subtask, index) => <li key={index}><button type="button" className={`flex items-center gap-2 !rounded-none !bg-transparent !p-0 text-left text-xs ${subtask.completed ? "text-muted-foreground line-through" : "text-secondary-foreground"}`} onClick={() => toggleSubtask(index)}><span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${subtask.completed ? "border-accent bg-accent text-accent-foreground" : "border-muted-foreground"}`}>{subtask.completed && <Check size={10} />}</span>{subtask.title}</button></li>)}</ul>}
    </div>
  </article>;
}
