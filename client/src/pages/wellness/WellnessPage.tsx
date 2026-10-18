import { Bell, BellRing, Check, Droplet, Footprints, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useWellness } from "../../hooks/hooks";
import { ironToday } from "../../utils/date";
import type { WellnessDay } from "../../types";

export type ReminderPreferences = { taskTimes: boolean; workoutAtNine: boolean; hydration: boolean; movement: boolean };
export const reminderStorageKey = "irontrack_reminder_preferences_v1";
export const defaultReminderPreferences: ReminderPreferences = { taskTimes: true, workoutAtNine: true, hydration: false, movement: false };

function readPreferences(): ReminderPreferences {
  try { return { ...defaultReminderPreferences, ...JSON.parse(localStorage.getItem(reminderStorageKey) ?? "{}") }; }
  catch { return defaultReminderPreferences; }
}

export default function WellnessPage({ onError }: { onError: (message: string) => void }) {
  const date = ironToday();
  const wellness = useWellness(date);
  const today = wellness.data?.find(item => item.date === date) ?? { date, waterGlasses: 0, movementBreaks: 0 };
  const [permission, setPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [preferences, setPreferences] = useState(readPreferences);
  const [testing, setTesting] = useState(false);
  const waterGoal = 8;
  const movementGoal = 6;

  async function change(field: "waterGlasses" | "movementBreaks", delta: number) {
    const value: WellnessDay = { ...today, [field]: Math.max(0, Math.min(100, today[field] + delta)) };
    try { await wellness.save.mutateAsync(value); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not save today’s wellness log."); }
  }

  function updatePreference(key: keyof ReminderPreferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    localStorage.setItem(reminderStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event("irontrack-reminders-updated"));
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") { setPermission("unsupported"); return; }
    setPermission(await Notification.requestPermission());
  }

  async function sendTest() {
    setTesting(true);
    try {
      if (Notification.permission !== "granted") { setPermission(await Notification.requestPermission()); return; }
      const options = { body: "Notifications are ready on this device.", icon: "/icon.svg", tag: "irontrack-test" };
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) await registration.showNotification("IronTrack check-in", options);
      else new Notification("IronTrack check-in", options);
    } catch { onError("This browser could not show a notification. Check its site notification permissions."); }
    finally { setTesting(false); }
  }

  return <>
    <header><div><h1>Wellness</h1><p>Small check-ins for water, movement, and the routine around your training.</p></div></header>
    <div className="wellness-grid">
      <section className="wellness-card"><div className="wellness-card-heading"><span className="wellness-icon water"><Droplet /></span><div><h2>Water</h2><p>Glasses today</p></div><strong>{today.waterGlasses}<small> / {waterGoal}</small></strong></div><div className="wellness-progress"><i style={{ width: `${Math.min(100, today.waterGlasses / waterGoal * 100)}%` }} /></div><div className="wellness-controls"><span>{today.waterGlasses >= waterGoal ? "Daily target reached" : `${waterGoal - today.waterGlasses} to your daily target`}</span><div><button type="button" aria-label="Remove one glass of water" disabled={!today.waterGlasses || wellness.save.isPending} onClick={() => void change("waterGlasses", -1)}><Minus /></button><button type="button" aria-label="Add one glass of water" disabled={wellness.save.isPending} onClick={() => void change("waterGlasses", 1)}><Plus /></button></div></div></section>
      <section className="wellness-card"><div className="wellness-card-heading"><span className="wellness-icon movement"><Footprints /></span><div><h2>Movement</h2><p>Movement breaks today</p></div><strong>{today.movementBreaks}<small> / {movementGoal}</small></strong></div><div className="wellness-progress movement"><i style={{ width: `${Math.min(100, today.movementBreaks / movementGoal * 100)}%` }} /></div><div className="wellness-controls"><span>{today.movementBreaks >= movementGoal ? "Daily target reached" : `${movementGoal - today.movementBreaks} to your daily target`}</span><div><button type="button" aria-label="Remove one movement break" disabled={!today.movementBreaks || wellness.save.isPending} onClick={() => void change("movementBreaks", -1)}><Minus /></button><button type="button" aria-label="Add one movement break" disabled={wellness.save.isPending} onClick={() => void change("movementBreaks", 1)}><Plus /></button></div></div></section>
    </div>
    <section className="wellness-history"><div className="section-heading"><h2>Last 7 days</h2><span>Daily check-ins</span></div>{wellness.isPending ? <p>Loading wellness history…</p> : <div className="wellness-days">{(wellness.data ?? []).map(day => <div className="wellness-day" key={day.date}><div className="wellness-bars"><i className="water-bar" style={{ height: `${Math.max(4, Math.min(100, day.waterGlasses / waterGoal * 100))}%` }} /><i className="movement-bar" style={{ height: `${Math.max(4, Math.min(100, day.movementBreaks / movementGoal * 100))}%` }} /></div><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</b><small>{day.date === date ? "Today" : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric" })}</small></div>)}</div>}<div className="wellness-legend"><span><i className="water-dot" /> Water</span><span><i className="movement-dot" /> Movement</span></div></section>
    <section className="notification-card"><div className="section-heading"><div><h2>Reminders</h2><p>Browser notifications are free and stay on this device.</p></div><BellRing /></div>
      <div className="permission-row"><div><b>Notification permission</b><small>{permission === "granted" ? "Allowed on this device" : permission === "denied" ? "Blocked in browser settings" : permission === "unsupported" ? "This browser does not support notifications" : "Not enabled yet"}</small></div>{permission === "default" && <button type="button" onClick={() => void enableNotifications()}><Bell size={15} /> Enable</button>}{permission === "granted" && <button type="button" className="notification-test" disabled={testing} onClick={() => void sendTest()}>{testing ? "Sending…" : "Send test"}</button>}</div>
      <div className="reminder-options">{([
        ["taskTimes", "Routine task reminders", "Notify at the reminder time set on an incomplete task."],
        ["workoutAtNine", "Workout reminder", "A morning reminder on training days when a session is still due."],
        ["hydration", "Water check-in", "A gentle hourly reminder while IronTrack is open."],
        ["movement", "Movement check-in", "A gentle reminder after a quiet hour while IronTrack is open."],
      ] as const).map(([key, title, description]) => <label key={key}><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={preferences[key]} onChange={() => updatePreference(key)} /></label>)}</div>
      <p className="notification-limit"><Check size={14} /> Reminders run while this app is open. Delivery when it is fully closed needs push infrastructure and browser support; IronTrack does not use a paid notification provider.</p>
    </section>
  </>;
}
