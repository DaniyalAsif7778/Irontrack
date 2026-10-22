import {
  Check,
  Clock3,
  Pencil,
  Play,
  Plus,
  Trash2,
  CalendarDays,
  Bell,
  PauseCircle,
  AlarmClock,
  TimerReset,
  MoreHorizontal,
} from "lucide-react";
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

export default function TaskCard({
  task,
  blockId,
  complete,
  edit,
  remove,
  saveSubtasks,
  activeTaskId,
  now,
  startTask,
  queueTask,
  extendTask,
  snoozeTask,
}: TaskCardProps) {
  const [adding, setAdding] = useState(false);
  const [activeTimer, setActiveTimer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPrayer = task.type.toLowerCase() === "prayer";
  const isOverdue = Boolean(
    task.dueDate &&
    task.dueDate < new Intl.DateTimeFormat("en-CA").format(new Date()) &&
    !task.completed,
  );
  const occurrence = task.occurrence;
  const isActive = occurrence?.status === "active";
  const isQueued = occurrence?.status === "queued";
  const blockEnded =
    isActive && occurrence?.endAt
      ? now.getTime() >= new Date(occurrence.endAt).getTime()
      : false;

  useEffect(() => {
    const started = (event: Event) =>
      setActiveTimer((event as CustomEvent<{ taskId: string }>).detail.taskId === task._id);
    const updated = (event: Event) =>
      setActiveTimer((event as CustomEvent<{ taskId: string | null }>).detail.taskId === task._id);
    window.addEventListener("irontrack:start-task-timer", started);
    window.addEventListener("routine-timer-update", updated);
    return () => {
      window.removeEventListener("irontrack:start-task-timer", started);
      window.removeEventListener("routine-timer-update", updated);
    };
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
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    saveSubtasks(task, [...(task.subtasks ?? []), { title, completed: false }]);
    event.currentTarget.reset();
    setAdding(false);
  }

  function toggleSubtask(index: number) {
    saveSubtasks(
      task,
      task.subtasks.map((subtask, item) =>
        item === index ? { ...subtask, completed: !subtask.completed } : subtask,
      ),
    );
  }

  return (
    <article className={`task ${task.completed ? "done" : ""} ${activeTimer ? "timer-active" : ""} ${menuOpen ? "menu-open" : ""}`}>
      <div className="task-content">
        <div className="task-head">
          <div className="tags">
            <em className={`task-type type-${task.type.toLowerCase()} ${isPrayer ? "prayer-type" : ""}`}>
              {task.type.replace(/_/g, " ")}
            </em>
            <span className={`task-priority ${task.priority}`}>{task.priority}</span>
            <span className="task-category">{task.category}</span>
            {task.dueDate && (
              <span className={`task-due ${isOverdue ? "overdue" : ""}`}>
                <CalendarDays size={12} /> {task.dueDate}
              </span>
            )}
            {task.reminderTime && (
              <span className="task-reminder">
                <Bell size={12} /> {task.reminderTime}
              </span>
            )}
            {occurrence?.status === "deferred" && <span className="task-moved-pill">Moved</span>}
            {isQueued && activeTaskId && <span className="queued-pill">Next</span>}
          </div>
          <div className="task-menu" ref={menuRef}>
            <button
              type="button"
              className="task-menu-toggle"
              aria-label={`Task actions for ${task.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={`task-menu-${task._id}`}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="task-menu-list" id={`task-menu-${task._id}`} role="menu" aria-label={`${task.title} actions`}>
                <button type="button" role="menuitem" onClick={() => runMenuAction(() => complete(task))}>
                  <Check size={15} />
                  {task.completed ? "Mark incomplete" : "Mark complete"}
                </button>
                {!isPrayer && !task.completed && isActive && blockEnded && (
                  <button type="button" role="menuitem" onClick={() => runMenuAction(() => extendTask(task))}>
                    <TimerReset size={15} />
                    Add 15 minutes
                  </button>
                )}
                {!isPrayer && !task.completed && !isActive && !(isQueued && activeTaskId) && (
                  activeTaskId ? (
                    <button type="button" role="menuitem" onClick={() => runMenuAction(() => queueTask(task))}>
                      <PauseCircle size={15} />
                      Queue next
                    </button>
                  ) : (
                    <button type="button" role="menuitem" onClick={() => runMenuAction(() => startTask(task))}>
                      <Play size={15} />
                      Start 45-minute block
                    </button>
                  )
                )}
                {!isPrayer && !task.completed && !isActive && !isQueued && (
                  <button type="button" role="menuitem" onClick={() => runMenuAction(() => snoozeTask(task, 5))}>
                    <AlarmClock size={15} />
                    Snooze 5 minutes
                  </button>
                )}
                <button type="button" role="menuitem" onClick={() => runMenuAction(() => edit({ block: blockId, task }))}>
                  <Pencil size={15} />
                  Edit task
                </button>
                <button type="button" role="menuitem" className="danger" onClick={() => runMenuAction(() => remove(task._id))}>
                  <Trash2 size={15} />
                  Delete task
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="task-title-line">
          <b className={task.completed ? "task-title-done" : ""}>{task.title}</b>
          {task.completed && <em className="task-done-badge">Done</em>}
        </div>
        {task.description && !task.completed && <p>{task.description}</p>}
        {(task.duration > 0 || (task.startTime && task.endTime)) && (
          <div className="task-schedule">
            {task.duration > 0 && (
              <span className="task-duration">
                <Clock3 size={12} /> {task.duration}m
              </span>
            )}
            {task.startTime && task.endTime && (
              <span className="task-scheduled-time">
                <Clock3 size={12} /> {task.startTime}–{task.endTime}
              </span>
            )}
          </div>
        )}
        {isActive && (
          <p className="task-occurrence-state active">
            Started {occurrence.startedAt ? new Date(occurrence.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "now"}
            {" "}· ends {occurrence.endAt ? new Date(occurrence.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "soon"}
          </p>
        )}
        {adding ? (
          <form className="subtask-form" onSubmit={addSubtask}>
            <input name="title" aria-label={`New subtask for ${task.title}`} placeholder="Subtask name" autoFocus required />
            <button type="submit">Add</button>
            <button type="button" onClick={() => setAdding(false)}>Cancel</button>
          </form>
        ) : (
          !task.completed && (
            <button type="button" className="subtask-add" onClick={() => setAdding(true)}>
              <Plus size={14} /> Add subtask
            </button>
          )
        )}
        {task.subtasks?.length > 0 && (
          <ul className="subtask-list">
            {task.subtasks.map((subtask, index) => (
              <li key={index}>
                <button type="button" className={subtask.completed ? "subtask-done" : ""} onClick={() => toggleSubtask(index)}>
                  <span>{subtask.completed && <Check size={10} />}</span>
                  {subtask.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
