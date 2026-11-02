import type { PrayerTimes, Task } from "../types";

const prayerOrder = [
  ["fajr", "Fajr"],
  ["dhuhr", "Dhuhr"],
  ["asr", "Asr"],
  ["maghrib", "Maghrib"],
  ["isha", "Isha"],
] as const;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type PrayerWindow = {
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  nextPrayer: string | null;
};

function toMinutes(value: string) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function timeAt(minutes: number) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function prayerWindow(block: string, prayerTimes: PrayerTimes): PrayerWindow | null {
  const index = prayerOrder.findIndex(([key]) => key === block);
  if (index < 0) return null;
  const current = prayerOrder[index];
  if (!current) return null;
  const [key] = current;
  const next = prayerOrder[index + 1];
  const startTime = prayerTimes[key];
  if (!timePattern.test(startTime)) return null;
  const startMinutes = toMinutes(startTime);
  const endTime = next ? prayerTimes[next[0]] : "";
  const endMinutes = next ? timePattern.test(endTime) ? toMinutes(endTime) : -1 : 24 * 60;
  if (endMinutes <= startMinutes) return null;
  return { startTime, endTime: next ? endTime : "24:00", startMinutes, endMinutes, nextPrayer: next?.[1] ?? null };
}

export function calculateEndTime(startTime: string, duration: number) {
  if (!timePattern.test(startTime) || !Number.isInteger(duration) || duration < 1) return "";
  return timeAt(toMinutes(startTime) + duration);
}

export function taskTimingError(
  block: string,
  startTime: string,
  endTime: string,
  duration: number,
  prayerTimes: PrayerTimes,
  otherTasks: Task[] = [],
  excludeTaskId?: string,
): string | null {
  if (!startTime && !endTime) return null;
  const window = prayerWindow(block, prayerTimes);
  if (!window) return `Set the ${block} and next prayer times in Settings before scheduling this task.`;
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) return "Choose a start time and a valid block duration.";
  if (!Number.isInteger(duration) || duration < 1) return "A scheduled task needs a duration of at least 1 minute.";

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start < window.startMinutes) return `Choose a start at or after ${window.startTime}.`;
  if (end !== start + duration) return "The end time must match the selected duration.";
  if (end > window.endMinutes) {
    return window.nextPrayer
      ? `This task must finish by ${window.endTime}, before ${window.nextPrayer}. Shorten the duration or choose an earlier start.`
      : "This task must finish before midnight. Shorten the duration or choose an earlier start.";
  }

  const overlaps = otherTasks.some(task => {
    if (task._id === excludeTaskId || !timePattern.test(task.startTime) || !timePattern.test(task.endTime)) return false;
    return start < toMinutes(task.endTime) && end > toMinutes(task.startTime);
  });
  return overlaps ? "This time overlaps another task in the same prayer block." : null;
}

export function prayerTimesAreOrdered(prayerTimes: PrayerTimes) {
  const configured = prayerOrder.map(([key]) => prayerTimes[key]).filter(Boolean);
  return configured.every((time, index) => index === 0 || time > configured[index - 1]);
}
