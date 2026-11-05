import { BLOCKS, isBlock, isDayType, type Block } from "../constant.js";
import { isValidDateKey } from "./dateValidation.js";

export class TaskPayloadError extends Error {
  readonly statusCode = 400;
}

function requireRecord(input: unknown, label: string): asserts input is Record<string, any> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label} must be an object`);
}

type PrayerTimes = Record<Block, string>;
const timeMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const validTime = (time: unknown): time is string => typeof time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);

export function taskPayload(input: any, partial = false, prayerTimes?: PrayerTimes) {
  requireRecord(input, "Routine task");
  const out: Record<string, unknown> = {};
  if (!partial || input.dayType !== undefined) { if (!isDayType(input.dayType)) throw new Error("dayType must be weekday or weekend"); out.dayType = input.dayType; }
  if (!partial || input.block !== undefined) { if (!isBlock(input.block)) throw new Error("block must be a fixed prayer block"); out.block = input.block; }
  if (!partial || input.title !== undefined) { if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 160) throw new Error("title must contain 1 to 160 characters"); out.title = input.title.trim(); }
  const textLimits = { description: 4000, type: 50, category: 80, dueDate: 10, reminderTime: 5 } as const;
  for (const [key, maxLength] of Object.entries(textLimits) as [keyof typeof textLimits, number][]) if (input[key] !== undefined) {
    if (typeof input[key] !== "string" || input[key].length > maxLength) throw new Error(`${key} must be text under ${maxLength + 1} characters`);
    out[key] = input[key];
  }
  if (typeof input.dueDate === "string" && input.dueDate && !isValidDateKey(input.dueDate)) throw new Error("dueDate must be a real YYYY-MM-DD calendar date");
  if (typeof input.reminderTime === "string" && input.reminderTime && !validTime(input.reminderTime)) throw new Error("reminderTime must be a valid 24-hour time");
  for (const key of ["startTime", "endTime"] as const) if (input[key] !== undefined) { if (typeof input[key] !== "string" || (input[key] && !validTime(input[key]))) throw new Error(`${key} must be a valid 24-hour time`); out[key] = input[key]; }
  if (Boolean(out.startTime) !== Boolean(out.endTime)) throw new Error("Provide both task block start and end times, or leave both empty");
  if (typeof out.startTime === "string" && out.startTime && typeof out.endTime === "string" && out.endTime && out.endTime <= out.startTime) throw new Error("Task end time must be after its start time");
  if (input.priority !== undefined) { if (!["low", "medium", "high"].includes(input.priority)) throw new Error("invalid priority"); out.priority = input.priority; }
  if (input.duration !== undefined) { if (!Number.isFinite(input.duration) || input.duration < 0 || input.duration > 1440) throw new Error("duration must be 0–1440 minutes"); out.duration = input.duration; }

  const startTime = typeof input.startTime === "string" ? input.startTime : "";
  const endTime = typeof input.endTime === "string" ? input.endTime : "";
  const reminderTime = typeof input.reminderTime === "string" ? input.reminderTime : "";
  const block = input.block as Block | undefined;
  if (startTime || endTime || reminderTime) {
    const blockIndex = block ? BLOCKS.indexOf(block) : -1;
    const startAnchor = blockIndex >= 0 ? prayerTimes?.[block!] : undefined;
    const nextBlock = blockIndex >= 0 ? BLOCKS[blockIndex + 1] : undefined;
    const endAnchor = nextBlock ? prayerTimes?.[nextBlock] : undefined;
    if (!validTime(startAnchor) || (nextBlock && !validTime(endAnchor))) {
      throw new TaskPayloadError(`Set the ${block ?? "selected"} and next prayer times in Settings before scheduling this task.`);
    }

    const startBoundary = timeMinutes(startAnchor);
    const endBoundary = endAnchor ? timeMinutes(endAnchor) : 24 * 60;
    if (endBoundary <= startBoundary) throw new TaskPayloadError("Prayer times must be in Fajr-to-Isha order.");
    if (startTime && timeMinutes(startTime) < startBoundary) throw new TaskPayloadError(`Task must start at or after ${startAnchor}.`);
    if (endTime && timeMinutes(endTime) > endBoundary) {
      throw new TaskPayloadError(`Task must finish before ${nextBlock ?? "midnight"} (${endAnchor ?? "24:00"}).`);
    }
    if (startTime && endTime) {
      const duration = typeof out.duration === "number" ? out.duration : timeMinutes(endTime) - timeMinutes(startTime);
      if (duration < 1 || timeMinutes(endTime) - timeMinutes(startTime) !== duration) {
        throw new TaskPayloadError("Task end time must match its block duration.");
      }
      out.duration = duration;
    }
    if (reminderTime) {
      if (!validTime(reminderTime)) throw new TaskPayloadError("Reminder time must be a valid 24-hour time.");
      if (timeMinutes(reminderTime) < startBoundary || timeMinutes(reminderTime) >= endBoundary) {
        throw new TaskPayloadError("Reminder time must be inside the selected prayer block.");
      }
    }
  }

  if (input.subtasks !== undefined) {
    if (!Array.isArray(input.subtasks) || input.subtasks.length > 20 || input.subtasks.some((s: any) => !s || typeof s !== "object" || Array.isArray(s) || typeof s.title !== "string" || !s.title.trim() || s.title.trim().length > 160 || (s.completed !== undefined && typeof s.completed !== "boolean"))) throw new Error("subtasks must contain up to 20 titled items with valid completion values");
    out.subtasks = input.subtasks.map((s: any) => ({ title: s.title.trim(), completed: s.completed ?? false }));
  }
  return out;
}

export function weightPayload(input: any) {
  if (!input || typeof input !== "object" || Array.isArray(input) || !isValidDateKey(input.date)) throw new Error("date must be a real YYYY-MM-DD calendar date");
  if (!Number.isFinite(input.weight) || input.weight <= 0 || input.weight > 1000) throw new Error("weight must be between 0 and 1000");
  if (!["kg", "lb"].includes(input.unit)) throw new Error("unit must be kg or lb");
  return { date: input.date, weight: input.weight, unit: input.unit };
}

export function weightLogLimit(input: unknown) {
  if (input === undefined || input === null) return 100;
  if (typeof input !== "string" || !/^\d+$/.test(input)) throw new Error("limit must be a whole number");
  const parsed = Number(input);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) throw new Error("limit must be between 1 and 100");
  return parsed;
}
