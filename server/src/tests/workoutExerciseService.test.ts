import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPlan: vi.fn(), findPlans: vi.fn(), planUpdate: vi.fn(), planUpsert: vi.fn(), countPlans: vi.fn(),
  findProgram: vi.fn(), saveProgram: vi.fn(), exerciseUpdate: vi.fn(), libraryBulk: vi.fn(), plansBulk: vi.fn(), deletePlans: vi.fn(),
}));
vi.mock("../models/workout/workout.model.js", () => ({
  ExerciseLibrary: { findOneAndUpdate: mocks.exerciseUpdate, bulkWrite: mocks.libraryBulk },
  WorkoutLog: {},
  WorkoutPlan: { findOne: mocks.findPlan, find: mocks.findPlans, findOneAndUpdate: mocks.planUpsert, updateOne: mocks.planUpdate, countDocuments: mocks.countPlans, bulkWrite: mocks.plansBulk, deleteMany: mocks.deletePlans },
  WorkoutProgram: { findOne: mocks.findProgram, findOneAndUpdate: mocks.saveProgram },
  WORKOUT_WEEKDAYS: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  WORKOUT_WEEKDAY_LABELS: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" },
}));

import { savePlanExercise, saveWorkoutProgram } from "../services/workout/workout.service.js";

const ownerId = "507f1f77bcf86cd799439011";
const exercise = { id: "row", name: "Dumbbell Row", muscle: "Back", sets: 2, reps: 8, rest: 60, tempo: "3-1-2", cues: [], description: "", setList: [{ id: "set-1", reps: 8, weight: 20 }, { id: "set-2", reps: 8, weight: 20 }], steps: [], videoUrl: "" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findPlan.mockReturnValue({ lean: vi.fn().mockResolvedValue({ dayType: "day-pull", exercises: [] }) });
  mocks.findProgram.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  mocks.findPlans.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) });
  mocks.planUpdate.mockResolvedValue({ acknowledged: true });
  mocks.planUpsert.mockResolvedValue({ acknowledged: true });
  mocks.countPlans.mockResolvedValue(0);
  mocks.saveProgram.mockImplementation((_filter, update) => ({ lean: vi.fn().mockResolvedValue({ days: update.$set.days }) }));
  mocks.exerciseUpdate.mockResolvedValue({ acknowledged: true });
  mocks.libraryBulk.mockResolvedValue({ acknowledged: true });
  mocks.plansBulk.mockResolvedValue({ acknowledged: true });
  mocks.deletePlans.mockResolvedValue({ acknowledged: true });
});

describe("focused workout exercise saves", () => {
  it("updates one day's reference and shared exercise definition without requiring transactions", async () => {
    await expect(savePlanExercise(ownerId, "day-pull", exercise)).resolves.toEqual(exercise);

    expect(mocks.exerciseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: "row" }),
      expect.objectContaining({ $set: expect.objectContaining({ name: "Dumbbell Row", muscle: "Back" }) }),
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    expect(mocks.planUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ dayType: "day-pull" }),
      { $push: { exercises: expect.objectContaining({ exerciseId: "row", sets: 2, reps: 8 }) } },
      expect.objectContaining({ runValidators: true }),
    );
  });

  it("replaces the matching reference instead of pushing a duplicate", async () => {
    mocks.findPlan.mockReturnValue({ lean: vi.fn().mockResolvedValue({ dayType: "day-pull", exercises: [{ exerciseId: "row" }] }) });

    await savePlanExercise(ownerId, "day-pull", exercise);

    expect(mocks.planUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ "exercises.exerciseId": "row" }),
      { $set: { "exercises.$": expect.objectContaining({ exerciseId: "row", sets: 2, reps: 8 }) } },
      expect.objectContaining({ runValidators: true }),
    );
    expect(mocks.planUpdate.mock.calls[0][1]).not.toHaveProperty("$push");
  });

  it("creates and assigns a new workout day when its first exercise is saved", async () => {
    mocks.findPlan.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(savePlanExercise(ownerId, "day-back", exercise, "Back day", "thu")).resolves.toEqual(exercise);

    expect(mocks.planUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ dayType: "day-back" }),
      { $setOnInsert: expect.objectContaining({ name: "Back day", exercises: [expect.objectContaining({ exerciseId: "row" })] }) },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    expect(mocks.saveProgram).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: expect.anything() }),
      { $set: { ownerId: expect.anything(), days: expect.arrayContaining([expect.objectContaining({ key: "thu", planId: "day-back" })]) } },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    expect(mocks.planUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ dayType: "day-back", "exercises.exerciseId": { $ne: "row" } }),
      { $push: { exercises: expect.objectContaining({ exerciseId: "row" }) } },
      { runValidators: true },
    );
  });

  it("persists workout name and schedule changes without requiring MongoDB transactions", async () => {
    const data = {
      plans: [{ id: "day-pull", name: "Back day", exercises: [{ exerciseId: "row", sets: 2, reps: 8, rest: 60, tempo: "4-2-3", setList: [] }] }],
      exerciseLibrary: [{ id: "row", name: "Dumbbell Row", muscle: "Back", description: "", cues: [], steps: [], videoUrl: "" }],
      days: [{ key: "thu", label: "Thursday", planId: "day-pull" }],
    };

    await expect(saveWorkoutProgram(ownerId, data as never)).resolves.toBeUndefined();

    expect(mocks.libraryBulk).toHaveBeenCalledOnce();
    expect(mocks.plansBulk).toHaveBeenCalledOnce();
    expect(mocks.deletePlans).toHaveBeenCalledOnce();
    expect(mocks.saveProgram).toHaveBeenCalledOnce();
    expect(mocks.libraryBulk.mock.invocationCallOrder[0]).toBeLessThan(mocks.plansBulk.mock.invocationCallOrder[0]);
    expect(mocks.plansBulk.mock.invocationCallOrder[0]).toBeLessThan(mocks.deletePlans.mock.invocationCallOrder[0]);
    expect(mocks.deletePlans.mock.invocationCallOrder[0]).toBeLessThan(mocks.saveProgram.mock.invocationCallOrder[0]);
  });
});
