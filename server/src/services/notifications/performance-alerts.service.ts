import { WorkoutLog, WorkoutProgram, WORKOUT_WEEKDAYS } from "../../models/workout/workout.model.js";
import { RoutineCompletion, RoutineTask } from "../../models/routine/routine.model.js";
import { RoutineEvent } from "../../models/routine/routine.model.js";
import { sendOwnerPerformancePush } from "./push.service.js";

type LoggedWorkout = {
  _id: unknown;
  date: string;
  dayType: string;
  totalVolume: number;
  exercises: { exerciseId: string; sets: { reps: number; weight: number }[] }[];
};

function estimatedMax(workout: LoggedWorkout, exerciseId: string) {
  return Math.max(0, ...workout.exercises
    .filter(exercise => exercise.exerciseId === exerciseId)
    .flatMap(exercise => exercise.sets.map(set => set.weight * (1 + set.reps / 30))));
}

/** Evaluate only after a workout has been persisted. Push keys make retries safe across devices. */
export async function evaluateWorkoutPerformance(ownerId: string, current: LoggedWorkout) {
  const history = await WorkoutLog.find({ ownerId, dayType: current.dayType, _id: { $ne: current._id } })
    .sort({ date: -1, completedAt: -1 }).limit(8).lean() as unknown as LoggedWorkout[];
  const previousByExercise = new Map<string, number>();
  for (const workout of history) for (const exercise of workout.exercises) {
    previousByExercise.set(exercise.exerciseId, Math.max(previousByExercise.get(exercise.exerciseId) ?? 0, estimatedMax(workout, exercise.exerciseId)));
  }

  const prIds = [...new Set(current.exercises
    .filter(exercise => Math.max(0, ...exercise.sets.map(set => set.weight * (1 + set.reps / 30))) > (previousByExercise.get(exercise.exerciseId) ?? 0) + 0.01)
    .map(exercise => exercise.exerciseId))];
  const feedback: { type: "personal_record" | "down_week"; title: string; message: string }[] = [];

  if (prIds.length) {
    feedback.push({ type: "personal_record", title: "New personal best 🎉", message: "You set a new best in this workout. Keep building at your pace." });
    await sendOwnerPerformancePush(ownerId, `performance:pr:${String(current._id)}`, "New personal best 🎉", "Your workout includes a new personal best. Open IronTrack to see your progress.", "/workout", "personal_record").catch(() => undefined);
  }

  // A down-week requires two consecutive comparable sessions at least 10% below four prior sessions.
  const recent = history.slice(0, 6);
  let episodeStart: string | null = null;
  for (let index = 0; index + 5 < recent.length; index += 1) {
    const baseline = recent.slice(index + 2, index + 6).reduce((sum, item) => sum + item.totalVolume, 0) / 4;
    if (baseline > 0 && recent[index].totalVolume < baseline * 0.9 && recent[index + 1].totalVolume < baseline * 0.9) {
      episodeStart = recent[index + 1].date;
      break;
    }
  }
  if (!episodeStart && recent.length >= 5) {
    const baseline = recent.slice(1, 5).reduce((sum, item) => sum + item.totalVolume, 0) / 4;
    if (baseline > 0 && current.totalVolume < baseline * 0.9 && recent[0].totalVolume < baseline * 0.9) episodeStart = recent[0].date;
  }
  if (episodeStart) {
    const title = "A gentler training week?";
    const message = "Your last sessions were lighter than your recent baseline. Rest and recovery count too.";
    feedback.push({ type: "down_week", title, message });
    await sendOwnerPerformancePush(ownerId, `performance:down-week:${current.dayType}:${episodeStart}`, title, message, "/analytics", "down_week").catch(() => undefined);
  }
  return feedback;
}

/** A consistency milestone is based on persisted completions across three local routine dates. */
export async function evaluateRoutineStreak(ownerId: string, date: string) {
  const taskIds = await RoutineTask.find({ ownerId }).distinct("_id");
  if (!taskIds.length) return false;
  const dates = [date, ...[1, 2].map(offset => {
    const day = new Date(`${date}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() - offset);
    return day.toISOString().slice(0, 10);
  })];
  const completedDates = await RoutineCompletion.distinct("date", { taskId: { $in: taskIds }, date: { $in: dates }, completed: true });
  if (new Set(completedDates).size !== 3) return false;
  const streakStartedYesterday = new Date(`${date}T12:00:00Z`);
  streakStartedYesterday.setUTCDate(streakStartedYesterday.getUTCDate() - 3);
  const previousDate = streakStartedYesterday.toISOString().slice(0, 10);
  if (await RoutineCompletion.exists({ taskId: { $in: taskIds }, date: previousDate, completed: true })) return false;
  const result = await sendOwnerPerformancePush(ownerId, `performance:streak:${date}`, "Three-day consistency streak 🎉", "Three days of showing up. That steady effort adds up.", "/routine", "milestone");
  return result.sent > 0;
}

function dateKeyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Nudge once after a scheduled workout is missed, with a seven-day cooldown to avoid nagging. */
export async function evaluateMissedWorkoutNudge(ownerId: string, timezone: string, now = new Date()) {
  const today = dateKeyInTimezone(now, timezone);
  const missedDateValue = new Date(`${today}T12:00:00Z`);
  missedDateValue.setUTCDate(missedDateValue.getUTCDate() - 1);
  const missedDate = missedDateValue.toISOString().slice(0, 10);
  const weekdayKey = WORKOUT_WEEKDAYS[(missedDateValue.getUTCDay() + 6) % 7];
  const program = await WorkoutProgram.findOne({ ownerId }).select("days").lean();
  const scheduledDay = program?.days?.find(day => day.key === weekdayKey);
  if (!scheduledDay?.planId || await WorkoutLog.exists({ ownerId, date: missedDate, dayType: scheduledDay.planId })) return false;

  const cooldown = new Date(now.getTime() - 7 * 86_400_000);
  if (await RoutineEvent.exists({ ownerId, type: "gentle_nudge", occurredAt: { $gte: cooldown } })) return false;

  const eventId = `gentle-nudge:missed-workout:${missedDate}:${scheduledDay.planId}`;
  try {
    await RoutineEvent.create({
      ownerId,
      eventId,
      idempotencyKey: eventId,
      parentEventId: eventId,
      date: today,
      type: "gentle_nudge",
      occurredAt: now,
      metadata: { missedWorkoutDate: missedDate, dayType: scheduledDay.planId },
    });
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    return false;
  }

  await sendOwnerPerformancePush(
    ownerId,
    eventId,
    "A missed session is just a pause",
    "Your scheduled workout did not happen yesterday. A short session today is still progress.",
    "/workout",
    "gentle_nudge",
  ).catch(() => undefined);
  return true;
}
