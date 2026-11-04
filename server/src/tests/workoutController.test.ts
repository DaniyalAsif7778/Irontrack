import { beforeEach, describe, expect, it, vi } from "vitest";

const workout = vi.hoisted(() => ({
  listPlans: vi.fn(),
  listExerciseLibrary: vi.fn(),
  saveWorkoutProgram: vi.fn(),
  savePlanExercise: vi.fn(),
  listWeek: vi.fn(),
  saveWeek: vi.fn(),
}));

vi.mock("../services/workout/workout.service.js", () => workout);

import { savePlanExercise, saveProgram, putWeek } from "../controllers/workout/workout.controller.js";

const request = (body: unknown) => ({ auth: { userId: "owner-1" }, body }) as never;
const response = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  workout.listExerciseLibrary.mockResolvedValue([]);
});

describe("workout controller error handling", () => {
  it("lets workout program database errors reach the API error handler", async () => {
    const error = new Error("database unavailable");
    workout.listPlans.mockRejectedValue(error);
    const res = response();

    await expect(saveProgram(request({}), res as never, vi.fn())).rejects.toBe(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("lets weekly schedule database errors reach the API error handler", async () => {
    const error = new Error("database unavailable");
    workout.listPlans.mockRejectedValue(error);
    const res = response();

    await expect(putWeek(request({}), res as never, vi.fn())).rejects.toBe(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns client errors for invalid workout program input", async () => {
    workout.listPlans.mockResolvedValue([]);
    const res = response();

    await expect(saveProgram(request({ plans: [], days: [], exerciseLibrary: [] }), res as never, vi.fn())).resolves.toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(workout.saveWorkoutProgram).not.toHaveBeenCalled();
  });

  it("validates and writes only the selected exercise from its card", async () => {
    const exercise = { id: "row", name: "Dumbbell Row", muscle: "Back", sets: 2, reps: 8, rest: 60, tempo: "3-1-2", cues: [], description: "", setList: [{ id: "set-1", reps: 8, weight: 20 }], steps: [], videoUrl: "" };
    workout.savePlanExercise.mockResolvedValue(exercise);
    const res = response();

    await savePlanExercise({ auth: { userId: "owner-1" }, params: { dayType: "day-pull", exerciseId: "row" }, body: exercise } as never, res as never, vi.fn());

    expect(workout.savePlanExercise).toHaveBeenCalledWith("owner-1", "day-pull", expect.objectContaining({ id: "row", sets: 2, name: "Dumbbell Row" }), undefined, undefined);
    expect(res.json).toHaveBeenCalledWith(exercise);
  });

  it("rejects exercise fields that cannot be saved", async () => {
    const res = response();
    await savePlanExercise({ auth: { userId: "owner-1" }, params: { dayType: "day-pull", exerciseId: "row" }, body: { name: "", muscle: "Back" } } as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(workout.savePlanExercise).not.toHaveBeenCalled();
  });
});
