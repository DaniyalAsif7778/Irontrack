import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, BellOff, CircleUserRound, Clock3, Scale, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../lib/api/api";
import { clearOfflineQueue } from "../../lib/api/offlineQueue";
import { settingsSchema, type SettingsValues } from "../../schemas/settings";
import { useAppStore } from "../../stores/appStore";
import { DEFAULT_PRAYER_TIMES } from "../../types";
import type { AuthUser } from "../../types";
import ReminderSettings from "./ReminderSettings";

const sessionKey = ["auth", "me"] as const;
const notificationsEnabledKey = "irontrack_notifications_enabled_v1";
const pushSubscribedKey = "irontrack_push_subscribed_v1";
type AuthSessionEntry = { id: string; userAgent: string; ipAddress: string; createdAt: string; lastSeenAt: string; current: boolean };

function deviceName(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "Unknown browser";
  const device = /iPhone|Android|Mobile/i.test(userAgent) ? "Mobile device" : /iPad|Tablet/i.test(userAgent) ? "Tablet" : "Computer";
  return `${browser} on ${device}`;
}

export default function SettingsPage({ user, onError }: { user: AuthUser | null; onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const localPreferences = useAppStore(state => state.preferences);
  const setPreferences = useAppStore(state => state.setPreferences);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem(notificationsEnabledKey) === "true");
  const [notificationBusy, setNotificationBusy] = useState(false);
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted" && notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem(notificationsEnabledKey, "false");
    }
  }, [notificationsEnabled]);
  useEffect(() => {
    if (!user || localStorage.getItem(notificationsEnabledKey) === "true" || !("serviceWorker" in navigator)) return;
    let active = true;
    void navigator.serviceWorker.ready.then(async registration => {
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription || !active) return;
      try { await api("/notifications/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) }); }
      finally {
        await subscription.unsubscribe();
        localStorage.setItem(pushSubscribedKey, "false");
        window.dispatchEvent(new Event("irontrack-reminders-updated"));
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user?.id]);
  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions", user?.id],
    queryFn: async () => (await api<{ sessions: AuthSessionEntry[] }>("/auth/sessions")).sessions,
    enabled: Boolean(user),
    retry: false,
  });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: user?.name ?? "Local user",
      weightUnit: user?.preferences.weightUnit ?? localPreferences.weightUnit,
      focusMinutes: user?.preferences.focusMinutes ?? localPreferences.focusMinutes,
      breakMinutes: user?.preferences.breakMinutes ?? localPreferences.breakMinutes,
      prayerTimes: user?.preferences.prayerTimes ?? localPreferences.prayerTimes ?? DEFAULT_PRAYER_TIMES,
    },
  });

  async function save(values: SettingsValues) {
    const preferences = { weightUnit: values.weightUnit, focusMinutes: values.focusMinutes, breakMinutes: values.breakMinutes, prayerTimes: values.prayerTimes };
    try {
      if (user) {
        const result = await api<{ user: AuthUser }>("/auth/me", {
          method: "PATCH",
          body: JSON.stringify({ name: values.name, preferences }),
        });
        queryClient.setQueryData(sessionKey, result.user);
        reset({ name: result.user.name, ...result.user.preferences });
      } else {
        reset({ name: values.name, ...preferences });
      }
      setPreferences(preferences);
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your settings");
    }
  }

  async function toggleNotifications() {
    setNotificationBusy(true);
    if (notificationsEnabled) {
      // Turn off local delivery immediately; server cleanup must not control the master switch.
      localStorage.setItem(notificationsEnabledKey, "false");
      setNotificationsEnabled(false);
      localStorage.setItem(pushSubscribedKey, "false");
      window.dispatchEvent(new Event("irontrack-reminders-updated"));
      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription) {
            await api("/notifications/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => undefined);
            await subscription.unsubscribe();
          }
        }
      } catch { toast.error("Notifications are off on this device; server cleanup will retry when Settings is opened again."); }
      finally { setNotificationBusy(false); }
      return;
    }
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      setNotificationBusy(false);
      return;
    }
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        localStorage.setItem(notificationsEnabledKey, "true");
        setNotificationsEnabled(true);
        // Attach background push when the server supports it; local reminders still work otherwise.
        try {
          const config = user ? await api<{ enabled: boolean; publicKey: string | null }>("/notifications/config") : null;
          if (user && config?.enabled && config.publicKey && "serviceWorker" in navigator && "PushManager" in window) {
            const registration = await navigator.serviceWorker.ready;
            const encoded = config.publicKey.replace(/-/g, "+").replace(/_/g, "/");
            const raw = window.atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
            const applicationServerKey = Uint8Array.from(raw, character => character.charCodeAt(0));
            const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
            const keys = subscription.toJSON().keys;
            if (!keys?.p256dh || !keys.auth) throw new Error("Could not create a complete background notification subscription");
            let preferences = { taskTimes: true, workoutAtNine: true, hydration: false, movement: false, prayerTimes: false, performanceAlerts: true };
            try { preferences = { ...preferences, ...JSON.parse(localStorage.getItem("irontrack_reminder_preferences_v1") ?? "{}") }; } catch { /* Use safe defaults for damaged local settings. */ }
            await api("/notifications/subscriptions", { method: "POST", body: JSON.stringify({ endpoint: subscription.endpoint, keys, preferences, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }) });
            localStorage.setItem(pushSubscribedKey, "true");
          }
        } catch { toast.error("Local notifications are enabled, but background push could not connect. Check the server configuration."); }
        toast.success("Notifications enabled for this device");
        window.dispatchEvent(new Event("irontrack-reminders-updated"));
      }
      else if (permission === "denied") toast.error("Notifications are blocked in browser settings");
    } catch {
      toast.error("Your browser could not request notification permission");
    } finally { setNotificationBusy(false); }
  }

  async function revokeSession(session: AuthSessionEntry) {
    try {
      await api(`/auth/sessions/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions", user?.id] });
      if (session.current) await queryClient.invalidateQueries({ queryKey: sessionKey });
      toast.success(session.current ? "This device has been signed out." : "Session signed out.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out this session.");
    }
  }

  async function deleteAccount() {
    if (!user) return;
    if (!deletePassword) { setDeleteError("Enter your current password to continue."); return; }
    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") { setDeleteError('Type DELETE to confirm account deletion.'); return; }
    setDeleteError("");
    setIsDeleting(true);
    try {
      await api("/auth/me", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword, confirmation: "DELETE" }),
      });
      let cleanupFailed = false;
      try {
        await clearOfflineQueue(user.id);
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("irontrack_notification_sent_")) localStorage.removeItem(key);
        }
        for (const key of [
          "irontrack_active_workout_v1",
          `irontrack_active_workout_v1:${user.id}`,
          `irontrack_task_timer:${user.id}`,
          "irontrack_reminder_preferences_v1",
          "irontrack_push_subscribed_v1",
          notificationsEnabledKey,
          "irontrack_hydration_reminder_last",
          "irontrack_movement_reminder_last",
          "irontrack_weekly_focus_v1",
        ]) localStorage.removeItem(key);
        setPreferences({ weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: DEFAULT_PRAYER_TIMES });
        localStorage.removeItem("irontrack_settings");
      } catch {
        cleanupFailed = true;
      }
      queryClient.clear();
      queryClient.setQueryData(sessionKey, null);
      if (cleanupFailed) toast.error("Your account was deleted, but this browser could not clear all local data.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete your account. Try again.";
      setDeleteError(message);
      setIsDeleting(false);
    }
  }

  const permissionText = notificationPermission === "granted"
    ? "Enabled for this browser"
    : notificationPermission === "denied"
      ? "Blocked in browser settings"
      : notificationPermission === "unsupported"
        ? "Not supported in this browser"
        : "Off";

  return <>
    <header><div><h1>Settings</h1><p>Make IronTrack fit your training routine.</p></div></header>
    <form className="settings-layout" onSubmit={handleSubmit(save)}>
      <section className="settings-card settings-account">
        <div className="settings-heading"><span><CircleUserRound size={18} /></span><div><h2>Account</h2><p>Your profile and sign-in identity.</p></div></div>
        {user ? <>
          <label className="settings-field">Display name<input {...register("name")} autoComplete="name" />{errors.name && <small role="alert">{errors.name.message}</small>}</label>
          <label className="settings-field">Email address<input value={user.email} readOnly disabled /><small>Email changes are not available yet.</small></label>
        </> : <div className="settings-note"><strong>Account unavailable</strong><span>Sign in to manage your profile and account preferences.</span></div>}
      </section>

      {user && <section className="settings-card settings-sessions">
        <div className="settings-heading"><span><ShieldCheck size={18} /></span><div><h2>Signed-in devices</h2><p>Review active sessions and sign out devices you no longer use.</p></div></div>
        {sessionsQuery.isPending && <p role="status">Loading sessions…</p>}
        {sessionsQuery.isError && <div className="auth-error" role="alert">{sessionsQuery.error.message}</div>}
        {sessionsQuery.data?.length === 0 && <p>No other active sessions.</p>}
        {sessionsQuery.data && sessionsQuery.data.length > 0 && <ul className="settings-session-list">
          {sessionsQuery.data.map(session => <li key={session.id}>
            <div><strong>{deviceName(session.userAgent)}{session.current && <span className="settings-current-session">This device</span>}</strong>
              <small>{session.ipAddress || "IP unavailable"} · Last active {new Date(session.lastSeenAt).toLocaleString()}</small></div>
            <button className="settings-secondary" type="button" onClick={() => void revokeSession(session)}>{session.current ? "Sign out" : "Revoke"}</button>
          </li>)}
        </ul>}
      </section>}

      <section className="settings-card settings-training">
        <div className="settings-heading"><span><Clock3 size={18} /></span><div><h2>Training defaults</h2><p>Used for new logs and newly started focus timers.</p></div></div>
        <div className="settings-fields">
          <label className="settings-field"><span><Scale size={15} /> Default weight unit</span><select {...register("weightUnit")}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label>
          <label className="settings-field"><span>Focus session (minutes)</span><input type="number" min="5" max="120" step="1" {...register("focusMinutes", { valueAsNumber: true })} />{errors.focusMinutes && <small role="alert">{errors.focusMinutes.message}</small>}</label>
          <label className="settings-field"><span>Break (minutes)</span><input type="number" min="5" max="60" step="1" {...register("breakMinutes", { valueAsNumber: true })} />{errors.breakMinutes && <small role="alert">{errors.breakMinutes.message}</small>}</label>
        </div>
        <p className="settings-hint">Changing timer lengths affects the next session, not a timer already running.</p>
      </section>

      <section className="settings-card settings-prayer">
        <div className="settings-heading"><span><Clock3 size={18} /></span><div><h2>Prayer anchors</h2><p>Set fixed reference times for moving delayed tasks into the next prayer card.</p></div></div>
        <div className="settings-prayer-grid">
          {([["fajr", "Fajr"], ["dhuhr", "Dhuhr"], ["asr", "Asr"], ["maghrib", "Maghrib"], ["isha", "Isha"]] as const).map(([key, label]) => <label className="settings-field" key={key}>{label}<input type="time" {...register(`prayerTimes.${key}`)} /></label>)}
        </div>
        <p className="settings-hint">These are manual reference times; IronTrack does not calculate or change them. Prayer reminders use these times when enabled below. Leave a time blank to skip that prayer reminder.</p>
      </section>

      <section className="settings-card settings-notifications">
        <div className="settings-heading"><span>{notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}</span><div><h2>Notifications</h2><p>One control for focus timers, routine, workout, wellness, and prayer reminders.</p></div></div>
        <div className="settings-notification"><div><strong>{notificationsEnabled ? "Enabled for this device" : permissionText}</strong><span>{notificationPermission === "denied" ? "Allow notifications in your browser’s site settings, then try again." : "Background delivery is enabled automatically when the server supports it."}</span></div><button className="settings-secondary" type="button" role="switch" aria-checked={notificationsEnabled} disabled={notificationBusy || notificationPermission === "denied" || notificationPermission === "unsupported"} onClick={() => void toggleNotifications()}>{notificationBusy ? "Updating…" : notificationsEnabled ? "Turn off" : "Enable notifications"}</button></div>
      </section>

      <ReminderSettings user={user} onError={onError} />

      {user && <section className="settings-security"><ShieldCheck size={17} /><span><b>Private account data</b> Your routines, weight logs, workouts, and analytics are tied to your account.</span></section>}
      <div className="settings-actions"><button className="settings-save" type="submit" disabled={isSubmitting || (!isDirty && Boolean(user))}><Save size={16} />{isSubmitting ? "Saving…" : "Save settings"}</button></div>
    </form>
    {user && <section className="settings-layout"><section className="settings-delete">
        <div><h2>Delete account and data</h2><p>This permanently deletes your account, workouts, routines, wellness and weight records, and signed-in sessions. This cannot be undone.</p></div>
        <label className="settings-field">Current password<input type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></label>
        <label className="settings-field">Type DELETE to confirm<input autoComplete="off" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} aria-describedby="delete-account-hint" /></label>
        <small id="delete-account-hint">Deletion starts immediately after the server verifies your password.</small>
        {deleteError && <div className="auth-error" role="alert">{deleteError}</div>}
        <button className="settings-delete-button" type="button" disabled={isDeleting} onClick={() => void deleteAccount()}>
          <Trash2 size={16} />{isDeleting ? "Deleting account…" : "Permanently delete account"}
        </button>
      </section></section>}
  </>;
}
