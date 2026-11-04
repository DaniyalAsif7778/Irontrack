import { RoutineCompletion, RoutineTask } from "../../models/routine/routine.model.js";
import { WeightLog } from "../../models/weight/weight.model.js";
import { User } from "../../models/auth/user.model.js";
import { analyticsPeriodLabel, analyticsRange, type AnalyticsPeriod } from "../../utils/analyticsPeriod.js";

export async function getAnalytics(ownerId: string, period: AnalyticsPeriod, today: string) {
  const range = analyticsRange(period, today);
  const dates = Array.from({ length: range.days }, (_, index) => {
    const day = new Date(`${range.startDate}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
  const [tasks, weights, user] = await Promise.all([
    RoutineTask.find({ ownerId }).select("_id dayType").lean(),
    WeightLog.find({ ownerId, date: { $gte: range.startDate, $lte: range.endDate } }).sort({ date: 1 }).lean(),
    User.findById(ownerId).select("preferences.weightUnit").lean(),
  ]);
  const weekdayTaskCount = tasks.filter(task => task.dayType === "weekday").length;
  const weekendTaskCount = tasks.filter(task => task.dayType === "weekend").length;
  const taskIds = tasks.map(task => task._id);
  const [completions, totalCompleted] = await Promise.all([
    RoutineCompletion.find({ taskId: { $in: taskIds }, date: { $in: dates }, completed: true }).select("date taskId").lean(),
    RoutineCompletion.countDocuments({ taskId: { $in: taskIds }, completed: true }),
  ]);
  const completedByDate = new Map<string, number>();
  completions.forEach(item => completedByDate.set(item.date, (completedByDate.get(item.date) ?? 0) + 1));
  const dailyActivity = dates.map(date => {
    const total = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? weekendTaskCount : weekdayTaskCount;
    const completed = completedByDate.get(date) ?? 0;
    return { date, completed, total, rate: total ? Math.round(completed / total * 100) : 0 };
  });
  const activity = range.granularity === "day" ? dailyActivity : [...new Set(dates.map(date => date.slice(0, 7)))].map(month => {
    const rows = dailyActivity.filter(day => day.date.startsWith(month));
    const completed = rows.reduce((sum, day) => sum + day.completed, 0);
    const total = rows.reduce((sum, day) => sum + day.total, 0);
    return { date: `${month}-01`, completed, total, rate: total ? Math.round(completed / total * 100) : 0 };
  });
  const displayUnit = user?.preferences?.weightUnit === "lb" ? "lb" : "kg";
  const trendEntries = weights.map(weight => {
    const converted = weight.unit === displayUnit ? weight.weight : displayUnit === "lb" ? weight.weight * 2.2046226218 : weight.weight / 2.2046226218;
    return { date: weight.date, weight: Number(converted.toFixed(2)), unit: displayUnit };
  });
  const latestWeight = trendEntries.at(-1) ?? null;
  const firstWeight = trendEntries[0] ?? null;
  return {
    period, periodLabel: analyticsPeriodLabel(period), startDate: range.startDate, endDate: range.endDate,
    days: range.days, granularity: range.granularity, activity, totalCompleted, periodCompleted: completions.length,
    weightTrend: {
      entries: trendEntries,
      latest: latestWeight,
      change: latestWeight && firstWeight ? Number((latestWeight.weight - firstWeight.weight).toFixed(2)) : null,
    },
  };
}
