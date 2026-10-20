import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { BLOCKS } from "../../constant.js";
import { User } from "../../models/auth/user.model.js";
import { RoutineCompletion, RoutineEvent, RoutineReminder, RoutineTask, RoutineTaskOccurrence } from "../../models/routine/routine.model.js";
import { sendOwnerPush } from "../notifications/push.service.js";

const BASE_WORK_MINUTES = 45;
const EXTENSION_MINUTES = 15;

export function nextPrayerBlockForShift(currentBlock: string, shiftedStartMinute: number, anchors: Map<string, number>) {
  const currentIndex = BLOCKS.indexOf(currentBlock as any);
  if (currentIndex < 0) return undefined;
  return BLOCKS.slice(currentIndex + 1).filter(block => {
    const boundary = anchors.get(block);
    return boundary !== undefined && shiftedStartMinute >= boundary;
  }).at(-1);
}

export function shouldCarryAfterCutoff(localTime: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(localTime) && localTime >= "21:00";
}

function localParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function localTimeToDate(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let value = wanted;
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = localParts(new Date(value), timezone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const difference = wanted - represented;
    if (!difference) break;
    value += difference;
  }
  return new Date(value);
}

function validTimezone(timezone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); return true; }
  catch { return false; }
}

export function isValidRoutineDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

async function ensureOccurrences(ownerId: string, date: string, timezone: string) {
  if (!isValidRoutineDate(date)) throw new RoutineActionError("date must be a valid YYYY-MM-DD calendar date", 400);
  if (!validTimezone(timezone)) throw new RoutineActionError("timezone must be a valid IANA timezone", 400);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayType = weekday === 0 || weekday === 6 ? "weekend" : "weekday";
  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const tasks = await RoutineTask.find({ ownerId, dayType }).lean();
  tasks.sort((a, b) => BLOCKS.indexOf(a.block as any) - BLOCKS.indexOf(b.block as any) || a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());
  if (tasks.length) {
    await RoutineTaskOccurrence.bulkWrite(tasks.map(task => {
      const hasBlock = Boolean(task.startTime && task.endTime);
      return { updateOne: {
        filter: { ownerId: ownerObjectId, taskId: task._id, date },
        update: { $setOnInsert: {
          ownerId: ownerObjectId, taskId: task._id, date, dayType, block: task.block,
          startAt: hasBlock ? localTimeToDate(date, task.startTime!, timezone) : null,
          endAt: hasBlock ? localTimeToDate(date, task.endTime!, timezone) : null,
          timezone, workMinutes: BASE_WORK_MINUTES, status: "planned", extensionCount: 0,
        } },
        upsert: true,
      } };
    }), { ordered: false });
  }
  const occurrences = await RoutineTaskOccurrence.find({ ownerId, date }).lean();
  const byTask = new Map(occurrences.map(item => [String(item.taskId), item]));
  const included = new Set(tasks.map(task => String(task._id)));
  const carriedIds = occurrences.filter(item => item.status === "deferred" && !included.has(String(item.taskId))).map(item => item.taskId);
  const carried = carriedIds.length ? await RoutineTask.find({ ownerId, _id: { $in: carriedIds } }).lean() : [];
  const merged = [...tasks, ...carried];
  return merged.map(task => { const occurrence = byTask.get(String(task._id)); return { ...task, ...(occurrence?.block ? { block: occurrence.block } : {}), occurrence: occurrence ?? null }; });
}

async function notifyChange(ownerId: string, occurrence: any, type: string, actionId: string, title: string, body: string, metadata: Record<string, unknown> = {}) {
  const existing = await RoutineEvent.findOne({ ownerId, idempotencyKey: actionId }).lean();
  if (existing) return existing;
  const eventId = actionId;
  let event: any;
  try {
    const reminder = occurrence?.taskId ? await RoutineReminder.findOne({ ownerId, taskId: occurrence.taskId, date: occurrence.date, sentAt: { $ne: null } }).lean() : null;
    const responseTimeMs = reminder?.sentAt ? Math.max(0, Date.now() - new Date(reminder.sentAt).getTime()) : null;
    event = await RoutineEvent.create({ ownerId, eventId, idempotencyKey: actionId, parentEventId: eventId, taskId: occurrence?.taskId ?? null, occurrenceId: occurrence?._id ?? null, date: occurrence?.date ?? "", type, occurredAt: new Date(), responseTimeMs, metadata });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    return RoutineEvent.findOne({ ownerId, idempotencyKey: actionId }).lean();
  }
  await deliverParentEventPush(ownerId, eventId, title, body);
  return event;
}

