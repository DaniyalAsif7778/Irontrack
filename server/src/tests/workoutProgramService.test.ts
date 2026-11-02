import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../models/workout/workout.model.js", () => ({
  WorkoutLog: {},
  ExerciseLibrary: { find: vi.fn(), bulkWrite: vi.fn() },
  WorkoutPlan: { find: vi.fn(), collection: { find: vi.fn() } },
  WorkoutProgram: { findOne: vi.fn() },
  WORKOUT_WEEKDAYS: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  WORKOUT_WEEKDAY_LABELS: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" },
}));

import { ExerciseLibrary, WorkoutPlan, WorkoutProgram } from "../models/workout/workout.model.js";
import { listPlans, listWeek } from "../services/workout/workout.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(WorkoutPlan.collection.find).mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) } as never);
  vi.mocked(ExerciseLibrary.find).mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as never);
});

describe("account-owned workout plans", () => {
  it("does not deliver built-in workouts to a new account", async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const sort = vi.fn().mockReturnValue({ lean });
    vi.mocked(WorkoutPlan.find).mockReturnValue({ sort } as never);

    await expect(listPlans("507f1f77bcf86cd799439011")).resolves.toEqual([]);
    expect(WorkoutPlan.find).toHaveBeenCalledWith({ ownerId: "507f1f77bcf86cd799439011" });
  });

  it("starts a new account with all seven weekdays unassigned as rest days", async () => {
    vi.mocked(WorkoutProgram.findOne).mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
    vi.mocked(WorkoutPlan.find).mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) } as never);

    const week = await listWeek("user-new");
    expect(week).toHaveLength(7);
    expect(week.map(day => day.planId)).toEqual(Array(7).fill(null));
    expect(week.map(day => day.key)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  });
});
