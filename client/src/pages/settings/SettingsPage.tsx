import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, BellOff, CircleUserRound, Clock3, Scale, Save, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "../../lib/api/api";
import { settingsSchema, type SettingsValues } from "../../schemas/settings";
import { useAppStore } from "../../stores/appStore";
import { DEFAULT_PRAYER_TIMES } from "../../types";
import type { AuthUser } from "../../types";

const sessionKey = ["auth", "me"] as const;
type AuthSessionEntry = { id: string; userAgent: string; ipAddress: string; createdAt: string; lastSeenAt: string; current: boolean };

function deviceName(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "Unknown browser";
  const device = /iPhone|Android|Mobile/i.test(userAgent) ? "Mobile device" : /iPad|Tablet/i.test(userAgent) ? "Tablet" : "Computer";
  return `${browser} on ${device}`;
}

export default function SettingsPage({ user }: { user: AuthUser | null }) {
  const queryClient = useQueryClient();
  const localPreferences = useAppStore(state => state.preferences);
  const setPreferences = useAppStore(state => state.setPreferences);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
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

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") toast.success("Focus timer notifications enabled");
      else if (permission === "denied") toast.error("Notifications are blocked in browser settings");
    } catch {
      toast.error("Your browser could not request notification permission");
    }
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
      <section className="settings-card">
        <div className="settings-heading"><span><CircleUserRound size={18} /></span><div><h2>Account</h2><p>Your profile and sign-in identity.</p></div></div>
        {user ? <>
          <label className="settings-field">Display name<input {...register("name")} autoComplete="name" />{errors.name && <small role="alert">{errors.name.message}</small>}</label>
          <label className="settings-field">Email address<input value={user.email} readOnly disabled /><small>Email changes are not available yet.</small></label>
        </> : <div className="settings-note"><strong>Local demo</strong><span>Preferences are saved on this device. Sign-in and profile settings are available when the API is connected.</span></div>}
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

      <section className="settings-card">
        <div className="settings-heading"><span><Clock3 size={18} /></span><div><h2>Training defaults</h2><p>Used for new logs and newly started focus timers.</p></div></div>
        <div className="settings-fields">
          <label className="settings-field"><span><Scale size={15} /> Default weight unit</span><select {...register("weightUnit")}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label>
          <label className="settings-field"><span>Focus session (minutes)</span><input type="number" min="5" max="120" step="1" {...register("focusMinutes", { valueAsNumber: true })} />{errors.focusMinutes && <small role="alert">{errors.focusMinutes.message}</small>}</label>
          <label className="settings-field"><span>Break (minutes)</span><input type="number" min="5" max="60" step="1" {...register("breakMinutes", { valueAsNumber: true })} />{errors.breakMinutes && <small role="alert">{errors.breakMinutes.message}</small>}</label>
        </div>
        <p className="settings-hint">Changing timer lengths affects the next session, not a timer already running.</p>
      </section>

      <section className="settings-card">
        <div className="settings-heading"><span><Clock3 size={18} /></span><div><h2>Prayer anchors</h2><p>Set fixed reference times for moving delayed tasks into the next prayer card.</p></div></div>
        <div className="settings-prayer-grid">
          {([["fajr", "Fajr"], ["dhuhr", "Dhuhr"], ["asr", "Asr"], ["maghrib", "Maghrib"], ["isha", "Isha"]] as const).map(([key, label]) => <label className="settings-field" key={key}>{label}<input type="time" {...register(`prayerTimes.${key}`)} /></label>)}
        </div>
        <p className="settings-hint">These are manual reference times; IronTrack does not calculate or change them. They do not overwrite a task’s saved start time. Leave a time blank to use a prayer task’s time as the fallback anchor.</p>
      </section>

      <section className="settings-card">
        <div className="settings-heading"><span>{notificationPermission === "granted" ? <Bell size={18} /> : <BellOff size={18} />}</span><div><h2>Notifications</h2><p>Get a browser alert when a focus or break timer ends.</p></div></div>
        <div className="settings-notification"><div><strong>{permissionText}</strong><span>Permission is controlled by your browser and this device.</span></div><button className="settings-secondary" type="button" disabled={notificationPermission === "granted" || notificationPermission === "denied" || notificationPermission === "unsupported"} onClick={() => void enableNotifications()}>{notificationPermission === "granted" ? "Enabled" : notificationPermission === "denied" ? "Blocked" : "Enable notifications"}</button></div>
      </section>

      {user && <section className="settings-security"><ShieldCheck size={17} /><span><b>Private account data</b> Your routines, weight logs, workouts, and analytics are tied to your account.</span></section>}
      <div className="settings-actions"><button className="settings-save" type="submit" disabled={isSubmitting || (!isDirty && Boolean(user))}><Save size={16} />{isSubmitting ? "Saving…" : "Save settings"}</button></div>
    </form>
  </>;
}