async function deliverParentEventPush(ownerId: string, eventId: string, title: string, body: string) {
  const delivery = await sendOwnerPush(ownerId, eventId, title, body, "/routine").catch(() => ({ configured: false, subscribed: false, sent: 0, failed: 1 }));
  await RoutineEvent.updateOne({ ownerId, eventId }, { $set: { pushStatus: !delivery.configured || !delivery.subscribed ? "unavailable" : delivery.failed ? "failed" : "sent", pushSentAt: delivery.sent ? new Date() : null } });
}

export async function recordRoutineParentChange(ownerId: string, taskId: string | null, actionId: string, type: string, title: string, body: string, metadata: Record<string, unknown> = {}) {
  return notifyChange(ownerId, taskId ? { taskId, date: "" } : null, type, actionId, title, body, metadata);
}

async function markReminderResponded(ownerId: string, taskId: string, date: string, session?: mongoose.ClientSession) {
  await RoutineReminder.updateOne({ ownerId, taskId, date, status: { $in: ["sent", "ignored", "followup_sent"] } }, { $set: { status: "responded", respondedAt: new Date() } }, session ? { session } : {});
}

export class RoutineActionError extends Error {
  constructor(message: string, readonly status = 409) { super(message); this.name = "RoutineActionError"; }
}

export async function listRoutineOccurrences(ownerId: string, date: string, timezone: string) {
  return ensureOccurrences(ownerId, date, timezone);
}

export async function startRoutineTask(ownerId: string, taskId: string, date: string, timezone: string, actionId: string) {
  if (await RoutineEvent.exists({ ownerId, idempotencyKey: actionId })) return RoutineTaskOccurrence.findOne({ ownerId, taskId, date });
  const tasks = await ensureOccurrences(ownerId, date, timezone);
  const task = tasks.find(item => String(item._id) === taskId);
  if (!task) throw new RoutineActionError("Task not found for this routine day", 404);
  const existing = task.occurrence;
  if (existing?.status === "completed") throw new RoutineActionError("This task is already complete for today");
  if (existing?.status === "active") throw new RoutineActionError("This task is already active");
  const active = await RoutineTaskOccurrence.findOne({ ownerId, status: "active" }).lean();
  if (active && String(active.taskId) !== taskId) throw new RoutineActionError("Finish or complete the active task before starting another");
  const now = new Date();
  const result = await RoutineTaskOccurrence.findOneAndUpdate({ ownerId, taskId, date, status: { $in: ["planned", "queued", "deferred"] } }, { $set: { status: "active", startedAt: now, startAt: now, endAt: new Date(now.getTime() + BASE_WORK_MINUTES * 60_000), timezone, workMinutes: BASE_WORK_MINUTES } }, { new: true, upsert: !existing, setDefaultsOnInsert: true });
  if (!result) throw new RoutineActionError("This task occurrence cannot be started from its current state");
  await markReminderResponded(ownerId, taskId, date);
  await notifyChange(ownerId, result, "task_started", actionId, "Task started", `${task.title} started. Your 45-minute focus block is running.`, { taskTitle: task.title, startAt: result.startAt, endAt: result.endAt });
  return result;
}

