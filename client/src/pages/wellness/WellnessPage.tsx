import { BellRing, Check, Droplet, Footprints, Minus, Plus, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useWellness } from "../../hooks/hooks";
import { ironToday } from "../../utils/date";
import type { WellnessDay } from "../../types";
import { api } from "../../lib/api/api";
import { isNotificationSoundEnabled, notificationSoundKey, playNotificationSound } from "../../utils/notificationSound";

export type ReminderPreferences = { taskTimes: boolean; workoutAtNine: boolean; hydration: boolean; movement: boolean; prayerTimes: boolean };
export const reminderStorageKey = "irontrack_reminder_preferences_v1";
export const defaultReminderPreferences: ReminderPreferences = { taskTimes: true, workoutAtNine: true, hydration: false, movement: false, prayerTimes: false };
const pushSubscribedKey = "irontrack_push_subscribed_v1";
type PushConfig = { enabled: boolean; publicKey: string | null };
type PushStatus = { configured: boolean; subscribed: boolean; preferences: ReminderPreferences | null };

function readPreferences(): ReminderPreferences {
  try { return { ...defaultReminderPreferences, ...JSON.parse(localStorage.getItem(reminderStorageKey) ?? "{}") }; }
  catch { return defaultReminderPreferences; }
}

export default function WellnessPage({ onError }: { onError: (message: string) => void }) {
  const date = ironToday();
  const wellness = useWellness(date);
  const today = wellness.data?.find(item => item.date === date) ?? { date, waterGlasses: 0, movementBreaks: 0 };
  const [preferences, setPreferences] = useState(readPreferences);
  const [testing, setTesting] = useState(false);
  const [pushConfig, setPushConfig] = useState<PushConfig | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(() => localStorage.getItem(pushSubscribedKey) === "true");
  const [soundEnabled, setSoundEnabled] = useState(isNotificationSoundEnabled);
  const waterGoal = 8;
  const movementGoal = 6;

  useEffect(() => {
    let active = true;
    (async () => {
      const deviceSubscription = "serviceWorker" in navigator ? await navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription()).catch(() => null) : null;
      const endpointQuery = deviceSubscription ? `?endpoint=${encodeURIComponent(deviceSubscription.endpoint)}` : "";
      const [configResult, statusResult] = await Promise.allSettled([api<PushConfig>("/notifications/config"), api<PushStatus>(`/notifications/status${endpointQuery}`)]);
      if (!active) return;
      setPushConfig(configResult.status === "fulfilled" ? configResult.value : { enabled: false, publicKey: null });
      if (statusResult.status === "fulfilled") {
        const status = statusResult.value;
        const subscribedOnDevice = status.subscribed;
        setPushSubscribed(subscribedOnDevice);
        localStorage.setItem(pushSubscribedKey, String(subscribedOnDevice));
        if (!status.preferences) return;
        const savedPreferences = { ...defaultReminderPreferences, ...status.preferences };
        setPreferences(savedPreferences);
        localStorage.setItem(reminderStorageKey, JSON.stringify(savedPreferences));
        window.dispatchEvent(new Event("irontrack-reminders-updated"));
      }
    })().catch(() => { if (active) setPushConfig({ enabled: false, publicKey: null }); });
    return () => { active = false; };
  }, []);

  async function change(field: "waterGlasses" | "movementBreaks", delta: number) {
    const value: WellnessDay = { ...today, [field]: Math.max(0, Math.min(100, today[field] + delta)) };
    try { await wellness.save.mutateAsync(value); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not save today’s wellness log."); }
  }

  async function updatePreference(key: keyof ReminderPreferences) {
    const previous = preferences;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    localStorage.setItem(reminderStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event("irontrack-reminders-updated"));
    if (pushSubscribed) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) throw new Error("This device’s push subscription is missing. Re-enable background notifications.");
        await api("/notifications/preferences", { method: "PUT", body: JSON.stringify({ endpoint: subscription.endpoint, preferences: next, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }) });
      }
      catch (error) {
        setPreferences(previous);
        localStorage.setItem(reminderStorageKey, JSON.stringify(previous));
        window.dispatchEvent(new Event("irontrack-reminders-updated"));
        onError(error instanceof Error ? error.message : "Could not sync reminder preferences with the server.");
      }
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      if (localStorage.getItem("irontrack_notifications_enabled_v1") !== "true") { onError("Enable notifications in Settings first."); return; }
      if (Notification.permission !== "granted") { onError("Enable notifications in Settings first."); return; }
      if (pushSubscribed) {
        await api("/notifications/test", { method: "POST" });
        return;
      }
      const options = { body: "Notifications are ready on this device.", icon: "/icon.svg", tag: "irontrack-test", silent: false };
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) await registration.showNotification("IronTrack check-in", options);
      else new Notification("IronTrack check-in", options);
      void playNotificationSound();
    } catch { onError("This browser could not show a notification. Check its site notification permissions."); }
    finally { setTesting(false); }
  }

  async function testSound() {
    if (!soundEnabled) { onError("Turn on notification sound first."); return; }
    if (!await playNotificationSound()) onError("Your browser blocked audio. Try the test again after interacting with the page.");
  }

  return <>
    <header><div><h1>Wellness</h1><p>Small check-ins for water, movement, and the routine around your training.</p></div></header>
    <div className="wellness-grid">
      <section className="wellness-card"><div className="wellness-card-heading"><span className="wellness-icon water"><Droplet /></span><div><h2>Water</h2><p>Glasses today</p></div><strong>{today.waterGlasses}<small> / {waterGoal}</small></strong></div><div className="wellness-progress"><i style={{ width: `${Math.min(100, today.waterGlasses / waterGoal * 100)}%` }} /></div><div className="wellness-controls"><span>{today.waterGlasses >= waterGoal ? "Daily target reached" : `${waterGoal - today.waterGlasses} to your daily target`}</span><div><button type="button" aria-label="Remove one glass of water" disabled={!today.waterGlasses || wellness.save.isPending} onClick={() => void change("waterGlasses", -1)}><Minus /></button><button type="button" aria-label="Add one glass of water" disabled={wellness.save.isPending} onClick={() => void change("waterGlasses", 1)}><Plus /></button></div></div></section>
      <section className="wellness-card"><div className="wellness-card-heading"><span className="wellness-icon movement"><Footprints /></span><div><h2>Movement</h2><p>Movement breaks today</p></div><strong>{today.movementBreaks}<small> / {movementGoal}</small></strong></div><div className="wellness-progress movement"><i style={{ width: `${Math.min(100, today.movementBreaks / movementGoal * 100)}%` }} /></div><div className="wellness-controls"><span>{today.movementBreaks >= movementGoal ? "Daily target reached" : `${movementGoal - today.movementBreaks} to your daily target`}</span><div><button type="button" aria-label="Remove one movement break" disabled={!today.movementBreaks || wellness.save.isPending} onClick={() => void change("movementBreaks", -1)}><Minus /></button><button type="button" aria-label="Add one movement break" disabled={wellness.save.isPending} onClick={() => void change("movementBreaks", 1)}><Plus /></button></div></div></section>
    </div>
    <section className="wellness-history"><div className="section-heading"><h2>Last 7 days</h2><span>Daily check-ins</span></div>{wellness.isPending ? <p>Loading wellness history…</p> : <div className="wellness-days">{(wellness.data ?? []).map(day => <div className="wellness-day" key={day.date}><div className="wellness-bars"><i className="water-bar" style={{ height: `${Math.max(4, Math.min(100, day.waterGlasses / waterGoal * 100))}%` }} /><i className="movement-bar" style={{ height: `${Math.max(4, Math.min(100, day.movementBreaks / movementGoal * 100))}%` }} /></div><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</b><small>{day.date === date ? "Today" : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric" })}</small></div>)}</div>}<div className="wellness-legend"><span><i className="water-dot" /> Water</span><span><i className="movement-dot" /> Movement</span></div></section>
    <section className="notification-card"><div className="section-heading"><div><h2>Reminders</h2><p>Server push can reach this device when IronTrack is closed.</p></div><BellRing /></div>
      <div className="permission-row"><div><b>Background notification service</b><small>{pushSubscribed ? "This device is connected to the server" : pushConfig?.enabled ? "Manage notification access in Settings" : "Background delivery is unavailable until the server is configured"}</small></div>{pushSubscribed && <button type="button" className="notification-test" disabled={testing} onClick={() => void sendTest()}>{testing ? "Sending…" : "Send server test"}</button>}</div>
      <div className="reminder-options"><label><span><b>Notification sound</b><small>Play a short chime while IronTrack is open. Closed-app push uses your device’s notification sound.</small></span><input type="checkbox" checked={soundEnabled} onChange={event => { const enabled = event.target.checked; setSoundEnabled(enabled); localStorage.setItem(notificationSoundKey, String(enabled)); if (enabled) void playNotificationSound(); }} /></label><button className="notification-test notification-sound-test" type="button" onClick={() => void testSound()}><Volume2 size={15} /> Test sound</button>{([
        ["taskTimes", "Routine task reminders", "Notify at the reminder time set on an incomplete task."],
        ["workoutAtNine", "Workout reminder", "A morning reminder on training days when a session is still due."],
        ["hydration", "Water check-in", "A gentle reminder at 10 AM, 2 PM, and 6 PM if you are below your daily goal."],
        ["movement", "Movement check-in", "A gentle reminder at 10 AM, 2 PM, and 6 PM if you are below your daily goal."],
        ["prayerTimes", "Prayer-time reminders", "Notify at the prayer times configured in Settings → Prayer anchors."],
      ] as const).map(([key, title, description]) => <label key={key}><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={preferences[key]} onChange={() => updatePreference(key)} /></label>)}</div>
      <p className="notification-limit"><Check size={14} /> {pushSubscribed ? "Enabled reminders are scheduled by your server, including while this app is closed. Prayer reminders use the times saved in Settings." : "With notification permission, reminders run while this app is open. Background reminders need server push enabled and the server online."}</p>
    </section>
  </>;
}
