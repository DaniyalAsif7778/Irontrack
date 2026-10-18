import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api/api";
import type { AnalyticsData } from "../types";
import { queryKeys } from "./queryKeys";
import { ironToday } from "../utils/date";

export function useAnalytics(days: number) {
  const today = ironToday();
  return useQuery({ queryKey: [...queryKeys.analytics, days, today], queryFn: () => api<AnalyticsData>(`/analytics?days=${days}&today=${today}`) });
}
