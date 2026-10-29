export type Task = {
  _id: string;
  title: string;
  description: string;
  type: string;
  priority: "low" | "medium" | "high";
  category: string;
  duration: number;
  dueDate: string;
  reminderTime: string;
  startTime: string;
  endTime: string;
  occurrence?: {
    _id: string;
    status: "planned" | "queued" | "active" | "completed" | "deferred";
    startAt: string | null;
    endAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    timezone: string;
    workMinutes: number;
    extensionCount: number;
  } | null;
  section?: string;
  status?: "pending" | "completed";
  subtasks: { title: string; completed: boolean }[];
  completed?: boolean;
};

export type RoutineBlock = {
  id: string;
  label: string;
  tasks: Task[];
  completed: number;
  total: number;
};

export type Day = {
  date: string;
  dayType: "weekday" | "weekend";
  blocks: RoutineBlock[];
  progress: { completed: number; total: number };
};

export type Schedule = {
  dayType: "weekday" | "weekend";
  blocks: { id: string; label: string; tasks: Task[] }[];
};

export type TaskEditing = { block: string; task?: Task };

export type Weight = { _id: string; date: string; weight: number; unit: "kg" | "lb" };
export type WellnessDay = { date: string; waterGlasses: number; movementBreaks: number };
export type PrayerTimes = Record<"fajr" | "dhuhr" | "asr" | "maghrib" | "isha", string>;
export const DEFAULT_PRAYER_TIMES: PrayerTimes = { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" };

export type AnalyticsData = {
  days: number;
  totalCompleted: number;
  periodCompleted: number;
  activity: { date: string; completed: number; total: number; rate: number }[];
  weightTrend: {
    entries: Pick<Weight, "date" | "weight" | "unit">[];
    latest: Pick<Weight, "date" | "weight" | "unit"> | null;
    change: number | null;
  };
};

export type AppView = "home" | "workout" | "routine" | "analytics" | "weight" | "schedules" | "settings" | "wellness";
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  preferences: { weightUnit: "kg" | "lb"; focusMinutes: number; breakMinutes: number; prayerTimes: PrayerTimes };
};
