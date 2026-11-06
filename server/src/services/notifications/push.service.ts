import { randomUUID } from "node:crypto";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { NotificationSchedulerLease, PushDelivery, PushSubscription, ScheduledNotification } from "../../models/notifications/notification.model.js";
import { RoutineCompletion, RoutineEvent, RoutineReminder, RoutineTask, RoutineTaskOccurrence } from "../../models/routine/routine.model.js";
import { WorkoutLog, WorkoutProgram } from "../../models/workout/workout.model.js";
import { WellnessLog } from "../../models/wellness/wellness.model.js";
import { User, type PrayerTimes } from "../../models/auth/user.model.js";
import { logger } from "../../utils/logger.js";
import { trackNotificationEvent } from "./notification-telemetry.service.js";

const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
const configured = Boolean(publicKey && privateKey);
if (configured) webpush.setVapidDetails(subject, publicKey, privateKey);

export function pushConfiguration() { return { enabled: configured, publicKey: configured ? publicKey : null }; }

export function localCalendarParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const year = Number(values.year), month = Number(values.month), day = Number(values.day);
  return {
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    time: `${values.hour}:${values.minute}`,
  };
}

const notificationGraceMs = 15 * 60_000;
const maxNotificationAttempts = 4;
const retryDelayMs = [60_000, 2 * 60_000, 5 * 60_000];
type DueMinute = { dueAt: Date; dateKey: string; calendarDate: string; time: string; weekday: number; ironDayType: string };

/** Build the bounded catch-up window so scheduler restarts can recover recent minute-based reminders. */
export function dueMinuteSlots(now: Date, timezone: string, graceMs = notificationGraceMs, after: Date | null = null): DueMinute[] {
  const latestMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  const earliest = now.getTime() - graceMs;
  const slots: DueMinute[] = [];
  for (let at = latestMinute; at >= earliest; at -= 60_000) {
    if (after && at <= after.getTime()) continue;
    const instant = new Date(at);
    const local = localCalendarParts(instant, timezone);
    const day = dayParts(instant, timezone);
    slots.push({ dueAt: instant, dateKey: day.dateKey, calendarDate: local.dateKey, time: local.time, weekday: day.weekday, ironDayType: day.ironDayType });
  }
  return slots;
}

async function materializeScheduledNotification(input: {
  ownerId: unknown; subscriptionId: unknown; scheduleKey: string; category: string; title: string; body: string; url: string; dueAt: Date; timezone: string; scheduleDate: string; workoutDayType?: string; sourceEventId?: string; taskId?: unknown; taskDate?: string;
}) {
  try {
    // A stable per-subscription key makes a repeated scheduler scan safe to upsert.
    await ScheduledNotification.updateOne(
      { ownerId: input.ownerId, scheduleKey: input.scheduleKey },
      { $setOnInsert: { ...input, deliveryDeadline: new Date(input.dueAt.getTime() + notificationGraceMs), expiresAt: new Date(input.dueAt.getTime() + 60 * 86400_000), nextAttemptAt: input.dueAt, status: "pending" } },
      { upsert: true },
    );
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
  }
}

