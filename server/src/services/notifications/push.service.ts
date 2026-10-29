import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { PushDelivery, PushSubscription } from "../../models/notifications/notification.model.js";
import { RoutineCompletion, RoutineEvent, RoutineReminder, RoutineTask, RoutineTaskOccurrence } from "../../models/routine/routine.model.js";
import { WorkoutLog, WorkoutProgram } from "../../models/workout/workout.model.js";
import { WellnessLog } from "../../models/wellness/wellness.model.js";
import { logger } from "../../utils/logger.js";

const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
const configured = Boolean(publicKey && privateKey);
if (configured) webpush.setVapidDetails(subject, publicKey, privateKey);

export function pushConfiguration() { return { enabled: configured, publicKey: configured ? publicKey : null }; }

function dayParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  let year = Number(values.year), month = Number(values.month), day = Number(values.day), hour = Number(values.hour);
  // IronTrack's routine day changes at 1:00 AM local time.
  if (hour < 1) { const prior = new Date(Date.UTC(year, month - 1, day - 1)); year = prior.getUTCFullYear(); month = prior.getUTCMonth() + 1; day = prior.getUTCDate(); }
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return { dateKey, time: `${values.hour}:${values.minute}`, weekday, ironDayType: weekday === 0 || weekday === 6 ? "weekend" : "weekday" };
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
    const task = await RoutineTask.findOne({ _id: reminder.taskId, ownerId: reminder.ownerId }).select("title").lean();
    const eventId = `followup:${String(reminder._id)}`;
    const result = await sendOwnerPush(String(reminder.ownerId), eventId, "One more reminder", `${task?.title ?? "Your task"} is still waiting. Open Routine to start or snooze it.`, "/routine");
    if (result.sent) {
      await RoutineReminder.updateOne({ _id: reminder._id, status: "ignored" }, { $set: { status: "followup_sent", followupSentAt: now } });
      await recordReminderEvent(reminder.ownerId, reminder.taskId, reminder.date, "notification_followup", eventId, { taskTitle: task?.title ?? "Task" });
    } else {
      await RoutineReminder.updateOne({ _id: reminder._id, status: "ignored" }, { $set: { status: "sent" } });
    }
  }

  const unanswered = await RoutineReminder.find({ status: "followup_sent", followupSentAt: { $lte: new Date(now.getTime() - 10 * 60_000) } }).limit(100);
  for (const reminder of unanswered) {
    const claimed = await RoutineReminder.updateOne({ _id: reminder._id, status: "followup_sent" }, { $set: { status: "deferred", deferredAt: now } });
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
    await sendOwnerPush(String(reminder.ownerId), eventId, "Task moved to the last prayer card", `${task.title} had no response after its follow-up. It was moved to Isha on ${destinationDate}.`, "/routine");
    await RoutineTaskOccurrence.updateOne({ _id: occurrence._id }, { $set: { lastParentEventId: eventId } });
  }
}

async function send(subscription: any, deliveryKey: string, title: string, body: string, url: string) {
  if (!configured) return;
  const deviceDeliveryKey = `${deliveryKey}:${subscription._id}`;
  try {
    await PushDelivery.create({ ownerId: subscription.ownerId, deliveryKey: deviceDeliveryKey, expiresAt: new Date(Date.now() + 60 * 86400_000) });
  } catch (error: any) {
    if (error?.code === 11000) return;
    throw error;
  }
  const target: WebPushSubscription = { endpoint: subscription.endpoint, keys: subscription.keys };
  try {
    await webpush.sendNotification(target, JSON.stringify({ title, body, url, icon: "/icon.svg" }), { TTL: 3600, urgency: "normal" });
  } catch (error: any) {
    await PushDelivery.deleteOne({ ownerId: subscription.ownerId, deliveryKey: deviceDeliveryKey });
    if (error?.statusCode === 404 || error?.statusCode === 410) await PushSubscription.deleteOne({ _id: subscription._id });
    else logger.warn({ err: error, ownerId: String(subscription.ownerId) }, "Push notification delivery failed");
    throw error;
  }
}

export async function sendOwnerPush(ownerId: string, parentEventId: string, title: string, body: string, url: string) {
  if (!configured) return { configured: false, subscribed: false, sent: 0, failed: 0 };
  const subscriptions = await PushSubscription.find({ ownerId });
  const results = await Promise.allSettled(subscriptions.map(subscription => send(subscription, `event:${parentEventId}`, title, body, url)));
  return { configured: true, subscribed: subscriptions.length > 0, sent: results.filter(result => result.status === "fulfilled").length, failed: results.filter(result => result.status === "rejected").length };
}

export async function sendTestPush(ownerId: string) {
  if (!configured) throw new Error("Background push is not configured. Add the VAPID keys to the server environment.");
  const subscriptions = await PushSubscription.find({ ownerId });
  if (!subscriptions.length) throw new Error("Enable background notifications on this device first.");
  await Promise.all(subscriptions.map(subscription => send(subscription, `test:${Date.now()}:${subscription.id}`, "IronTrack test", "Background notifications are connected to your server.", "/wellness")));
}

