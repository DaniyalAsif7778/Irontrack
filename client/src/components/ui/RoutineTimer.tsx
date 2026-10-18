import { useEffect, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, Timer, X } from "lucide-react";

type Phase = "focus" | "break";
type TimerState = {
  taskId: string;
  taskTitle: string;
  phase: Phase;
  remainingMs: number;
  startedAt: number | null;
  focusLengthMs: number;
  breakLengthMs: number;
};

function remaining(state: TimerState, now: number) {
  return Math.max(0, state.remainingMs - (state.startedAt === null ? 0 : now - state.startedAt));
}

function readTimer(storageKey: string): TimerState | null {
  try {
    const value = localStorage.getItem(storageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as TimerState;
    if (typeof parsed.taskId !== "string" || typeof parsed.taskTitle !== "string" ||
      !["focus", "break"].includes(parsed.phase) || typeof parsed.remainingMs !== "number") return null;
    return {
      ...parsed,
      focusLengthMs: typeof parsed.focusLengthMs === "number" ? parsed.focusLengthMs : 45 * 60_000,
      breakLengthMs: typeof parsed.breakLengthMs === "number" ? parsed.breakLengthMs : 15 * 60_000,
    };
  } catch {
    return null;
  }
}

function clock(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function RoutineTimer({ focusMinutes = 45, breakMinutes = 15, userId = "local-demo" }: { focusMinutes?: number; breakMinutes?: number; userId?: string }) {
  const storageKey = `irontrack_task_timer:${userId}`;
  const [timer, setTimer] = useState<TimerState | null>(() => readTimer(storageKey));
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!timer) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(timer));
  }, [timer, storageKey]);

  useEffect(() => {
    function start(event: Event) {
      const { taskId, taskTitle } = (event as CustomEvent<{ taskId: string; taskTitle: string }>).detail;
      setTimer({ taskId, taskTitle, phase: "focus", remainingMs: focusMinutes * 60_000, startedAt: Date.now(), focusLengthMs: focusMinutes * 60_000, breakLengthMs: breakMinutes * 60_000 });
    }
    window.addEventListener("irontrack:start-task-timer", start);
    return () => window.removeEventListener("irontrack:start-task-timer", start);
  }, [focusMinutes, breakMinutes]);

  useEffect(() => {
    if (!timer?.startedAt) return;
    const interval = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (remaining(timer, tick) > 0) return;
      const phase: Phase = timer.phase === "focus" ? "break" : "focus";
      setTimer({ ...timer, phase, remainingMs: phase === "focus" ? timer.focusLengthMs : timer.breakLengthMs, startedAt: tick });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(phase === "break" ? "Focus session complete" : "Break finished", {
          body: phase === "break" ? `Take a ${Math.round(timer.breakLengthMs / 60_000)} minute break.` : "Ready for another focus session?",
          tag: "irontrack-routine-timer",
        });
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [timer]);

  if (!timer) return null;
  const activeTimer = timer;
  const left = remaining(activeTimer, now);
  const paused = activeTimer.startedAt === null;
  function pauseOrResume() {
    if (paused) setTimer({ ...activeTimer, startedAt: Date.now() });
    else setTimer({ ...activeTimer, remainingMs: left, startedAt: null });
  }
  function reset() {
    setTimer({ ...activeTimer, remainingMs: activeTimer.phase === "focus" ? activeTimer.focusLengthMs : activeTimer.breakLengthMs, startedAt: Date.now() });
  }

  return <aside className="routine-timer" aria-label="Routine focus timer">
    <div className={`timer-symbol ${timer.phase}`}>{timer.phase === "focus" ? <Timer size={17} /> : <Coffee size={17} />}</div>
    <div className="timer-copy"><span>{timer.phase === "focus" ? "Focus session" : "Break"}{paused ? " · Paused" : ""}</span><strong>{timer.taskTitle}</strong></div>
    <time className="timer-clock">{clock(left)}</time>
    <div className="timer-controls">
      <button type="button" onClick={pauseOrResume} aria-label={paused ? "Resume timer" : "Pause timer"}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
      <button type="button" onClick={reset} aria-label="Reset timer"><RotateCcw size={15} /></button>
      <button type="button" onClick={() => setTimer(null)} aria-label="Stop timer"><X size={16} /></button>
    </div>
  </aside>;
}