async function scheduleDueNotifications(subscriptions: any[], now: Date, after: Date | null) {
  const groups = new Map<string, { ownerId: string; timezone: string; subscriptions: any[] }>();
  for (const subscription of subscriptions) {
    const ownerId = String(subscription.ownerId);
    const timezone = subscription.timezone || "UTC";
    const key = `${ownerId}:${timezone}`;
    const group: { ownerId: string; timezone: string; subscriptions: any[] } = groups.get(key) ?? { ownerId, timezone, subscriptions: [] };
    group.subscriptions.push(subscription);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const { ownerId, timezone } = group;
    const dueSlots = dueMinuteSlots(now, timezone, notificationGraceMs, after);
    const times = [...new Set(dueSlots.map(slot => slot.time))];
    const needsTasks = group.subscriptions.some(subscription => subscription.preferences?.taskTimes);
    const needsWorkout = group.subscriptions.some(subscription => subscription.preferences?.workoutAtNine);
    const taskDays = [...new Set(dueSlots.map(slot => slot.ironDayType))];
    const [tasks, program] = await Promise.all([
      needsTasks && times.length ? RoutineTask.find({ ownerId, dayType: { $in: taskDays }, reminderTime: { $in: times } }).select("_id title dueDate reminderTime dayType").lean() : [],
      needsWorkout ? WorkoutProgram.findOne({ ownerId }).select("days").lean() : null,
    ]);
    const prayerTimes = group.subscriptions.some(subscription => subscription.preferences?.prayerTimes)
      ? (await User.findById(ownerId).select("preferences.prayerTimes").lean())?.preferences?.prayerTimes
      : undefined;

    for (const subscription of group.subscriptions) {
      const preferences = subscription.preferences;
      const subscriptionId = subscription._id;
      for (const slot of dueSlots) {
        if (preferences?.taskTimes) for (const task of tasks as any[]) {
          if (task.reminderTime !== slot.time || task.dayType !== slot.ironDayType || (task.dueDate && task.dueDate !== slot.dateKey)) continue;
          const scheduleKey = `task:${slot.dateKey}:${task._id}:${subscriptionId}`;
          await materializeScheduledNotification({ ownerId: subscription.ownerId, subscriptionId, scheduleKey, category: "task", title: "Routine reminder", body: task.title, url: "/routine", dueAt: slot.dueAt, timezone, scheduleDate: slot.dateKey, taskId: task._id, taskDate: slot.dateKey });
        }

        if (preferences?.prayerTimes) for (const prayer of prayersDueAt(prayerTimes, slot.time)) {
          const scheduleKey = `prayer:${slot.calendarDate}:${prayer.key}:${subscriptionId}`;
          await materializeScheduledNotification({ ownerId: subscription.ownerId, subscriptionId, scheduleKey, category: "prayer", title: `Time for ${prayer.label}`, body: `Your scheduled ${prayer.label} prayer time is here.`, url: "/routine", dueAt: slot.dueAt, timezone, scheduleDate: slot.calendarDate });
        }

        if (preferences?.workoutAtNine && slot.time === "09:00") {
          const weekKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][slot.weekday];
          const dayType = program?.days.find((day: any) => day.key === weekKey)?.planId;
          if (dayType) await materializeScheduledNotification({ ownerId: subscription.ownerId, subscriptionId, scheduleKey: `workout:${slot.dateKey}:${subscriptionId}`, category: "workout", title: "Workout day", body: "Your training session is ready when you are.", url: "/workout", dueAt: slot.dueAt, timezone, scheduleDate: slot.dateKey, workoutDayType: dayType });
        }

        if ((preferences?.hydration || preferences?.movement) && ["10:00", "14:00", "18:00"].includes(slot.time)) {
          if (preferences.hydration) await materializeScheduledNotification({ ownerId: subscription.ownerId, subscriptionId, scheduleKey: `water:${slot.dateKey}:${slot.time}:${subscriptionId}`, category: "hydration", title: "Water check-in", body: "Take a moment for a glass of water.", url: "/wellness", dueAt: slot.dueAt, timezone, scheduleDate: slot.dateKey });
          if (preferences.movement) await materializeScheduledNotification({ ownerId: subscription.ownerId, subscriptionId, scheduleKey: `movement:${slot.dateKey}:${slot.time}:${subscriptionId}`, category: "movement", title: "Movement break", body: "Stand, stretch, and reset for a minute.", url: "/wellness", dueAt: slot.dueAt, timezone, scheduleDate: slot.dateKey });
        }
      }
    }
  }
}

async function claimScheduledNotification(now: Date) {
  const leaseToken = randomUUID();
  // Claim one event atomically so overlapping scheduler ticks cannot send the same event concurrently.
  return ScheduledNotification.findOneAndUpdate({
    dueAt: { $lte: now }, deliveryDeadline: { $gt: now },
    $or: [
      { status: "pending", nextAttemptAt: { $lte: now } },
      { status: "processing", leaseExpiresAt: { $lte: now } },
    ],
  }, {
    $set: { status: "processing", leaseToken, leaseExpiresAt: new Date(now.getTime() + 60_000), lastAttemptAt: now },
    $inc: { attempts: 1 },
  }, { sort: { dueAt: 1 }, new: true }).lean();
}

