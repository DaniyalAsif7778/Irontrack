import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../models/workout/workout.model.js", () => ({
  WorkoutLog: { findOne: vi.fn(), exists: vi.fn(), create: vi.fn() },
  ExerciseLibrary: { find: vi.fn(), bulkWrite: vi.fn() },
  WorkoutPlan: { find: vi.fn(), collection: { find: vi.fn() } },
  WorkoutProgram: { findOne: vi.fn() },
  WORKOUT_WEEKDAYS: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  WORKOUT_WEEKDAY_LABELS: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" },
}));

import { WorkoutLog } from "../models/workout/workout.model.js";
import { saveLog } from "../services/workout/workout.service.js";
import { workoutLogPayload } from "../utils/workoutValidation.js";

const payload = () => workoutLogPayload({
  date: "2026-11-02",
  dayType: "day-upper",
  actionId: "workout-action-1",
  exercises: [{ exerciseId: "row", name: "Dumbbell row", sets: [{ reps: 8, weight: 20 }] }],
  duration: 600,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(WorkoutLog.findOne).mockResolvedValue(null as never);
  vi.mocked(WorkoutLog.exists).mockResolvedValue(null as never);
});

describe("workout log idempotency", () => {
  it("returns the stored log when concurrent retries race on the idempotency key", async () => {
    const saved = { _id: "saved-log" };
    vi.mocked(WorkoutLog.findOne).mockResolvedValueOnce(null as never).mockResolvedValueOnce(saved as never);
    vi.mocked(WorkoutLog.create).mockRejectedValue({ code: 11000 });

    await expect(saveLog("owner-1", payload())).resolves.toBe(saved);
  });

  it("reports a duplicate workout day when another request wins with a different key", async () => {
    vi.mocked(WorkoutLog.create).mockRejectedValue({ code: 11000 });
    vi.mocked(WorkoutLog.exists).mockResolvedValueOnce(null as never).mockResolvedValueOnce({ _id: "existing-log" } as never);

    await expect(saveLog("owner-1", payload())).resolves.toBeNull();
  });

  it("rethrows non-duplicate database errors", async () => {
    const error = new Error("database unavailable");
    vi.mocked(WorkoutLog.create).mockRejectedValue(error);

    await expect(saveLog("owner-1", payload())).rejects.toBe(error);
  });
});
