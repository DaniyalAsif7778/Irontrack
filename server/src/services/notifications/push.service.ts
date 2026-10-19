import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { PushDelivery, PushSubscription } from "../../models/notifications/notification.model.js";
import { RoutineCompletion, RoutineTask } from "../../models/routine/routine.model.js";
import { WorkoutLog } from "../../models/workout/workout.model.js";
import { WellnessLog } from "../../models/wellness/wellness.model.js";
import { workoutWeek } from "../workout/workoutData.js";
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

async function send(subscription: any, deliveryKey: string, title: string, body: string, url: string) {
  if (!configured) return;
  try {
    await PushDelivery.create({ ownerId: subscription.ownerId, deliveryKey, expiresAt: new Date(Date.now() + 60 * 86400_000) });
  } catch (error: any) {
    if (error?.code === 11000) return;
    throw error;
  }
  const target: WebPushSubscription = { endpoint: subscription.endpoint, keys: subscription.keys };
  try {
    await webpush.sendNotification(target, JSON.stringify({ title, body, url, icon: "/icon.svg" }), { TTL: 3600, urgency: "normal" });
  } catch (error: any) {
    await PushDelivery.deleteOne({ ownerId: subscription.ownerId, deliveryKey });
    if (error?.statusCode === 404 || error?.statusCode === 410) await PushSubscription.deleteOne({ _id: subscription._id });
    else logger.warn({ err: error, ownerId: String(subscription.ownerId) }, "Push notification delivery failed");
    throw error;
  }
}

export async function sendTestPush(ownerId: string) {
  if (!configured) throw new Error("Background push is not configured. Add the VAPID keys to the server environment.");
  const subscriptions = await PushSubscription.find({ ownerId });
  if (!subscriptions.length) throw new Error("Enable background notifications on this device first.");
  await Promise.all(subscriptions.map(subscription => send(subscription, `test:${Date.now()}:${subscription.id}`, "IronTrack test", "Background notifications are connected to your server.", "/wellness")));
}

let checking = false;
export async function dispatchDueNotifications(now = new Date()) {
  if (!configured || checking) return;
  checking = true;
  try {
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
          if (!done) await send(subscription, `task:${dateKey}:${task._id}`, "Routine reminder", task.title, "/routine").catch(() => undefined);
        }
      }
      if (prefs.workoutAtNine && time === "09:00") {
        const weekKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][weekday];
        const dayType = workoutWeek.find(day => day.key === weekKey)?.dayType;
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
  } catch (error) { logger.warn({ err: error }, "Background notification schedule check failed"); }
  finally { checking = false; }
}

export function startNotificationScheduler() {
  void dispatchDueNotifications();
  setInterval(() => void dispatchDueNotifications(), 60_000).unref();
}
