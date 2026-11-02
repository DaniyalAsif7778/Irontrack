import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ironToday } from "../utils/date";
import { DEFAULT_PRAYER_TIMES, type AnalyticsPeriod, type AuthUser } from "../types";

type Preferences = AuthUser["preferences"];
const defaultPreferences: Preferences = { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: DEFAULT_PRAYER_TIMES };

type AppState = {
  selectedDate: string;
  analyticsPeriod: AnalyticsPeriod;
  preferences: Preferences;
  setSelectedDate: (date: string) => void;
  setAnalyticsPeriod: (period: AnalyticsPeriod) => void;
  setPreferences: (preferences: Preferences) => void;
};

export const useAppStore = create<AppState>()(persist(set => ({
  selectedDate: ironToday(),
  analyticsPeriod: "7d",
  preferences: defaultPreferences,
  setSelectedDate: selectedDate => set({ selectedDate }),
  setAnalyticsPeriod: analyticsPeriod => set({ analyticsPeriod }),
  setPreferences: preferences => set({ preferences }),
}), {
  name: "irontrack_settings",
  partialize: state => ({ preferences: state.preferences }) as AppState,
  merge: (persisted, current) => {
    const stored = persisted as Partial<AppState> | undefined;
    return { ...current, ...stored, preferences: { ...defaultPreferences, ...stored?.preferences, prayerTimes: { ...DEFAULT_PRAYER_TIMES, ...stored?.preferences?.prayerTimes } } };
  },
}));