let checking = false;
async function dispatchRoutineBlockPrompts(now: Date) {
  const due = await RoutineTaskOccurrence.find({ status: "active", endAt: { $lte: now }, $expr: { $ne: ["$promptedForEndAt", "$endAt"] } }).limit(100);
  for (const occurrence of due) {
    const endAt = occurrence.endAt;
    if (!endAt) continue;
    const claimed = await RoutineTaskOccurrence.updateOne({ _id: occurrence._id, status: "active", promptedForEndAt: { $ne: endAt } }, { $set: { promptedForEndAt: endAt } });
    if (!claimed.modifiedCount) continue;
    const task = await RoutineTask.findOne({ _id: occurrence.taskId, ownerId: occurrence.ownerId }).select("title").lean();
    const eventId = `extension-prompt:${String(occurrence._id)}:${endAt.getTime()}`;
    try {
      await RoutineEvent.create({ ownerId: occurrence.ownerId, eventId, idempotencyKey: eventId, parentEventId: eventId, taskId: occurrence.taskId, occurrenceId: occurrence._id, date: occurrence.date, type: "extension_prompted", occurredAt: now, metadata: { taskTitle: task?.title ?? "Task", endAt } });
    } catch (error: any) { if (error?.code !== 11000) throw error; else continue; }
    const subscriptions = await PushSubscription.find({ ownerId: occurrence.ownerId });
    const outcomes = await Promise.allSettled(subscriptions.map(subscription => send(subscription, eventId, "45-minute block complete", `${task?.title ?? "Task"} is at its time limit. Open Routine to complete it or add 15 minutes.`, "/routine")));
    await RoutineEvent.updateOne({ ownerId: occurrence.ownerId, idempotencyKey: eventId }, { $set: { pushStatus: !configured || !subscriptions.length ? "unavailable" : outcomes.some(item => item.status === "rejected") ? "failed" : "sent", pushSentAt: outcomes.some(item => item.status === "fulfilled") ? now : null } });
  }
}

export async function dispatchDueNotifications(now = new Date()) {
  if (!configured || checking) return;
  checking = true;
  try {
    await dispatchRoutineBlockPrompts(now);
    const subscriptions = await PushSubscription.find();
    for (const subscription of subscriptions) {
      const { dateKey, time, weekday, ironDayType } = dayParts(now, subscription.timezone || "UTC");
      const prefs = subscription.preferences;
      const ownerId = String(subscription.ownerId);
      if (prefs.taskTimes) {
        const tasks = await RoutineTask.find({ ownerId, dayType: ironDayType, reminderTime: time }).lean();
        for (const task of tasks) {
          if (task.dueDate && task.dueDate !== dateKey) continue;
          const done = await RoutineCompletion.exists({ taskId: task._id, date: dateKey, completed: true });
          if (!done) {
            let reminder = await RoutineReminder.findOne({ ownerId: subscription.ownerId, taskId: task._id, date: dateKey });
            if (!reminder) {
              try { reminder = await RoutineReminder.create({ ownerId: subscription.ownerId, taskId: task._id, date: dateKey, timezone: subscription.timezone || "UTC", status: "scheduled", sentAt: null }); }
              catch (error: any) { if (error?.code === 11000) reminder = await RoutineReminder.findOne({ ownerId: subscription.ownerId, taskId: task._id, date: dateKey }); else throw error; }
            }
            if (reminder && reminder.status === "scheduled") {
              try {
                await send(subscription, `task:${dateKey}:${task._id}`, "Routine reminder", task.title, "/routine");
                const marked = await RoutineReminder.updateOne({ _id: reminder._id, status: "scheduled" }, { $set: { status: "sent", sentAt: now, timezone: subscription.timezone || "UTC" } });
                if (marked.modifiedCount) await recordReminderEvent(subscription.ownerId, task._id, dateKey, "push_sent", `reminder-sent:${dateKey}:${String(task._id)}`, { taskTitle: task.title, reminderTime: time });
              } catch { /* Retry from the scheduler on the next minute while the delivery key remains unclaimed. */ }
            }
          }
        }
      }
      if (prefs.workoutAtNine && time === "09:00") {
        const weekKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][weekday];
        const program = await WorkoutProgram.findOne({ ownerId }).lean();
        const dayType = program?.days.find(day => day.key === weekKey)?.planId;
        if (dayType && !await WorkoutLog.exists({ ownerId, date: dateKey, dayType })) {
          await send(subscription, `workout:${dateKey}`, "Workout day", "Your training session is ready when you are.", "/workout").catch(() => undefined);
        }
      }
      if ((prefs.hydration || prefs.movement) && ["10:00", "14:00", "18:00"].includes(time)) {
        const wellness = await WellnessLog.findOne({ ownerId, date: dateKey }).lean();
        if (prefs.hydration && (wellness?.waterGlasses ?? 0) < 8) await send(subscription, `water:${dateKey}:${time}`, "Water check-in", "Take a moment for a glass of water.", "/wellness").catch(() => undefined);
        if (prefs.movement && (wellness?.movementBreaks ?? 0) < 6) await send(subscription, `movement:${dateKey}:${time}`, "Movement break", "Stand, stretch, and reset for a minute.", "/wellness").catch(() => undefined);
      }
    }
    await dispatchReminderFollowups(now);
  } catch (error) { logger.warn({ err: error }, "Background notification schedule check failed"); }
  finally { checking = false; }
}

export function startNotificationScheduler() {
  void dispatchDueNotifications();
  setInterval(() => void dispatchDueNotifications(), 60_000).unref();
}