async function deliverScheduledNotification(event: any, now: Date) {
  const update = (fields: Record<string, unknown>) => ScheduledNotification.updateOne({ _id: event._id, status: "processing", leaseToken: event.leaseToken }, { $set: fields, $unset: { leaseToken: "", leaseExpiresAt: "" } });
  try {
    const subscription = await PushSubscription.findOne({ _id: event.subscriptionId, ownerId: event.ownerId }).lean();
    if (!subscription) { await update({ status: "skipped" }); return; }
    if (!configured) {
      trackNotificationEvent("notification_push_suppressed", { channel: "web_push", category: event.category, reason: "server_push_not_configured" });
      await update({ status: "skipped" });
      return;
    }
    const preferenceKey = ({ task: "taskTimes", prayer: "prayerTimes", workout: "workoutAtNine", hydration: "hydration", movement: "movement" } as const)[event.category as "task" | "prayer" | "workout" | "hydration" | "movement"];
    if (preferenceKey && !subscription.preferences?.[preferenceKey]) { await update({ status: "skipped" }); return; }
    if (event.category === "task") {
      if (await RoutineCompletion.exists({ taskId: event.taskId, date: event.taskDate, completed: true })) {
        await update({ status: "skipped" });
        await RoutineReminder.updateOne({ ownerId: event.ownerId, taskId: event.taskId, date: event.taskDate, status: "scheduled" }, { $set: { status: "responded", respondedAt: now } });
        return;
      }
      const task = await RoutineTask.findOne({ _id: event.taskId, ownerId: event.ownerId }).select("title").lean();
      if (!task) { await update({ status: "skipped" }); return; }
      const reminder = await RoutineReminder.findOneAndUpdate(
        { ownerId: event.ownerId, taskId: event.taskId, date: event.taskDate },
        { $setOnInsert: { ownerId: event.ownerId, taskId: event.taskId, date: event.taskDate, timezone: event.timezone, status: "scheduled", sentAt: null } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (reminder.status !== "scheduled" && reminder.status !== "sent") { await update({ status: "skipped" }); return; }
    }
    if (event.category === "workout") {
      const hasWorkout = await WorkoutLog.exists({ ownerId: event.ownerId, date: event.scheduleDate, dayType: event.workoutDayType });
      if (hasWorkout) { await update({ status: "skipped" }); return; }
    }
    if (event.category === "hydration" || event.category === "movement") {
      const wellness = await WellnessLog.findOne({ ownerId: event.ownerId, date: event.scheduleDate }).lean();
      if (event.category === "hydration" && (wellness?.waterGlasses ?? 0) >= 8) { await update({ status: "skipped" }); return; }
      if (event.category === "movement" && (wellness?.movementBreaks ?? 0) >= 6) { await update({ status: "skipped" }); return; }
    }
    await send(subscription, `scheduled:${event.scheduleKey}`, event.title, event.body, event.url, event.category);
    if (event.category === "task") {
      const marked = await RoutineReminder.updateOne({ ownerId: event.ownerId, taskId: event.taskId, date: event.taskDate, status: "scheduled" }, { $set: { status: "sent", sentAt: now, timezone: event.timezone } });
      if (marked.modifiedCount) await recordReminderEvent(event.ownerId, event.taskId, event.taskDate, "push_sent", `reminder-sent:${event.taskDate}:${String(event.taskId)}`, { taskTitle: event.body, reminderTime: localCalendarParts(event.dueAt, event.timezone).time });
    }
    await update({ status: "sent", sentAt: now, lastError: "" });
    if (event.sourceEventId) await RoutineEvent.updateOne({ ownerId: event.ownerId, idempotencyKey: event.sourceEventId }, { $set: { pushStatus: "sent", pushSentAt: now } });
  } catch (error) {
    const attempts = Number(event.attempts) || 1;
    const nextAttemptAt = new Date(now.getTime() + (retryDelayMs[attempts - 1] ?? retryDelayMs.at(-1)!));
    const retry = attempts < maxNotificationAttempts && nextAttemptAt < event.deliveryDeadline;
    await update({
      status: retry ? "pending" : "failed",
      ...(retry ? { nextAttemptAt } : {}),
      lastError: error instanceof Error ? error.message.slice(0, 300) : "Notification delivery failed",
    });
    if (event.sourceEventId) await RoutineEvent.updateOne({ ownerId: event.ownerId, idempotencyKey: event.sourceEventId }, { $set: { pushStatus: retry ? "retrying" : "failed" } });
    logger.warn({ event: "scheduled_notification_attempt_failed", category: event.category, attempts, retry, errorName: error instanceof Error ? error.name : "UnknownError" }, "Scheduled notification delivery attempt failed");
  }
}

async function dispatchScheduledNotifications(now: Date) {
  await ScheduledNotification.updateMany({ status: { $in: ["pending", "processing"] }, deliveryDeadline: { $lte: now } }, { $set: { status: "expired" }, $unset: { leaseToken: "", leaseExpiresAt: "" } });
  for (let count = 0; count < 100; count += 1) {
    const event = await claimScheduledNotification(now);
    if (!event) break;
    await deliverScheduledNotification(event, now);
  }
}

function dayParts(date: Date, timezone: string) {
  const local = localCalendarParts(date, timezone);
  let [year, month, day] = local.dateKey.split("-").map(Number);
  const hour = Number(local.time.slice(0, 2));
  // IronTrack's routine day changes at 1:00 AM local time.
  if (hour < 1) { const prior = new Date(Date.UTC(year, month - 1, day - 1)); year = prior.getUTCFullYear(); month = prior.getUTCMonth() + 1; day = prior.getUTCDate(); }
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return { dateKey, time: local.time, weekday, ironDayType: weekday === 0 || weekday === 6 ? "weekend" : "weekday" };
}

const prayerLabels = [["fajr", "Fajr"], ["dhuhr", "Dhuhr"], ["asr", "Asr"], ["maghrib", "Maghrib"], ["isha", "Isha"]] as const;
export function prayersDueAt(prayerTimes: PrayerTimes | undefined, time: string) {
  return prayerLabels.filter(([key]) => prayerTimes?.[key] === time).map(([key, label]) => ({ key, label }));
}

function addDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function dateAtLocalTime(dateKey: string, time: string, timezone: string) {
  const [year, month, day] = dateKey.split("-").map(Number), [hour, minute] = time.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute); let epoch = wanted;
  for (let pass = 0; pass < 3; pass += 1) {
    const p = dayParts(new Date(epoch), timezone);
    const [actualHour, actualMinute] = p.time.split(":").map(Number);
    const actualDate = p.dateKey;
    const diff = wanted - Date.UTC(Number(actualDate.slice(0, 4)), Number(actualDate.slice(5, 7)) - 1, Number(actualDate.slice(8, 10)), actualHour, actualMinute);
    if (!diff) break; epoch += diff;
  }
  return new Date(epoch);
}

async function recordReminderEvent(ownerId: any, taskId: any, date: string, type: string, idempotencyKey: string, metadata: Record<string, unknown> = {}) {
  try {
    await RoutineEvent.create({ ownerId, taskId, date, eventId: idempotencyKey, idempotencyKey, parentEventId: idempotencyKey, type, occurredAt: new Date(), metadata });
  } catch (error: any) { if (error?.code !== 11000) throw error; }
}

async function dispatchReminderFollowups(now: Date) {
  const stale = await RoutineReminder.find({ status: "sent", sentAt: { $lte: new Date(now.getTime() - 10 * 60_000) } }).limit(100);
  for (const reminder of stale) {
    const claimed = await RoutineReminder.updateOne({ _id: reminder._id, status: "sent" }, { $set: { status: "ignored" } });
    if (!claimed.modifiedCount) continue;
    await recordReminderEvent(reminder.ownerId, reminder.taskId, reminder.date, "reminder_ignored", `ignored:${reminder._id}`, { responseWindowMinutes: 10 });
  }

  const unanswered = await RoutineReminder.find({ status: { $in: ["ignored", "followup_sent"] }, sentAt: { $lte: new Date(now.getTime() - 20 * 60_000) } }).limit(100);
  for (const reminder of unanswered) {
    const claimed = await RoutineReminder.updateOne({ _id: reminder._id, status: { $in: ["ignored", "followup_sent"] } }, { $set: { status: "deferred", deferredAt: now } });
    if (!claimed.modifiedCount) continue;
    const task = await RoutineTask.findOne({ _id: reminder.taskId, ownerId: reminder.ownerId }).lean();
    if (!task) continue;
    const currentParts = dayParts(now, reminder.timezone);
    const destinationDate = currentParts.time >= "21:00" ? addDateKey(currentParts.dateKey, 1) : currentParts.dateKey;
    const weekday = new Date(`${destinationDate}T12:00:00Z`).getUTCDay();
    const dayType = weekday === 0 || weekday === 6 ? "weekend" : "weekday";
    const startAt = dateAtLocalTime(destinationDate, "20:15", reminder.timezone);
    const occurrence = await RoutineTaskOccurrence.findOneAndUpdate({ ownerId: reminder.ownerId, taskId: reminder.taskId, date: destinationDate }, { $set: { dayType, block: "isha", status: "deferred", startAt, endAt: new Date(startAt.getTime() + 45 * 60_000), timezone: reminder.timezone, workMinutes: 45 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const eventId = `defer:${String(reminder._id)}`;
    await recordReminderEvent(reminder.ownerId, reminder.taskId, destinationDate, "task_deferred", eventId, { taskTitle: task.title, prayerCard: "isha", movedToDate: destinationDate });
    await RoutineTaskOccurrence.updateOne({ _id: occurrence._id }, { $set: { lastParentEventId: eventId } });
  }
}

async function send(subscription: any, deliveryKey: string, title: string, body: string, url: string, category = "other") {
  if (!configured) return;
  const deviceDeliveryKey = `${deliveryKey}:${subscription._id}`;
  try {
    await PushDelivery.create({ ownerId: subscription.ownerId, deliveryKey: deviceDeliveryKey, expiresAt: new Date(Date.now() + 60 * 86400_000) });
  } catch (error: any) {
    if (error?.code === 11000) return;
    throw error;
  }
  const target: WebPushSubscription = { endpoint: subscription.endpoint, keys: subscription.keys };
  trackNotificationEvent("notification_push_attempted", { channel: "web_push", category });
  try {
    await webpush.sendNotification(target, JSON.stringify({ title, body, url, icon: "/icon.svg" }), { TTL: 3600, urgency: "normal" });
    trackNotificationEvent("notification_push_provider_accepted", { channel: "web_push", category });
  } catch (error: any) {
    await PushDelivery.deleteOne({ ownerId: subscription.ownerId, deliveryKey: deviceDeliveryKey });
    if (error?.statusCode === 404 || error?.statusCode === 410) await PushSubscription.deleteOne({ _id: subscription._id });
    else logger.warn({ errorName: error?.name ?? "PushError", statusCode: error?.statusCode, errorCode: error?.code }, "Push notification delivery failed");
    trackNotificationEvent("notification_push_provider_failed", { channel: "web_push", category, status_code: typeof error?.statusCode === "number" ? error.statusCode : null, reason: error?.statusCode === 404 || error?.statusCode === 410 ? "subscription_expired" : "provider_error" });
    throw error;
  }
}

export async function sendOwnerPush(ownerId: string, parentEventId: string, title: string, body: string, url: string) {
  if (!configured) return { configured: false, subscribed: false, sent: 0, failed: 0 };
  const subscriptions = await PushSubscription.find({ ownerId });
  const results = await Promise.allSettled(subscriptions.map(subscription => send(subscription, `event:${parentEventId}`, title, body, url)));
  return { configured: true, subscribed: subscriptions.length > 0, sent: results.filter(result => result.status === "fulfilled").length, failed: results.filter(result => result.status === "rejected").length };
}

export async function sendOwnerPerformancePush(ownerId: string, eventId: string, title: string, body: string, url: string, category: "personal_record" | "down_week" | "milestone" | "gentle_nudge") {
  if (!configured) {
    trackNotificationEvent("notification_push_suppressed", { channel: "web_push", category, reason: "server_push_not_configured" });
    return { configured: false, subscribed: false, sent: 0, failed: 0 };
  }
  const subscriptions = await PushSubscription.find({ ownerId, "preferences.performanceAlerts": { $ne: false } });
  if (!subscriptions.length) trackNotificationEvent("notification_push_suppressed", { channel: "web_push", category, reason: "no_eligible_subscription" });
  const results = await Promise.allSettled(subscriptions.map(subscription => send(subscription, `event:${eventId}`, title, body, url, category)));
  return { configured: true, subscribed: subscriptions.length > 0, sent: results.filter(result => result.status === "fulfilled").length, failed: results.filter(result => result.status === "rejected").length };
}

export async function sendTestPush(ownerId: string) {
  if (!configured) throw new Error("Background push is not configured. Add the VAPID keys to the server environment.");
  const subscriptions = await PushSubscription.find({ ownerId });
  if (!subscriptions.length) throw new Error("Enable background notifications on this device first.");
  await Promise.all(subscriptions.map(subscription => send(subscription, `test:${Date.now()}:${subscription.id}`, "IronTrack test", "Background notifications are connected to your server.", "/wellness", "test")));
}

let checking = false;
const schedulerOwnerToken = randomUUID();
// The process-local guard prevents overlap here; this Mongo lease extends that protection across API instances.
async function acquireSchedulerLease(now: Date) {
  try {
    const lease = await NotificationSchedulerLease.findOneAndUpdate(
      { _id: "push-scheduler", $or: [{ expiresAt: { $lte: now } }, { ownerToken: schedulerOwnerToken }] },
      { $set: { ownerToken: schedulerOwnerToken, expiresAt: new Date(now.getTime() + 120_000) } },
      { upsert: true, new: true },
    ).lean();
    return lease?.ownerToken === schedulerOwnerToken ? { lastProcessedAt: lease.lastProcessedAt ?? null } : null;
  } catch (error: any) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

async function releaseSchedulerLease(lastProcessedAt?: Date) {
  await NotificationSchedulerLease.updateOne(
    { _id: "push-scheduler", ownerToken: schedulerOwnerToken },
    { $set: { ownerToken: "", expiresAt: new Date(0), ...(lastProcessedAt ? { lastProcessedAt } : {}) } },
  );
}

async function dispatchRoutineBlockPrompts(now: Date) {
  const due = await RoutineTaskOccurrence.find({ status: "active", endAt: { $lte: now }, $expr: { $ne: ["$promptedForEndAt", "$endAt"] } }).limit(100);
  for (const occurrence of due) {
    const endAt = occurrence.endAt;
    if (!endAt) continue;
    const task = await RoutineTask.findOne({ _id: occurrence.taskId, ownerId: occurrence.ownerId }).select("title").lean();
    const eventId = `extension-prompt:${String(occurrence._id)}:${endAt.getTime()}`;
    try {
      await RoutineEvent.create({ ownerId: occurrence.ownerId, eventId, idempotencyKey: eventId, parentEventId: eventId, taskId: occurrence.taskId, occurrenceId: occurrence._id, date: occurrence.date, type: "extension_prompted", occurredAt: now, metadata: { taskTitle: task?.title ?? "Task", endAt } });
    } catch (error: any) { if (error?.code !== 11000) throw error; }
    const subscriptions = await PushSubscription.find({ ownerId: occurrence.ownerId }).select("_id timezone").lean();
    if (!subscriptions.length) {
      await RoutineEvent.updateOne({ ownerId: occurrence.ownerId, idempotencyKey: eventId }, { $set: { pushStatus: "unavailable", pushSentAt: null } });
      await RoutineTaskOccurrence.updateOne({ _id: occurrence._id, status: "active", promptedForEndAt: { $ne: endAt } }, { $set: { promptedForEndAt: endAt } });
      continue;
    }
    for (const subscription of subscriptions) await materializeScheduledNotification({
      ownerId: occurrence.ownerId,
      subscriptionId: subscription._id,
      scheduleKey: `${eventId}:${subscription._id}`,
      category: "routine_block",
      title: "45-minute block complete",
      body: `${task?.title ?? "Task"} is at its time limit. Open Routine to complete it or add 15 minutes.`,
      url: "/routine",
      dueAt: endAt,
      timezone: subscription.timezone || "UTC",
      scheduleDate: occurrence.date,
      sourceEventId: eventId,
    });
    await RoutineEvent.updateOne({ ownerId: occurrence.ownerId, idempotencyKey: eventId }, { $set: { pushStatus: "pending", pushSentAt: null } });
    await RoutineTaskOccurrence.updateOne({ _id: occurrence._id, status: "active", promptedForEndAt: { $ne: endAt } }, { $set: { promptedForEndAt: endAt } });
  }
}

export async function dispatchDueNotifications(now = new Date()) {
  if (!configured || checking) return;
  checking = true;
  let leaseState: { lastProcessedAt: Date | null } | null = null;
  let completedAt: Date | undefined;
  try {
    leaseState = await acquireSchedulerLease(now);
    if (!leaseState) return;
    await dispatchRoutineBlockPrompts(now);
    const subscriptions = await PushSubscription.find().select("_id ownerId timezone preferences").lean();
    await scheduleDueNotifications(subscriptions, now, leaseState.lastProcessedAt);
    await dispatchScheduledNotifications(now);
    await dispatchReminderFollowups(now);
    completedAt = now;
  } catch (error) {
    logger.warn({ errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown scheduler error", errorCode: typeof error === "object" && error !== null && "code" in error ? error.code : undefined }, "Background notification schedule check failed");
  }
  finally {
    if (leaseState) await releaseSchedulerLease(completedAt).catch(error => logger.warn({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Could not release notification scheduler lease"));
    checking = false;
  }
}

export function startNotificationScheduler() {
  void dispatchDueNotifications();
  setInterval(() => void dispatchDueNotifications(), 60_000).unref();
}
