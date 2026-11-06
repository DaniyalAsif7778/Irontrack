import { useEffect, useState } from "react";
import { BellRing, Check, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api/api";
import { defaultReminderPreferences, pushSubscribedKey, readReminderPreferences, reminderStorageKey, type ReminderPreferences } from "../../lib/reminderPreferences";
import { isNotificationSoundEnabled, notificationSoundKey, playNotificationSound } from "../../utils/notificationSound";
import type { AuthUser } from "../../types";

type PushConfig = { enabled: boolean; publicKey: string | null };
type PushStatus = { configured: boolean; subscribed: boolean; preferences: ReminderPreferences | null };

export default function ReminderSettings({ user, onError }: { user: AuthUser | null; onError: (message: string) => void }) {
  const [preferences, setPreferences] = useState(readReminderPreferences);
  const [testing, setTesting] = useState(false);
  const [pushConfig, setPushConfig] = useState<PushConfig | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(isNotificationSoundEnabled);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) {
        setPushConfig({ enabled: false, publicKey: null });
        setPushSubscribed(false);
        localStorage.setItem(pushSubscribedKey, "false");
        return;
      }
      const deviceSubscription = "serviceWorker" in navigator
        ? await navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription()).catch(() => null)
        : null;
      const endpointQuery = deviceSubscription ? `?endpoint=${encodeURIComponent(deviceSubscription.endpoint)}` : "?endpoint=none";
      const [configResult, statusResult] = await Promise.allSettled([
        api<PushConfig>("/notifications/config"),
        api<PushStatus>(`/notifications/status${endpointQuery}`),
      ]);
      if (!active) return;
      setPushConfig(configResult.status === "fulfilled" ? configResult.value : { enabled: false, publicKey: null });
      if (statusResult.status === "fulfilled") {
        const status = statusResult.value;
        const subscribedOnDevice = status.configured && status.subscribed;
        setPushSubscribed(subscribedOnDevice);
        localStorage.setItem(pushSubscribedKey, String(subscribedOnDevice));
        if (status.preferences) {
          const savedPreferences = { ...defaultReminderPreferences, ...status.preferences };
          setPreferences(savedPreferences);
          localStorage.setItem(reminderStorageKey, JSON.stringify(savedPreferences));
          window.dispatchEvent(new Event("irontrack-reminders-updated"));
        }
      } else {
        setPushSubscribed(false);
        localStorage.setItem(pushSubscribedKey, "false");
      }
    })().catch(() => {
      if (active) setPushConfig({ enabled: false, publicKey: null });
    });
    return () => { active = false; };
  }, [user?.id]);

  async function updatePreference(key: keyof ReminderPreferences) {
    const previous = preferences;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    localStorage.setItem(reminderStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event("irontrack-reminders-updated"));
    if (!pushSubscribed) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error("This device’s push subscription is missing. Re-enable background notifications.");
      await api("/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ endpoint: subscription.endpoint, preferences: next, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }),
      });
    } catch (error) {
      setPreferences(previous);
      localStorage.setItem(reminderStorageKey, JSON.stringify(previous));
      window.dispatchEvent(new Event("irontrack-reminders-updated"));
      onError(error instanceof Error ? error.message : "Could not sync reminder preferences with the server.");
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      if (localStorage.getItem("irontrack_notifications_enabled_v1") !== "true" || typeof Notification === "undefined" || Notification.permission !== "granted") {
        onError("Enable notifications in Settings first.");
        return;
      }
      if (pushSubscribed) {
        await api("/notifications/test", { method: "POST" });
        toast.success("Server test notification sent.");
        return;
      }
      const options = { body: "Notifications are ready on this device.", icon: "/icon.svg", tag: "irontrack-test", silent: false };
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) await registration.showNotification("IronTrack check-in", options);
      else new Notification("IronTrack check-in", options);
      void playNotificationSound();
    } catch (error) {
      onError(error instanceof Error ? error.message : "This browser could not show a notification. Check its site notification permissions.");
    } finally {
      setTesting(false);
    }
  }

  async function testSound() {
    if (!soundEnabled) {
      onError("Turn on notification sound first.");
      return;
    }
    if (!await playNotificationSound()) onError("Your browser blocked audio. Try the test again after interacting with the page.");
  }

  return <section className="notification-card settings-card">
    <div className="section-heading"><div><h2>Reminders</h2><p>Choose which reminders IronTrack sends and test this device.</p></div><BellRing /></div>
    <div className="permission-row"><div><b>Background notification service</b><small>{pushSubscribed ? "This device is connected to the server" : pushConfig?.enabled ? "Manage notification access above" : "Background delivery is unavailable until the server is configured"}</small></div>{pushSubscribed && <button type="button" className="notification-test" disabled={testing} onClick={() => void sendTest()}>{testing ? "Sending…" : "Send server test"}</button>}</div>
    <div className="reminder-options">
      <label><span><b>Notification sound</b><small>Play a short chime while IronTrack is open. Closed-app push uses your device’s notification sound.</small></span><input type="checkbox" checked={soundEnabled} onChange={event => { const enabled = event.target.checked; setSoundEnabled(enabled); localStorage.setItem(notificationSoundKey, String(enabled)); if (enabled) void playNotificationSound(); }} /></label>
      <button className="notification-test notification-sound-test" type="button" onClick={() => void testSound()}><Volume2 size={15} /> Test sound</button>
      {([
        ["taskTimes", "Routine task reminders", "Notify at the reminder time set on an incomplete task."],
        ["workoutAtNine", "Workout reminder", "A morning reminder on training days when a session is still due."],
        ["hydration", "Water check-in", "A gentle reminder at 10 AM, 2 PM, and 6 PM if you are below your daily goal."],
        ["movement", "Movement check-in", "A gentle reminder at 10 AM, 2 PM, and 6 PM if you are below your daily goal."],
        ["prayerTimes", "Prayer-time reminders", "Notify at the prayer times configured in Settings → Prayer anchors."],
        ["performanceAlerts", "Performance and milestone alerts", "Notify for verified personal bests, sustained down-weeks, and three-day consistency streaks."],
      ] as const).map(([key, title, description]) => <label key={key}><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={preferences[key]} onChange={() => void updatePreference(key)} /></label>)}
    </div>
    <p className="notification-limit"><Check size={14} /> {pushSubscribed ? "Enabled reminders are scheduled by your server, including while this app is closed. Prayer reminders use the times saved above." : "With notification permission, reminders run while this app is open. Background reminders need server push enabled and the server online."}</p>
  </section>;
}
