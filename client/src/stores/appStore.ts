import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ironToday } from "../utils/date";
import type { AuthUser } from "../types";

type Preferences = AuthUser["preferences"];
const defaultPreferences: Preferences = { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15 };

type AppState = {
  selectedDate: string;
  analyticsDays: number;
  preferences: Preferences;
  setSelectedDate: (date: string) => void;
  setAnalyticsDays: (days: number) => void;
  setPreferences: (preferences: Preferences) => void;
};

export const useAppStore = create<AppState>()(persist(set => ({
  selectedDate: ironToday(),
  analyticsDays: 7,
  preferences: defaultPreferences,
  setSelectedDate: selectedDate => set({ selectedDate }),
  setAnalyticsDays: analyticsDays => set({ analyticsDays }),
  setPreferences: preferences => set({ preferences }),
}), {
  name: "irontrack_settings",
  partialize: state => ({ preferences: state.preferences }) as AppState,
}));
