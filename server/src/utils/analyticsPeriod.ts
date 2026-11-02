export const ANALYTICS_PERIODS = ["7d", "30d", "90d", "this-month", "previous-month", "3m", "6m", "1y", "2y", "3y"] as const;
export type AnalyticsPeriod = typeof ANALYTICS_PERIODS[number];
export type AnalyticsRange = { startDate: string; endDate: string; days: number; granularity: "day" | "month" };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export function analyticsRange(period: AnalyticsPeriod, today: string): AnalyticsRange {
  const [, month, day] = today.split("-").map(Number);
  const [year] = today.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day));
  let start: Date;
  let granularity: AnalyticsRange["granularity"] = "day";

  if (period === "this-month") start = new Date(Date.UTC(year, month - 1, 1));
  else if (period === "previous-month") {
    start = new Date(Date.UTC(year, month - 2, 1));
    end.setUTCDate(0);
  } else if (["3m", "6m", "1y", "2y", "3y"].includes(period)) {
    const months = period === "3m" ? 3 : period === "6m" ? 6 : period === "1y" ? 12 : period === "2y" ? 24 : 36;
    start = new Date(Date.UTC(year, month - months, 1));
    granularity = "month";
  } else {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);
  }

  const startDate = dateKey(start);
  const endDate = dateKey(end);
  const days = Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
  return { startDate, endDate, days, granularity };
}

export function analyticsPeriodLabel(period: AnalyticsPeriod) {
  const labels: Record<AnalyticsPeriod, string> = {
    "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days",
    "this-month": "This month", "previous-month": "Previous month",
    "3m": "Last 3 months", "6m": "Last 6 months", "1y": "Last 12 months",
    "2y": "Last 2 years", "3y": "Last 3 years",
  };
  return labels[period];
}
