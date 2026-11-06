import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api/api";
import type { AnalyticsData, AnalyticsPeriod } from "../types";
import { queryKeys } from "./queryKeys";
import { ironToday } from "../utils/date";

export function useAnalytics(period: AnalyticsPeriod, enabled = true) {
  const today = ironToday();
  return useQuery({
    queryKey: [...queryKeys.analytics, period, today],
    queryFn: () => api<AnalyticsData>(`/analytics?period=${period}&today=${today}`),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: previous => previous,
  });
}
