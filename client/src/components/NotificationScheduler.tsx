import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api/api";
import type { Day } from "../types";
import { ironToday } from "../utils/date";
import { defaultReminderPreferences, reminderStorageKey, type ReminderPreferences } from "../pages/wellness/WellnessPage";
import { useAppStore } from "../stores/appStore";
import { prayersDueAt } from "../utils/prayers";
import { queryKeys } from "../hooks/queryKeys";
import { playNotificationSound } from "../utils/notificationSound";

type WeekDay = { key: string; dayType: string | null };
type Session = { date: string; dayType: string };
type SessionPage = { items: Session[]; nextCursor: string | null; hasMore: boolean };
const sentKey = (date: string) => `irontrack_notification_sent_${date}`;
const notificationsEnabledKey = "irontrack_notifications_enabled_v1";

function readPreferences(): ReminderPreferences {
  try { return { ...defaultReminderPreferences, ...JSON.parse(localStorage.getItem(reminderStorageKey) ?? "{}") }; }
  catch { return defaultReminderPreferences; }
}

async function notify(title: string, body: string, tag: string) {
  const options = { body, tag, icon: "/icon.svg", data: { url: "/wellness" } };
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification(title, { ...options, silent: false });
  else new Notification(title, { ...options, silent: false });
  void playNotificationSound();
}

function alreadySent(date: string, id: string) {
  try { return (JSON.parse(localStorage.getItem(sentKey(date)) ?? "[]") as string[]).includes(id); }
  catch { return false; }
}

function markSent(date: string, id: string) {
  const sent = (() => { try { return JSON.parse(localStorage.getItem(sentKey(date)) ?? "[]") as string[]; } catch { return []; } })();
  localStorage.setItem(sentKey(date), JSON.stringify([...sent, id]));
}

export default function NotificationScheduler() {
  const date = ironToday();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const prayerTimes = useAppStore(state => state.preferences.prayerTimes);
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(() =>
    typeof Notification !== "undefined" && Notification.permission === "granted" && localStorage.getItem(notificationsEnabledKey) === "true" && localStorage.getItem("irontrack_push_subscribed_v1") !== "true",
  );
  const routine = useQuery({ queryKey: [...queryKeys.routine.day(date), timezone], queryFn: () => api<Day>(`/routine/days/${date}?timezone=${encodeURIComponent(timezone)}`), staleTime: 30_000, refetchInterval: 60_000, enabled: localNotificationsEnabled });
  const week = useQuery({ queryKey: ["notifications", "week"], queryFn: () => api<WeekDay[]>("/workout-week"), staleTime: 10 * 60_000, refetchInterval: 10 * 60_000, enabled: localNotificationsEnabled });
  const logs = useQuery({ queryKey: ["workout", "logs", 30], queryFn: () => api<SessionPage>("/workout-logs?limit=30"), staleTime: 60_000, refetchInterval: 5 * 60_000, enabled: localNotificationsEnabled });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "irontrack:push-received") void playNotificationSound();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const refreshNotificationMode = () => setLocalNotificationsEnabled(
      Notification.permission === "granted" && localStorage.getItem(notificationsEnabledKey) === "true" && localStorage.getItem("irontrack_push_subscribed_v1") !== "true",
    );
    window.addEventListener("irontrack-reminders-updated", refreshNotificationMode);
    window.addEventListener("storage", refreshNotificationMode);
    return () => {
      window.removeEventListener("irontrack-reminders-updated", refreshNotificationMode);
      window.removeEventListener("storage", refreshNotificationMode);
    };
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined" || !localNotificationsEnabled) return;
    const check = async () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const today = ironToday(now);
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const prefs = readPreferences();
      const serverPushEnabled = localStorage.getItem("irontrack_push_subscribed_v1") === "true";
      if (!serverPushEnabled && prefs.taskTimes && routine.data?.date === today) {
        const tasks = routine.data.blocks.flatMap(block => block.tasks);
        for (const task of tasks) {
          if (task.reminderTime === time && !task.completed && !alreadySent(today, `task-${task._id}`)) {
            try { await notify("Routine reminder", task.title, `task-${task._id}`); markSent(today, `task-${task._id}`); }
            catch { /* Keep it eligible for a retry after browser permission or service worker recovers. */ }
          }
        }
      }
      if (!serverPushEnabled && prefs.workoutAtNine && time === "09:00" && !alreadySent(today, "workout")) {
        const weekKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
        const dayType = week.data?.find(day => day.key === weekKey)?.dayType;
        if (dayType) {
          if (!logs.data?.items.some(session => session.date === today && session.dayType === dayType)) {
            try { await notify("Workout day", "Your training session is ready when you are.", "workout-reminder"); } catch { return; }
          }
          markSent(today, "workout");
        }
      }
      if (!serverPushEnabled && prefs.prayerTimes) {
        const calendarDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        for (const prayer of prayersDueAt(prayerTimes, time)) {
          if (alreadySent(calendarDate, `prayer-${prayer.key}`)) continue;
          try { await notify(`Time for ${prayer.label}`, `Your scheduled ${prayer.label} prayer time is here.`, `prayer-${prayer.key}`); markSent(calendarDate, `prayer-${prayer.key}`); }
          catch { /* Retry while the app remains open if the browser cannot show this reminder. */ }
        }
      }
      for (const [key, title, message] of [["hydration", "Water check-in", "Take a moment for a glass of water."], ["movement", "Movement break", "Stand, stretch, and reset for a minute."]] as const) {
        if (serverPushEnabled) continue;
        if (!prefs[key]) continue;
        const storageKey = `irontrack_${key}_reminder_last`;
        const last = Number(localStorage.getItem(storageKey) ?? 0);
        if (now.getTime() - last >= 60 * 60_000 && document.visibilityState === "visible") {
          try { await notify(title, message, `${key}-reminder`); localStorage.setItem(storageKey, String(now.getTime())); } catch { /* Retry on the next scheduler tick. */ }
        }
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 20_000);
    window.addEventListener("irontrack-reminders-updated", check);
    return () => { window.clearInterval(timer); window.removeEventListener("irontrack-reminders-updated", check); };
  }, [localNotificationsEnabled, prayerTimes, routine.data, week.data, logs.data]);

  return null;
}
