export type ReminderPreferences = {
  taskTimes: boolean;
  workoutAtNine: boolean;
  hydration: boolean;
  movement: boolean;
  prayerTimes: boolean;
  performanceAlerts: boolean;
};

export const reminderStorageKey = "irontrack_reminder_preferences_v1";
export const pushSubscribedKey = "irontrack_push_subscribed_v1";
export const defaultReminderPreferences: ReminderPreferences = {
  taskTimes: true,
  workoutAtNine: true,
  hydration: false,
  movement: false,
  prayerTimes: false,
  performanceAlerts: true,
};

export function readReminderPreferences(): ReminderPreferences {
  try {
    return { ...defaultReminderPreferences, ...JSON.parse(localStorage.getItem(reminderStorageKey) ?? "{}") };
  } catch {
    return defaultReminderPreferences;
  }
}
