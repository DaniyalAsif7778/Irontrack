import { RoutineCompletion, RoutineTask } from "../../models/routine/routine.model.js";
import { WeightLog } from "../../models/weight/weight.model.js";
import { User } from "../../models/auth/user.model.js";

export async function getAnalytics(ownerId: string, days: number, today: string) {
  const [year, month, dateOfMonth] = today.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, dateOfMonth));
  const dates = Array.from({ length: days }, (_, index) => {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - (days - index - 1));
    return day.toISOString().slice(0, 10);
  });
  const [weekdayTasks, weekendTasks, allTasks, weights, user] = await Promise.all([
    RoutineTask.find({ ownerId, dayType: "weekday" }).select("_id").lean(),
    RoutineTask.find({ ownerId, dayType: "weekend" }).select("_id").lean(),
    RoutineTask.find({ ownerId }).select("_id").lean(),
    WeightLog.find({ ownerId, date: { $gte: dates[0] } }).sort({ date: 1 }).lean(),
    User.findById(ownerId).select("preferences.weightUnit").lean(),
  ]);
  const taskIds = allTasks.map(task => task._id);
  const [completions, totalCompleted] = await Promise.all([
    RoutineCompletion.find({ taskId: { $in: taskIds }, date: { $in: dates }, completed: true }).select("date taskId").lean(),
    RoutineCompletion.countDocuments({ taskId: { $in: taskIds }, completed: true }),
  ]);
  const completedByDate = new Map<string, number>();
  completions.forEach(item => completedByDate.set(item.date, (completedByDate.get(item.date) ?? 0) + 1));
  const activity = dates.map(date => {
    const total = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? weekendTasks.length : weekdayTasks.length;
    const completed = completedByDate.get(date) ?? 0;
    return { date, completed, total, rate: total ? Math.round(completed / total * 100) : 0 };
  });
  const displayUnit = user?.preferences?.weightUnit === "lb" ? "lb" : "kg";
  const trendEntries = weights.map(weight => {
    const converted = weight.unit === displayUnit ? weight.weight : displayUnit === "lb" ? weight.weight * 2.2046226218 : weight.weight / 2.2046226218;
    return { date: weight.date, weight: Number(converted.toFixed(2)), unit: displayUnit };
  });
  const latestWeight = trendEntries.at(-1) ?? null;
  const firstWeight = trendEntries[0] ?? null;
  return {
    days, activity, totalCompleted, periodCompleted: completions.length,
    weightTrend: {
      entries: trendEntries,
      latest: latestWeight,
      change: latestWeight && firstWeight ? Number((latestWeight.weight - firstWeight.weight).toFixed(2)) : null,
    },
  };
}
