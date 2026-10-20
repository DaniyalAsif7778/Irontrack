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
  taskBlock?: boolean;
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
      taskBlock: parsed.taskBlock === true,
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

  useEffect(() => { window.dispatchEvent(new CustomEvent("routine-timer-update", { detail: { taskId: timer?.taskId ?? null } })); }, [timer?.taskId]);

  useEffect(() => {
    function start(event: Event) {
      const { taskId, taskTitle, taskBlockMinutes } = (event as CustomEvent<{ taskId: string; taskTitle: string; taskBlockMinutes?: number }>).detail;
      const durationMs = (taskBlockMinutes ?? focusMinutes) * 60_000;
      setTimer({ taskId, taskTitle, phase: "focus", remainingMs: durationMs, startedAt: Date.now(), focusLengthMs: durationMs, breakLengthMs: breakMinutes * 60_000, taskBlock: taskBlockMinutes !== undefined });
      window.dispatchEvent(new CustomEvent("routine-timer-update", { detail: { taskId } }));
    }
    function extend(event: Event) {
      const { taskId } = (event as CustomEvent<{ taskId: string }>).detail;
      setTimer(current => current?.taskId === taskId ? { ...current, phase: "focus", remainingMs: 15 * 60_000, focusLengthMs: 15 * 60_000, startedAt: Date.now(), taskBlock: true } : current);
    }
    function stop(event: Event) {
      const { taskId } = (event as CustomEvent<{ taskId: string }>).detail;
      setTimer(current => current?.taskId === taskId ? null : current);
    }
    window.addEventListener("irontrack:start-task-timer", start);
    window.addEventListener("irontrack:extend-task-timer", extend);
    window.addEventListener("irontrack:stop-task-timer", stop);
    return () => { window.removeEventListener("irontrack:start-task-timer", start); window.removeEventListener("irontrack:extend-task-timer", extend); window.removeEventListener("irontrack:stop-task-timer", stop); };
  }, [focusMinutes, breakMinutes]);

  useEffect(() => {
    if (!timer?.startedAt) return;
    const interval = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (remaining(timer, tick) > 0) return;
      if (timer.taskBlock && timer.phase === "focus") {
        setTimer({ ...timer, remainingMs: 0, startedAt: null });
        if ("Notification" in window && Notification.permission === "granted") new Notification("Focus block complete", { body: `${timer.taskTitle} needs a finish or 15-minute extension.`, tag: `irontrack-task-${timer.taskId}` });
        return;
      }
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

  function close() {
    window.dispatchEvent(new CustomEvent("routine-timer-update", { detail: { taskId: null } }));
    setTimer(null);
  }

  const total = timer.phase === "focus" ? timer.focusLengthMs : timer.breakLengthMs;
  const progress = Math.max(0, Math.min(1, left / total));
  const radius = 44, circumference = 2 * Math.PI * radius;
  return <aside className="routine-timer" aria-label="Routine focus timer">
    <div className="timer-head"><div className={`timer-symbol ${timer.phase}`}>{timer.phase === "focus" ? <Timer size={17} /> : <Coffee size={17} />}<span>{timer.phase === "focus" ? `Focus — ${Math.round(total / 60_000)} min` : `Break — ${Math.round(total / 60_000)} min`}{paused ? " · Paused" : ""}</span></div><button type="button" onClick={close} aria-label="Close timer"><X size={14} /></button></div>
    <p className="timer-task-name">{timer.taskTitle}</p>
    <div className="timer-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" /><circle cx="50" cy="50" r={radius} fill="none" stroke={timer.phase === "focus" ? "hsl(var(--primary))" : "hsl(var(--accent))"} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round" /></svg><time>{clock(left)}</time></div>
    <div className="timer-controls">
      <button type="button" onClick={pauseOrResume} aria-label={paused ? "Resume timer" : "Pause timer"}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
      <button type="button" onClick={reset} aria-label="Reset timer"><RotateCcw size={15} /></button>
      <button type="button" onClick={close} aria-label="Stop timer"><X size={16} /></button>
    </div>
  </aside>;
}
