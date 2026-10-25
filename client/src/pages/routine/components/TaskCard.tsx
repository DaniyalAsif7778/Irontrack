
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
  Timer,
  TimerReset,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type { Task } from "../../../types";

type TaskCardProps = {
  task: Task;
  blockId: string;
  complete: (task: Task) => void;
  edit: (value: { block: string; task?: Task }) => void;
  remove: (id: string) => void;
  saveSubtasks: (
    task: Task,
    subtasks: Task["subtasks"],
  ) => void;
  activeTaskId: string | null;
  now: Date;
  startTask: (task: Task) => void;
  queueTask: (task: Task) => void;
  extendTask: (task: Task) => void;
  snoozeTask: (task: Task, minutes: number) => void;
};

/* ========================================
   DATE HELPERS
======================================== */

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateKey: string): string {
  const date = new Date(`${dateKey.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/* ========================================
   TASK CARD
======================================== */

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
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const subtasks = task.subtasks ?? [];
  const occurrence = task.occurrence;

  const isPrayer = task.type.toLowerCase() === "prayer";
  const isActive = occurrence?.status === "active";
  const isQueued = occurrence?.status === "queued";

  const todayKey = getLocalDateKey(now);
  const todayDate = formatDisplayDate(todayKey);
  const dueDateKey = task.dueDate?.slice(0, 10);

  const isOverdue = Boolean(
    dueDateKey &&
      dueDateKey < todayKey &&
      !task.completed,
  );

  const completedSubtaskCount = subtasks.filter(
    (subtask) => subtask.completed,
  ).length;

  const blockEnded =
    isActive && occurrence?.endAt
      ? now.getTime() >= new Date(occurrence.endAt).getTime()
      : false;

  /* ========================================
     TIMER EVENTS
  ======================================== */

  useEffect(() => {
    const started = (event: Event) => {
      const detail = (
        event as CustomEvent<{ taskId: string }>
      ).detail;

      setActiveTimer(detail?.taskId === task._id);
    };

    const updated = (event: Event) => {
      const detail = (
        event as CustomEvent<{ taskId: string | null }>
      ).detail;

      setActiveTimer(detail?.taskId === task._id);
    };

    window.addEventListener(
      "irontrack:start-task-timer",
      started,
    );

    window.addEventListener(
      "routine-timer-update",
      updated,
    );

    return () => {
      window.removeEventListener(
        "irontrack:start-task-timer",
        started,
      );

      window.removeEventListener(
        "routine-timer-update",
        updated,
      );
    };
  }, [task._id]);

  /* ========================================
     MENU DISMISSAL
  ======================================== */

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      closeOnOutsideClick,
    );

    document.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutsideClick,
      );

      document.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [menuOpen]);

  function runMenuAction(action: () => void) {
    action();
    setMenuOpen(false);
  }

  /* ========================================
     ADD SUBTASK
  ======================================== */

  function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim();

    if (!title) return;

    saveSubtasks(task, [
      ...subtasks,
      {
        title,
        completed: false,
      },
    ]);

    // Open the list so the new subtask is immediately visible.
    setSubtasksExpanded(true);
    formElement.reset();
    setAdding(false);
  }

  /* ========================================
     TOGGLE SUBTASK
  ======================================== */

  function toggleSubtask(index: number) {
    const updatedSubtasks = subtasks.map((subtask, item) =>
      item === index
        ? {
            ...subtask,
            completed: !subtask.completed,
          }
        : subtask,
    );

    saveSubtasks(task, updatedSubtasks);
  }

  /* ========================================
     RENDER
  ======================================== */

  return (
    <article
      className={[
        "task",
        task.completed ? "done" : "",
        activeTimer ? "timer-active" : "",
        menuOpen ? "menu-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="task-content min-w-0 p-2">
        {/* METADATA */}

        <div className="task-head">
          <div className="tags">
            <em
              className={[
                "task-type",
                `type-${task.type.toLowerCase()}`,
                isPrayer ? "prayer-type" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {task.type.replace(/_/g, " ")}
            </em>

            <span className={`task-priority ${task.priority}`}>
              {task.priority}
            </span>

            <span className="task-category">
              {task.category}
            </span>

            {/* TODAY'S DATE */}

            <span
              className="
                task-today-date inline-flex items-center gap-1
                whitespace-nowrap text-[10px] font-medium
                leading-none text-[var(--quiet)]
              "
              title="Today's date"
            >
              <CalendarDays
                size={11}
                className="shrink-0 opacity-80"
                aria-hidden="true"
              />

              <time dateTime={todayKey}>
                {todayDate}
              </time>
            </span>

            {/* DIFFERENT DUE DATE ONLY */}

          

            {task.reminderTime && (
              <span className="task-reminder">
                <Bell size={12} aria-hidden="true" />
                {task.reminderTime}
              </span>
            )}

            {occurrence?.status === "deferred" && (
              <span className="task-moved-pill">
                Moved
              </span>
            )}

            {isQueued && activeTaskId && (
              <span className="queued-pill">
                Next
              </span>
            )}
          </div>

          {/* ACTION MENU */}

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
              <MoreHorizontal size={19} aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                className="task-menu-list"
                id={`task-menu-${task._id}`}
                role="menu"
                aria-label={`${task.title} actions`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runMenuAction(() => complete(task))
                  }
                >
                  <Check size={15} aria-hidden="true" />
                  {task.completed
                    ? "Mark incomplete"
                    : "Mark complete"}
                </button>

                {!isPrayer &&
                  !task.completed &&
                  isActive &&
                  blockEnded && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        runMenuAction(() => extendTask(task))
                      }
                    >
                      <TimerReset size={15} aria-hidden="true" />
                      Add 15 minutes
                    </button>
                  )}

                {!isPrayer &&
                  !task.completed &&
                  !isActive &&
                  !(isQueued && activeTaskId) &&
                  (activeTaskId ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        runMenuAction(() => queueTask(task))
                      }
                    >
                      <PauseCircle size={15} aria-hidden="true" />
                      Queue next
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        runMenuAction(() => startTask(task))
                      }
                    >
                      <Play size={15} aria-hidden="true" />
                      Start 45-minute block
                    </button>
                  ))}

                {!isPrayer &&
                  !task.completed &&
                  !isActive &&
                  !isQueued && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        runMenuAction(() => snoozeTask(task, 5))
                      }
                    >
                      <AlarmClock size={15} aria-hidden="true" />
                      Snooze 5 minutes
                    </button>
                  )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runMenuAction(() =>
                      edit({ block: blockId, task }),
                    )
                  }
                >
                  <Pencil size={15} aria-hidden="true" />
                  Edit task
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() =>
                    runMenuAction(() => remove(task._id))
                  }
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Delete task
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TITLE */}

        <div className="task-title-line">
          <h3
            className={[
              "task-title",
              "text-[15px] font-semibold leading-snug sm:text-base",
              task.completed ? "task-title-done" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {task.title}
          </h3>

          {task.completed && (
            <em className="task-done-badge">Done</em>
          )}
        </div>

        {/* DESCRIPTION */}

        {task.description && !task.completed && (
          <p className="task-description text-[13px] leading-relaxed">
            {task.description}
          </p>
        )}

        {/* DURATION AND SCHEDULE */}

        {(task.duration > 0 ||
          (task.startTime && task.endTime)) && (
          <div className="task-schedule flex flex-wrap items-center gap-x-4 gap-y-2">
            {task.duration > 0 && (
              <span className="task-duration inline-flex shrink-0 flex-row items-center gap-1.5 whitespace-nowrap">
                <Timer
                  size={13}
                  className="shrink-0"
                  aria-hidden="true"
                />
                <span>{task.duration} min</span>
              </span>
            )}

            {task.startTime && task.endTime && (
              <div
                className="
                  !flex !shrink-0 !flex-row
                  !items-center !justify-start
                  !gap-1.5 !whitespace-nowrap
                "
              >
                <Clock3
                  size={13}
                  className="shrink-0"
                  aria-hidden="true"
                />

                <span className="inline-flex flex-row items-center gap-1 whitespace-nowrap text-[12px] font-medium leading-normal text-[var(--ink)]">
                  <time>{task.startTime}</time>

                  <span
                    className="task-time-sep"
                    aria-hidden="true"
                  >
                    –
                  </span>

                  <time>{task.endTime}</time>
                </span>
              </div>
            )}
          </div>
        )}

        {/* ACTIVE TIMER STATUS */}

        {isActive && (
          <p className="task-occurrence-state active">
            Started{" "}
            {occurrence?.startedAt
              ? new Date(
                  occurrence.startedAt,
                ).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "now"}

            {" "}· ends{" "}

            {occurrence?.endAt
              ? new Date(
                  occurrence.endAt,
                ).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "soon"}
          </p>
        )}

        {/* ========================================
            COLLAPSIBLE SUBTASK LIST

            Use divs instead of ul/li to avoid native
            list markers and existing li pseudo-elements.
        ======================================== */}

        {subtasks.length > 0 && (
          <section className="mt-3 w-full min-w-0">
            {/* ALWAYS VISIBLE COLLAPSE HEADER */}

            <div className="flex w-full items-center justify-between gap-2 px-1">
              <button
                type="button"
                aria-expanded={subtasksExpanded}
                aria-controls={`subtasks-${task._id}`}
                onClick={() =>
                  setSubtasksExpanded((expanded) => !expanded)
                }
                className="
                  inline-flex min-w-0 flex-1 items-center
                  justify-start gap-2 rounded-md py-1 text-left
                  text-[11px] font-semibold text-[var(--quiet)]
                  focus-visible:outline
                  focus-visible:outline-2
                  focus-visible:outline-[hsl(var(--primary))]
                "
              >
                <ChevronDown
                  size={13}
                  className={`shrink-0 transition-transform duration-150 ${
                    subtasksExpanded ? "" : "-rotate-90"
                  }`}
                  aria-hidden="true"
                />

                <span>Subtasks</span>

                <span className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                  {subtasks.length}
                </span>
              </button>

              <span className="shrink-0 text-[10px] font-medium tabular-nums text-[var(--quiet)]">
                {completedSubtaskCount}/{subtasks.length} done
              </span>
            </div>

            {/* ROWS */}

            <div
              id={`subtasks-${task._id}`}
              role="list"
              className="subtask-list !mt-1 !w-full !min-w-0 !border-0 !p-0"
              style={{
                display: subtasksExpanded ? "grid" : "none",
                gap: 2,
                width: "100%",
                minWidth: 0,
                margin: "4px 0 0",
                padding: 0,
                border: 0,
                listStyle: "none",
              }}
            >
              {subtasks.map((subtask, index) => (
                <div
                  key={index}
                  role="listitem"
                  className="w-full min-w-0"
                  style={{
                    display: "block",
                    width: "100%",
                    minWidth: 0,
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={subtask.completed}
                    aria-label={`${
                      subtask.completed
                        ? "Mark incomplete"
                        : "Mark complete"
                    }: ${subtask.title}`}
                    onClick={() => toggleSubtask(index)}
                    className="
                      group flex w-full min-w-0
                      items-start gap-2.5
                      rounded-md px-3 py-2.5 text-left
                      focus-visible:outline
                      focus-visible:outline-2
                      focus-visible:outline-[hsl(var(--primary))]
                    "
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 10,
                      width: "100%",
                      minWidth: 0,
                      minHeight: 0,
                      margin: 0,
                      padding: "8px 12px",
                      border: 0,
                      borderRadius: 6,
                      background: "transparent",
                      color: subtask.completed
                        ? "var(--quiet)"
                        : "var(--ink)",
                      font: "inherit",
                      fontSize: 12,
                      lineHeight: 1.6,
                      textAlign: "left",
                      textDecoration: "none",
                      cursor: "pointer",
                      transition: "none",
                    }}
                  >
                    {/* COMPACT, SUBTLE CHECKBOX */}

                    <span
                      aria-hidden="true"
                      style={{
                        boxSizing: "border-box",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 13,
                        height: 13,
                        minWidth: 13,
                        flexShrink: 0,
                        marginTop: 3,
                        padding: 0,
                        border: subtask.completed
                          ? "1px solid hsl(var(--border) / 0.55)"
                          : "1px solid hsl(var(--border) / 0.65)",
                        borderRadius: 3,
                        background: subtask.completed
                          ? "hsl(var(--secondary) / 0.32)"
                          : "transparent",
                        color: "var(--quiet)",
                      }}
                    >
                      {subtask.completed && (
                        <Check size={9} strokeWidth={2.5} />
                      )}
                    </span>

                    {/* SUBTASK TEXT */}

                    <span
                      className="min-w-0 flex-1 break-words text-[12px] leading-relaxed"
                      style={{
                        display: "block",
                        width: "100%",
                        height: "auto",
                        minWidth: 0,
                        margin: 0,
                        padding: 0,
                        border: 0,
                        borderRadius: 0,
                        background: "transparent",
                        color: subtask.completed
                          ? "var(--quiet)"
                          : "var(--ink)",
                        overflowWrap: "anywhere",
                        textDecoration: "none",
                      }}
                    >
                      {subtask.title}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================
            ADD SUBTASK
            Kept below the list
        ======================================== */}

        {!task.completed &&
          (adding ? (
            <form
              className="
                subtask-form mt-2 flex w-full min-w-0
                flex-wrap items-center gap-1.5
              "
              onSubmit={addSubtask}
            >
              <input
                name="title"
                aria-label={`New subtask for ${task.title}`}
                placeholder="Subtask name..."
                autoFocus
                required
                className="
                  !h-7 !min-h-0 min-w-0 flex-1
                  !px-2 !text-xs
                "
              />

              <button
                type="submit"
                className="
                  !inline-flex !h-7 !min-h-0 shrink-0
                  items-center justify-center gap-1
                  !px-2.5 !text-xs
                "
              >
                <Check size={13} aria-hidden="true" />
                Add
              </button>

              <button
                type="button"
                onClick={() => setAdding(false)}
                className="
                  !inline-flex !h-7 !min-h-0 shrink-0
                  items-center justify-center
                  !px-2.5 !text-xs
                "
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="
                subtask-add mt-2
                !flex w-full items-center justify-start gap-2
                rounded-md px-2 py-1.5
                text-[11px] font-medium
                transition-colors
              "
            >
              <Plus size={13} aria-hidden="true" />
              Add subtask
            </button>
          ))}
      </div>
    </article>
  );
}
