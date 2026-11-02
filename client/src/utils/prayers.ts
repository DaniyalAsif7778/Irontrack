import type { PrayerTimes } from "../types";

const prayerLabels = [["fajr", "Fajr"], ["dhuhr", "Dhuhr"], ["asr", "Asr"], ["maghrib", "Maghrib"], ["isha", "Isha"]] as const;

export function prayersDueAt(prayerTimes: PrayerTimes, time: string) {
  return prayerLabels.filter(([key]) => prayerTimes[key] === time).map(([key, label]) => ({ key, label }));
}
