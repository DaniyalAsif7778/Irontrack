import { beforeEach, describe, expect, it, vi } from "vitest";

const workout = vi.hoisted(() => ({
  listPlans: vi.fn(),
  listExerciseLibrary: vi.fn(),
  saveWorkoutProgram: vi.fn(),
  listWeek: vi.fn(),
  saveWeek: vi.fn(),
}));

vi.mock("../services/workout/workout.service.js", () => workout);

import { saveProgram, putWeek } from "../controllers/workout/workout.controller.js";

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
});
