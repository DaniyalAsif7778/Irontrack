import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api/api";
import type { AnalyticsData } from "../types";
import { queryKeys } from "./queryKeys";

export function useAnalytics(days: number) {
  return useQuery({ queryKey: [...queryKeys.analytics, days], queryFn: () => api<AnalyticsData>(`/analytics?days=${days}`) });
}
