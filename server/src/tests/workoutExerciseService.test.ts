import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  findOne: vi.fn(),
  planUpdate: vi.fn(),
  exerciseUpdate: vi.fn(),
}));

vi.mock("mongoose", async importOriginal => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return { ...actual, default: { ...actual.default, startSession: mocks.startSession } };
});
vi.mock("../models/workout/workout.model.js", () => ({
  ExerciseLibrary: { findOneAndUpdate: mocks.exerciseUpdate },
  WorkoutLog: {},
  WorkoutPlan: { findOne: mocks.findOne, updateOne: mocks.planUpdate },
  WorkoutProgram: {},
  WORKOUT_WEEKDAYS: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  WORKOUT_WEEKDAY_LABELS: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" },
}));

import { savePlanExercise } from "../services/workout/workout.service.js";

const ownerId = "507f1f77bcf86cd799439011";
const exercise = { id: "row", name: "Dumbbell Row", muscle: "Back", sets: 2, reps: 8, rest: 60, tempo: "3-1-2", cues: [], description: "", setList: [{ id: "set-1", reps: 8, weight: 20 }, { id: "set-2", reps: 8, weight: 20 }], steps: [], videoUrl: "" };
let session: { withTransaction: ReturnType<typeof vi.fn>; endSession: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  session = {
    withTransaction: vi.fn(async (operation: () => Promise<void>) => operation()),
    endSession: vi.fn().mockResolvedValue(undefined),
  };
  mocks.startSession.mockResolvedValue(session);
  mocks.findOne.mockImplementation(() => ({
    session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ dayType: "day-pull", exercises: [] }) }),
  }));
  mocks.planUpdate.mockResolvedValue({ acknowledged: true });
  mocks.exerciseUpdate.mockResolvedValue({ acknowledged: true });
});

describe("focused workout exercise saves", () => {
  it("updates only one day's reference and shared exercise definition in a transaction", async () => {
    await expect(savePlanExercise(ownerId, "day-pull", exercise)).resolves.toEqual(exercise);

    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.exerciseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: "row" }),
      expect.objectContaining({ $set: expect.objectContaining({ name: "Dumbbell Row", muscle: "Back" }) }),
      expect.objectContaining({ upsert: true, runValidators: true, session }),
    );
    expect(mocks.planUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ dayType: "day-pull" }),
      { $push: { exercises: expect.objectContaining({ exerciseId: "row", sets: 2, reps: 8 }) } },
      expect.objectContaining({ runValidators: true, session }),
    );
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("replaces the matching reference instead of pushing a duplicate", async () => {
    mocks.findOne.mockImplementation(() => ({
      session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ dayType: "day-pull", exercises: [{ exerciseId: "row" }] }) }),
    }));

    await savePlanExercise(ownerId, "day-pull", exercise);

    expect(mocks.planUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ "exercises.exerciseId": "row" }),
      { $set: { "exercises.$": expect.objectContaining({ exerciseId: "row", sets: 2, reps: 8 }) } },
      expect.objectContaining({ runValidators: true, session }),
    );
    expect(mocks.planUpdate.mock.calls[0][1]).not.toHaveProperty("$push");
  });
});