export async function queueRoutineTask(ownerId: string, taskId: string, date: string, timezone: string, actionId: string) {
  if (await RoutineEvent.exists({ ownerId, idempotencyKey: actionId })) return RoutineTaskOccurrence.findOne({ ownerId, taskId, date });
  const tasks = await ensureOccurrences(ownerId, date, timezone);
  const task = tasks.find(item => String(item._id) === taskId);
  if (!task) throw new RoutineActionError("Task not found for this routine day", 404);
  const active = await RoutineTaskOccurrence.findOne({ ownerId, status: "active" }).lean();
  if (!active) throw new RoutineActionError("Start a task before choosing the next task");
  if (String(active.taskId) === taskId) throw new RoutineActionError("The active task cannot also be queued");
  if (task.occurrence?.status === "completed") throw new RoutineActionError("This task is already complete for today");
  const previousQueue = await RoutineTaskOccurrence.findOne({ ownerId, status: "queued" }).lean();
  const replacedTask = previousQueue && String(previousQueue.taskId) !== taskId ? await RoutineTask.findOne({ _id: previousQueue.taskId, ownerId }).select("title").lean() : null;
  await RoutineTaskOccurrence.updateMany({ ownerId, status: "queued" }, { $set: { status: "planned", queueOrder: 0 } });
  const occurrence = await RoutineTaskOccurrence.findOneAndUpdate({ ownerId, taskId, date }, { $set: { status: "queued", queueOrder: 1, timezone } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  await notifyChange(ownerId, occurrence, "task_queued", actionId, "Next task queued", `${task.title} is queued and ready when your active task is complete.${replacedTask ? ` ${replacedTask.title} was returned to the routine.` : ""}`, { taskTitle: task.title, activeTaskId: active._id, replacedTaskTitle: replacedTask?.title ?? null });
  return occurrence;
}

async function shiftFollowingTasks(ownerId: string, date: string, currentTaskId: string, minutes: number, parentEventId: string, session: mongoose.ClientSession) {
  const dayType = new Date(`${date}T12:00:00Z`).getUTCDay() === 0 || new Date(`${date}T12:00:00Z`).getUTCDay() === 6 ? "weekend" : "weekday";
  const tasks = await RoutineTask.find({ ownerId, dayType }).session(session).lean();
  tasks.sort((a, b) => BLOCKS.indexOf(a.block as any) - BLOCKS.indexOf(b.block as any) || a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());
  const index = tasks.findIndex(task => String(task._id) === currentTaskId);
  const later = tasks.slice(index + 1);
  const ids = later.map(task => task._id);
  const owner = await User.findById(ownerId).select("preferences.prayerTimes").session(session).lean();
  const prayerTasks = await RoutineTask.find({ ownerId, dayType, block: { $in: BLOCKS }, $or: [{ type: /^prayer$/i }, { title: /^prayer$/i }] }).select("block startTime reminderTime").session(session).lean();
  const prayerAnchors = new Map<string, number>();
  for (const [block, anchor] of Object.entries(owner?.preferences?.prayerTimes ?? {})) {
    if (anchor && /^([01]\d|2[0-3]):[0-5]\d$/.test(anchor)) prayerAnchors.set(block, Number(anchor.slice(0, 2)) * 60 + Number(anchor.slice(3)));
  }
  for (const task of prayerTasks) {
    const anchor = task.startTime || task.reminderTime;
    if (anchor && /^([01]\d|2[0-3]):[0-5]\d$/.test(anchor) && !prayerAnchors.has(task.block)) prayerAnchors.set(task.block, Number(anchor.slice(0, 2)) * 60 + Number(anchor.slice(3)));
  }
  const occurrences = await RoutineTaskOccurrence.find({ ownerId, date, taskId: { $in: ids }, status: { $nin: ["completed", "deferred"] } }).session(session);
  const delta = minutes * 60_000;
  const shiftedTaskIds: string[] = [];
  for (const occurrence of occurrences) {
    const originalDate = occurrence.date;
    const nextStart = occurrence.startAt ? new Date(occurrence.startAt.getTime() + delta) : null;
    const nextEnd = occurrence.endAt ? new Date(occurrence.endAt.getTime() + delta) : null;
    const endParts = nextEnd ? localParts(nextEnd, occurrence.timezone) : null;
    const endDate = endParts ? `${endParts.year}-${endParts.month}-${endParts.day}` : originalDate;
    const endTime = endParts ? `${endParts.hour}:${endParts.minute}` : "";
    if (nextEnd && (endDate > originalDate || shouldCarryAfterCutoff(endTime))) {
      const nextDate = new Date(`${originalDate}T12:00:00Z`); nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      occurrence.date = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
      const weekday = new Date(`${occurrence.date}T12:00:00Z`).getUTCDay();
      occurrence.dayType = weekday === 0 || weekday === 6 ? "weekend" : "weekday";
      occurrence.status = "deferred";
      occurrence.block = "isha";
      occurrence.startAt = localTimeToDate(occurrence.date, "20:15", occurrence.timezone);
      occurrence.endAt = new Date(occurrence.startAt.getTime() + BASE_WORK_MINUTES * 60_000);
    } else {
      occurrence.startAt = nextStart;
      occurrence.endAt = nextEnd;
      if (nextStart) {
        const parts = localParts(nextStart, occurrence.timezone);
        const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
        const target = nextPrayerBlockForShift(occurrence.block, minuteOfDay, prayerAnchors);
        if (target) occurrence.block = target;
      }
    }
    occurrence.lastParentEventId = parentEventId;
    if (originalDate !== occurrence.date) {
      const destination = await RoutineTaskOccurrence.findOne({ ownerId, taskId: occurrence.taskId, date: occurrence.date, _id: { $ne: occurrence._id } }).session(session);
      if (destination) {
        destination.set({ dayType: occurrence.dayType, block: occurrence.block, status: "deferred", startAt: occurrence.startAt, endAt: occurrence.endAt, timezone: occurrence.timezone, workMinutes: occurrence.workMinutes, lastParentEventId: parentEventId });
        await occurrence.deleteOne({ session });
        await destination.save({ session });
      } else await occurrence.save({ session });
    } else await occurrence.save({ session });
    shiftedTaskIds.push(String(occurrence.taskId));
  }
  const shifted = await RoutineTask.find({ ownerId, _id: { $in: shiftedTaskIds } }).select("_id title").lean();
  return shiftedTaskIds.map(id => shifted.find(task => String(task._id) === id)?.title).filter((title): title is string => Boolean(title));
}

export async function extendRoutineTask(ownerId: string, taskId: string, date: string, actionId: string) {
  if (await RoutineEvent.exists({ ownerId, idempotencyKey: actionId })) return { occurrence: await RoutineTaskOccurrence.findOne({ ownerId, taskId, date }), shiftedTaskTitles: [] };
  const session = await mongoose.startSession();
  let occurrence: any = null, shifted: string[] = [], taskTitle = "Task", applied = false;
  try {
    await session.withTransaction(async () => {
      if (await RoutineEvent.exists({ ownerId, idempotencyKey: actionId }).session(session)) return;
      occurrence = await RoutineTaskOccurrence.findOne({ ownerId, taskId, date, status: "active" }).session(session);
      if (!occurrence) throw new RoutineActionError("No active task block was found");
      if (occurrence.endAt && occurrence.endAt.getTime() > Date.now()) throw new RoutineActionError("You can add time after the current 45-minute block ends");
      occurrence.endAt = new Date((occurrence.endAt?.getTime() ?? Date.now()) + EXTENSION_MINUTES * 60_000);
      occurrence.workMinutes += EXTENSION_MINUTES;
      occurrence.extensionCount += 1;
      await occurrence.save({ session });
      shifted = await shiftFollowingTasks(ownerId, date, taskId, EXTENSION_MINUTES, actionId, session);
      taskTitle = (await RoutineTask.findOne({ _id: taskId, ownerId }).select("title").session(session).lean())?.title ?? "Task";
      await markReminderResponded(ownerId, taskId, date, session);
      const summary = shifted.length ? ` Moved ${shifted.length} later task${shifted.length === 1 ? "" : "s"}: ${shifted.slice(0, 4).join(", ")}${shifted.length > 4 ? ", and more" : ""}.` : " No later tasks needed to move.";
      await RoutineEvent.create([{ ownerId, eventId: actionId, idempotencyKey: actionId, parentEventId: actionId, taskId, occurrenceId: occurrence._id, date, type: "task_extended", occurredAt: new Date(), metadata: { taskTitle, extensionMinutes: EXTENSION_MINUTES, shiftedTaskTitles: shifted } }], { session });
      applied = true;
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const prior = await RoutineEvent.findOne({ ownerId, idempotencyKey: actionId }).lean();
    if (!prior) throw error;
    return { occurrence: await RoutineTaskOccurrence.findOne({ ownerId, taskId, date }), shiftedTaskTitles: [] };
  } finally { await session.endSession(); }
  if (applied) await deliverParentEventPush(ownerId, actionId, "15 minutes added", `${taskTitle} has 15 more minutes.${shifted.length ? ` Moved ${shifted.length} later task${shifted.length === 1 ? "" : "s"}: ${shifted.slice(0, 4).join(", ")}${shifted.length > 4 ? ", and more" : ""}.` : " No later tasks needed to move."}`);
  else return { occurrence: await RoutineTaskOccurrence.findOne({ ownerId, taskId, date }), shiftedTaskTitles: [] };
  return { occurrence, shiftedTaskTitles: shifted };
}

export async function snoozeRoutineTask(ownerId: string, taskId: string, date: string, minutes: number, actionId: string) {
  if (await RoutineEvent.exists({ ownerId, idempotencyKey: actionId })) return { occurrence: await RoutineTaskOccurrence.findOne({ ownerId, taskId, date }), shiftedTaskTitles: [] };
  if (![1, 5, 10].includes(minutes)) throw new RoutineActionError("Choose a 1, 5, or 10 minute snooze", 400);
  const session = await mongoose.startSession();
  let occurrence: any = null, shifted: string[] = [], taskTitle = "Task", applied = false;
  try {
    await session.withTransaction(async () => {
      if (await RoutineEvent.exists({ ownerId, idempotencyKey: actionId }).session(session)) return;
      occurrence = await RoutineTaskOccurrence.findOne({ ownerId, taskId, date, status: { $in: ["planned", "queued", "deferred"] } }).session(session);
      if (!occurrence) throw new RoutineActionError("Task occurrence not found", 404);
      const previousStart = occurrence.startAt?.getTime() ?? Date.now();
      const previousEnd = occurrence.endAt?.getTime();
      occurrence.startAt = new Date(previousStart + minutes * 60_000);
      occurrence.endAt = new Date(previousEnd === undefined ? occurrence.startAt.getTime() + BASE_WORK_MINUTES * 60_000 : previousEnd + minutes * 60_000);
      await occurrence.save({ session });
      shifted = await shiftFollowingTasks(ownerId, date, taskId, minutes, actionId, session);
      taskTitle = (await RoutineTask.findOne({ _id: taskId, ownerId }).select("title").session(session).lean())?.title ?? "Task";
      await markReminderResponded(ownerId, taskId, date, session);
      await RoutineEvent.create([{ ownerId, eventId: actionId, idempotencyKey: actionId, parentEventId: actionId, taskId, occurrenceId: occurrence._id, date, type: "task_snoozed", occurredAt: new Date(), metadata: { taskTitle, snoozeMinutes: minutes, shiftedTaskTitles: shifted } }], { session });
      applied = true;
    });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const prior = await RoutineEvent.findOne({ ownerId, idempotencyKey: actionId }).lean();
    if (!prior) throw error;
    return { occurrence: await RoutineTaskOccurrence.findOne({ ownerId, taskId, date }), shiftedTaskTitles: [] };
  } finally { await session.endSession(); }
  if (applied) await deliverParentEventPush(ownerId, actionId, "Task snoozed", `${taskTitle} snoozed for ${minutes} minutes. ${shifted.length ? `${shifted.length} later task${shifted.length === 1 ? "" : "s"} moved: ${shifted.slice(0, 4).join(", ")}${shifted.length > 4 ? ", and more" : ""}.` : "No later tasks needed to move."}`);
  else return { occurrence: await RoutineTaskOccurrence.findOne({ ownerId, taskId, date }), shiftedTaskTitles: [] };
  return { occurrence, shiftedTaskTitles: shifted };
}

export async function completeRoutineOccurrence(ownerId: string, taskId: string, date: string, completed: boolean, actionId: string) {
  if (await RoutineEvent.exists({ ownerId, idempotencyKey: actionId })) return RoutineCompletion.findOne({ taskId, date });
  if (!await RoutineTask.exists({ _id: taskId, ownerId })) return null;
  if (completed && await RoutineCompletion.exists({ taskId, date, completed: true })) return RoutineCompletion.findOne({ taskId, date, completed: true });
  await RoutineTask.updateOne({ _id: taskId, ownerId }, { $set: { status: completed ? "completed" : "pending" } });
  const result = await RoutineCompletion.findOneAndUpdate({ taskId, date }, { completed }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (!completed) {
    const occurrence = await RoutineTaskOccurrence.findOneAndUpdate({ ownerId, taskId, date, status: "completed" }, { $set: { status: "planned", completedAt: null } }, { new: true });
    const task = await RoutineTask.findOne({ _id: taskId, ownerId }).select("title").lean();
    await notifyChange(ownerId, occurrence ?? { taskId, date }, "task_reopened", actionId, "Task reopened", "Task marked incomplete and returned to today's routine.", { taskTitle: task?.title });
    return result;
  }
  const occurrence = await RoutineTaskOccurrence.findOneAndUpdate({ ownerId, taskId, date }, { $set: { status: "completed", completedAt: new Date() } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  const queued = await RoutineTaskOccurrence.findOne({ ownerId, status: "queued" }).lean();
  await markReminderResponded(ownerId, taskId, date);
  const task = await RoutineTask.findOne({ _id: taskId, ownerId }).select("title").lean();
  const queuedTask = queued ? await RoutineTask.findOne({ _id: queued.taskId, ownerId }).select("title").lean() : null;
  const body = queuedTask ? `${task?.title ?? "Task"} complete. ${queuedTask.title} is ready when you start it.` : `${task?.title ?? "Task"} marked complete.`;
  await notifyChange(ownerId, occurrence, "task_completed", actionId, "Task complete", body, { taskTitle: task?.title, queuedTaskTitle: queuedTask?.title ?? null });
  return result;
}

export async function routineEventAnalytics(ownerId: string, days = 14) {
  const since = new Date(Date.now() - Math.max(1, Math.min(365, days)) * 86_400_000);
  const rows = await RoutineEvent.aggregate([
    { $match: { ownerId: new mongoose.Types.ObjectId(ownerId), occurredAt: { $gte: since } } },
    { $group: { _id: "$type", count: { $sum: 1 }, responseCount: { $sum: { $cond: [{ $ne: ["$responseTimeMs", null] }, 1, 0] } }, avgResponseMs: { $avg: "$responseTimeMs" } } },
  ]);
  const counts = Object.fromEntries(rows.map(row => [row._id, { count: row.count, avgResponseMs: row.avgResponseMs === null ? null : Math.round(row.avgResponseMs) } ]));
  const completed = counts.task_completed?.count ?? 0;
  const started = counts.task_started?.count ?? 0;
  const recentEvents = await RoutineEvent.find({ ownerId: new mongoose.Types.ObjectId(ownerId), occurredAt: { $gte: since } })
    .sort({ occurredAt: -1 }).limit(20).select("eventId parentEventId taskId date type occurredAt responseTimeMs pushStatus metadata").populate("taskId", "title").lean();
  const responseValues = rows.filter(row => row.avgResponseMs !== null).map(row => ({ total: row.avgResponseMs * row.responseCount, count: row.responseCount }));
  const averageResponseMs = responseValues.length ? Math.round(responseValues.reduce((sum, item) => sum + item.total, 0) / responseValues.reduce((sum, item) => sum + item.count, 0)) : null;
  return { days, counts, completionRate: started ? Math.round(completed / started * 100) : 0, totalEvents: rows.reduce((sum, row) => sum + row.count, 0), averageResponseMs, recentEvents };
}

export function newActionId(value?: string) { return typeof value === "string" && value.length >= 8 && value.length <= 120 ? value : randomUUID(); }
