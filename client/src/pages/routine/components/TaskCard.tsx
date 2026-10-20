import { Check, Clock3, Pencil, Play, Plus, Trash2, CalendarDays, Bell, PauseCircle, AlarmClock, TimerReset } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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
  const isPrayer = task.type.toLowerCase() === "prayer";
  const isOverdue = Boolean(task.dueDate && task.dueDate < new Intl.DateTimeFormat("en-CA").format(new Date()) && !task.completed);
  const subtaskDone = task.subtasks?.filter(subtask => subtask.completed).length ?? 0;
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

  return <article className={`task ${task.completed ? "done" : ""} ${activeTimer ? "timer-active" : ""}`}>
    <button className="check" onClick={() => complete(task)} aria-label={`Mark ${task.title} ${task.completed ? "incomplete" : "complete"}`}>{task.completed && <Check size={11} />}</button>
    <div className="task-content">
      <div className="task-title-line"><b className={task.completed ? "task-title-done" : ""}>{task.title}</b>{task.completed && <em className="task-done-badge">Done</em>}</div>
      {task.description && !task.completed && <p>{task.description}</p>}
      <div className="tags"><em className={`task-type type-${task.type.toLowerCase()} ${isPrayer ? "prayer-type" : ""}`}>{task.type.replace(/_/g, " ")}</em><span className={`task-priority ${task.priority}`}>{task.priority}</span><span className="task-category">{task.category}</span>{task.duration > 0 && <span className="task-duration"><Clock3 size={12} /> {task.duration}m</span>}{task.startTime && task.endTime && <span className="task-scheduled-time"><Clock3 size={12} /> {task.startTime}–{task.endTime}</span>}{task.dueDate && <span className={`task-due ${isOverdue ? "overdue" : ""}`}><CalendarDays size={12} /> {task.dueDate}</span>}{task.reminderTime && <span className="task-reminder"><Bell size={12} /> {task.reminderTime}</span>}{task.subtasks?.length > 0 && <span className="task-subtask-count">{subtaskDone}/{task.subtasks.length}</span>}</div>
      {occurrence && occurrence.status !== "planned" && <p className={`task-occurrence-state ${occurrence.status}`}>{isActive ? `Started ${occurrence.startedAt ? new Date(occurrence.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "now"} · ends ${occurrence.endAt ? new Date(occurrence.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "soon"}` : isQueued ? "Queued next · starts when you’re ready" : occurrence.status === "deferred" ? "Moved to the last prayer card" : "Completed for today"}</p>}
      {task.subtasks?.length > 0 && <ul className="subtask-list">{task.subtasks.map((subtask, index) => <li key={index}><button type="button" className={subtask.completed ? "subtask-done" : ""} onClick={() => toggleSubtask(index)}><span>{subtask.completed && <Check size={10} />}</span>{subtask.title}</button></li>)}</ul>}
      {adding ? <form className="subtask-form" onSubmit={addSubtask}><input name="title" aria-label={`New subtask for ${task.title}`} placeholder="Subtask name" autoFocus required /><button type="submit">Add</button><button type="button" onClick={() => setAdding(false)}>Cancel</button></form> : !task.completed && <button type="button" className="subtask-add" onClick={() => setAdding(true)}><Plus size={14} /> Add subtask</button>}
    </div>
    <div className="task-actions">{!isPrayer && !task.completed && (isActive ? <><button type="button" onClick={() => complete(task)} aria-label={`Complete ${task.title}`} title="Complete"><Check size={16} /></button>{blockEnded && <button type="button" onClick={() => extendTask(task)} aria-label={`Add 15 minutes to ${task.title}`} title="Add 15 minutes"><TimerReset size={16} /></button>}</> : isQueued && activeTaskId ? <span className="queued-pill">Next</span> : activeTaskId ? <button type="button" onClick={() => queueTask(task)} aria-label={`Queue ${task.title} next`} title="Queue next"><PauseCircle size={16} /></button> : <button type="button" onClick={() => startTask(task)} aria-label={`Start ${task.title}`} title="Start 45-minute block"><Play size={16} /></button>)}{!isPrayer && !task.completed && !isActive && !isQueued && <button type="button" onClick={() => snoozeTask(task, 5)} aria-label={`Snooze ${task.title} for five minutes`} title="Snooze 5 minutes"><AlarmClock size={16} /></button>}<button type="button" onClick={() => edit({ block: blockId, task })} aria-label={`Edit ${task.title}`}><Pencil /></button><button type="button" onClick={() => remove(task._id)} aria-label={`Delete ${task.title}`}><Trash2 /></button></div>
  </article>;
}
