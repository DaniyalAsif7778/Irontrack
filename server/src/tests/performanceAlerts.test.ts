import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workoutFind: vi.fn(),
  workoutProgramFindOne: vi.fn(),
  workoutExists: vi.fn(),
  taskFind: vi.fn(),
  completionDistinct: vi.fn(),
  completionExists: vi.fn(),
  eventExists: vi.fn(),
  eventCreate: vi.fn(),
  sendPush: vi.fn(),
}));

vi.mock("../models/workout/workout.model.js", () => ({
  WorkoutLog: { find: mocks.workoutFind, exists: mocks.workoutExists },
  WorkoutProgram: { findOne: mocks.workoutProgramFindOne },
  WORKOUT_WEEKDAYS: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
}));
vi.mock("../models/routine/routine.model.js", () => ({
  RoutineTask: { find: mocks.taskFind },
  RoutineCompletion: { distinct: mocks.completionDistinct, exists: mocks.completionExists },
  RoutineEvent: { exists: mocks.eventExists, create: mocks.eventCreate },
}));
vi.mock("../services/notifications/push.service.js", () => ({ sendOwnerPerformancePush: mocks.sendPush }));

import { WorkoutLog } from "../models/workout/workout.model.js";
import { RoutineCompletion, RoutineEvent, RoutineTask } from "../models/routine/routine.model.js";
import { sendOwnerPerformancePush } from "../services/notifications/push.service.js";
import { evaluateMissedWorkoutNudge, evaluateRoutineStreak, evaluateWorkoutPerformance } from "../services/notifications/performance-alerts.service.js";

const ownerId = "owner-1";
const currentWorkout = (overrides: Record<string, unknown> = {}) => ({
  _id: "workout-current",
  date: "2026-11-06",
  dayType: "upper",
  totalVolume: 1000,
  exercises: [{ exerciseId: "row", sets: [{ reps: 5, weight: 100 }] }],
  ...overrides,
});

function historyQuery(rows: unknown[]) {
  const query = {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
  mocks.workoutFind.mockReturnValue(query);
  return query;
}

function historyVolumes(volumes: number[]) {
  return volumes.map((totalVolume, index) => {
    const date = new Date(Date.UTC(2026, 10, 5 - index)).toISOString().slice(0, 10);
    return { date, dayType: "upper", totalVolume, exercises: [] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendPush.mockResolvedValue({ configured: true, subscribed: true, sent: 1, failed: 0 });
  mocks.workoutExists.mockResolvedValue(null);
  mocks.completionExists.mockResolvedValue(null);
  mocks.eventExists.mockResolvedValue(null);
  mocks.eventCreate.mockResolvedValue({});
});

describe("performance and reminder milestones", () => {
  it("notifies once when a workout exceeds the best estimated lift for an exercise", async () => {
    historyQuery([{ _id: "workout-old", date: "2026-11-01", dayType: "upper", totalVolume: 900, exercises: [{ exerciseId: "row", sets: [{ reps: 5, weight: 90 }] }] }]);

    const feedback = await evaluateWorkoutPerformance(ownerId, currentWorkout() as never);

    expect(feedback).toEqual([{ type: "personal_record", title: "New personal best 🎉", message: "You set a new best in this workout. Keep building at your pace." }]);
    expect(sendOwnerPerformancePush).toHaveBeenCalledWith(ownerId, "performance:pr:workout-current", expect.any(String), expect.any(String), "/workout", "personal_record");
  });

  it("does not announce a tied or lower estimated max", async () => {
    historyQuery([{ _id: "workout-old", date: "2026-11-01", dayType: "upper", totalVolume: 900, exercises: [{ exerciseId: "row", sets: [{ reps: 5, weight: 100 }] }] }]);

    await evaluateWorkoutPerformance(ownerId, currentWorkout() as never);

    expect(sendOwnerPerformancePush).not.toHaveBeenCalled();
  });

  it("announces two consecutive low-volume sessions against four prior sessions", async () => {
    historyQuery(historyVolumes([80, 85, 110, 100, 105, 115]));

    const feedback = await evaluateWorkoutPerformance(ownerId, currentWorkout({ exercises: [] }) as never);

    expect(feedback.map(item => item.type)).toEqual(["down_week"]);
    expect(sendOwnerPerformancePush).toHaveBeenCalledWith(ownerId, expect.stringMatching(/^performance:down-week:upper:/), "A gentler training week?", expect.any(String), "/analytics", "down_week");
  });

  it("does not label one isolated low-volume session as a down week", async () => {
    historyQuery(historyVolumes([80, 110, 110, 100, 105, 115]));

    await evaluateWorkoutPerformance(ownerId, currentWorkout({ totalVolume: 100, exercises: [] }) as never);

    expect(sendOwnerPerformancePush).not.toHaveBeenCalled();
  });

  it("sends a streak milestone only when all three consecutive routine dates have completions", async () => {
    mocks.taskFind.mockReturnValue({ distinct: vi.fn().mockResolvedValue(["task-1"]) });
    mocks.completionDistinct.mockResolvedValue(["2026-11-06", "2026-11-05", "2026-11-04"]);

    await expect(evaluateRoutineStreak(ownerId, "2026-11-06")).resolves.toBe(true);

    expect(RoutineCompletion.distinct).toHaveBeenCalledWith("date", expect.objectContaining({ completed: true }));
    expect(sendOwnerPerformancePush).toHaveBeenCalledWith(ownerId, "performance:streak:2026-11-06", expect.any(String), expect.any(String), "/routine", "milestone");

    vi.clearAllMocks();
    mocks.taskFind.mockReturnValue({ distinct: vi.fn().mockResolvedValue(["task-1"]) });
    mocks.completionDistinct.mockResolvedValue(["2026-11-06", "2026-11-04"]);
    await expect(evaluateRoutineStreak(ownerId, "2026-11-06")).resolves.toBe(false);
    expect(sendOwnerPerformancePush).not.toHaveBeenCalled();
  });

  it("nudges for an uncompleted scheduled workout yesterday and observes the seven-day cooldown", async () => {
    mocks.workoutProgramFindOne.mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ days: [{ key: "thu", planId: "upper" }] }) });
    const now = new Date("2026-11-06T12:00:00.000Z");

    await expect(evaluateMissedWorkoutNudge(ownerId, "UTC", now)).resolves.toBe(true);

    expect(WorkoutLog.exists).toHaveBeenCalledWith({ ownerId, date: "2026-11-05", dayType: "upper" });
    expect(RoutineEvent.create).toHaveBeenCalledWith(expect.objectContaining({ type: "gentle_nudge", date: "2026-11-06" }));
    expect(sendOwnerPerformancePush).toHaveBeenCalledWith(ownerId, "gentle-nudge:missed-workout:2026-11-05:upper", expect.any(String), expect.any(String), "/workout", "gentle_nudge");

    vi.clearAllMocks();
    mocks.workoutProgramFindOne.mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ days: [{ key: "thu", planId: "upper" }] }) });
    mocks.eventExists.mockResolvedValue({ _id: "recent-nudge" });
    await expect(evaluateMissedWorkoutNudge(ownerId, "UTC", now)).resolves.toBe(false);
    expect(RoutineEvent.create).not.toHaveBeenCalled();
  });
});
