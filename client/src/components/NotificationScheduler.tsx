import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api/api";
import type { Day, WellnessDay } from "../types";
import { ironToday } from "../utils/date";
import { defaultReminderPreferences, reminderStorageKey, type ReminderPreferences } from "../pages/wellness/WellnessPage";

type WeekDay = { key: string; dayType: string | null };
type Session = { date: string; dayType: string };
const sentKey = (date: string) => `irontrack_notification_sent_${date}`;

function readPreferences(): ReminderPreferences {
  try { return { ...defaultReminderPreferences, ...JSON.parse(localStorage.getItem(reminderStorageKey) ?? "{}") }; }
  catch { return defaultReminderPreferences; }
}

async function notify(title: string, body: string, tag: string) {
  const options = { body, tag, icon: "/icon.svg", data: { url: "/wellness" } };
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
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
  const routine = useQuery({ queryKey: ["notifications", "routine", date], queryFn: () => api<Day>(`/routine/days/${date}`), staleTime: 30_000, refetchInterval: 60_000 });
  const week = useQuery({ queryKey: ["notifications", "week"], queryFn: () => api<WeekDay[]>("/workout-week"), staleTime: 10 * 60_000, refetchInterval: 10 * 60_000 });
  const logs = useQuery({ queryKey: ["notifications", "workouts"], queryFn: () => api<Session[]>("/workout-logs?limit=30"), staleTime: 60_000, refetchInterval: 5 * 60_000 });

  useEffect(() => {
    if (typeof Notification === "undefined") return;
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
          if (!logs.data?.some(session => session.date === today && session.dayType === dayType)) {
            try { await notify("Workout day", "Your training session is ready when you are.", "workout-reminder"); } catch { return; }
          }
          markSent(today, "workout");
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
  }, [routine.data, week.data, logs.data]);

  return null;
}
