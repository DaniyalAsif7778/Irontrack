import { isBlock, isDayType } from "../constant.js";

export function taskPayload(input: any, partial = false) {
  const out: Record<string, unknown> = {};
  if (!partial || input.dayType !== undefined) { if (!isDayType(input.dayType)) throw new Error("dayType must be weekday or weekend"); out.dayType = input.dayType; }
  if (!partial || input.block !== undefined) { if (!isBlock(input.block)) throw new Error("block must be a fixed prayer block"); out.block = input.block; }
  if (!partial || input.title !== undefined) { if (typeof input.title !== "string" || !input.title.trim()) throw new Error("title is required"); out.title = input.title.trim(); }
  for (const key of ["description", "type", "category", "dueDate", "reminderTime"] as const) if (input[key] !== undefined) { if (typeof input[key] !== "string") throw new Error(`${key} must be text`); out[key] = input[key]; }
  if (input.priority !== undefined) { if (!["low", "medium", "high"].includes(input.priority)) throw new Error("invalid priority"); out.priority = input.priority; }
  if (input.duration !== undefined) { if (!Number.isFinite(input.duration) || input.duration < 0 || input.duration > 1440) throw new Error("duration must be 0–1440 minutes"); out.duration = input.duration; }
  if (input.subtasks !== undefined) { if (!Array.isArray(input.subtasks) || input.subtasks.some((s: any) => typeof s?.title !== "string" || !s.title.trim())) throw new Error("subtasks must have titles"); out.subtasks = input.subtasks.map((s: any) => ({ title: s.title.trim(), completed: Boolean(s.completed) })); }
  return out;
}

export function weightPayload(input: any) { if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) throw new Error("date must be YYYY-MM-DD"); if (!Number.isFinite(input.weight) || input.weight <= 0 || input.weight > 1000) throw new Error("weight must be between 0 and 1000"); if (!["kg", "lb"].includes(input.unit)) throw new Error("unit must be kg or lb"); return { date: input.date, weight: input.weight, unit: input.unit }; }
