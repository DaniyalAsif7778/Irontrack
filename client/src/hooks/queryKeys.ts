export const queryKeys = {
  routine: {
    days: ["routine", "day"] as const,
    day: (date: string) => ["routine", "day", date] as const,
    schedules: ["routine", "schedule"] as const,
    schedule: (dayType: string) => ["routine", "schedule", dayType] as const,
  },
  weights: ["weight-logs"] as const,
  analytics: ["analytics"] as const,
  wellness: (date: string) => ["wellness", date] as const,
};
