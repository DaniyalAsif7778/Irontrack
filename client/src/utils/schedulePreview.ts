import type { PrayerTimes, Schedule, Task } from "../types";

const prayerBlocks = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type PreviewTask = { task: Task; block: string };
export type ShiftPreview = { id: string; title: string; fromBlock: string; toBlock: string; startTime: string; endTime: string; carriedToTomorrow: boolean };

const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const fromMinutes = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export function flattenSchedule(schedule: Schedule | null) {
  return (schedule?.blocks ?? []).flatMap(block => block.tasks.map(task => ({ task, block: block.id })));
}

export function previewScheduleDelay(schedule: Schedule | null, sourceTaskId: string, delayMinutes: number, prayerTimes: PrayerTimes): ShiftPreview[] {
  const tasks = flattenSchedule(schedule);
  const sourceIndex = tasks.findIndex(item => item.task._id === sourceTaskId);
  if (sourceIndex < 0 || !Number.isInteger(delayMinutes) || delayMinutes < 1) return [];

  const anchors = new Map(Object.entries(prayerTimes).filter(([, value]) => timePattern.test(value)).map(([block, value]) => [block, toMinutes(value)]));
  return tasks.slice(sourceIndex + 1).flatMap<ShiftPreview>(({ task, block }) => {
    if (!timePattern.test(task.startTime) || !timePattern.test(task.endTime)) return [];
    const shiftedStart = toMinutes(task.startTime) + delayMinutes;
    const shiftedEnd = toMinutes(task.endTime) + delayMinutes;
    const startDayOffset = Math.floor(shiftedStart / 1440);
    const endDayOffset = Math.floor(shiftedEnd / 1440);
    const endTime = shiftedEnd % 1440;
    const carriedToTomorrow = startDayOffset > 0 || endDayOffset > 0 || endTime >= 21 * 60;
    if (carriedToTomorrow) return [{ id: task._id, title: task.title, fromBlock: block, toBlock: "isha", startTime: "20:15", endTime: "21:00", carriedToTomorrow: true }];

    const currentIndex = prayerBlocks.indexOf(block as typeof prayerBlocks[number]);
    const target = currentIndex < 0 ? undefined : prayerBlocks.slice(currentIndex + 1).filter(prayer => {
      const boundary = anchors.get(prayer);
      return boundary !== undefined && shiftedStart >= boundary;
    }).at(-1);
    return [{
      id: task._id, title: task.title, fromBlock: block, toBlock: target ?? block,
      startTime: fromMinutes(shiftedStart), endTime: fromMinutes(shiftedEnd), carriedToTomorrow: false,
    }];
  });
}
