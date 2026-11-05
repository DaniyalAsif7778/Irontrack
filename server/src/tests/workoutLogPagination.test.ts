import { beforeEach, describe, expect, it, vi } from "vitest";

const workoutLogModel = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("../models/workout/workout.model.js", () => ({
  WorkoutLog: workoutLogModel,
  ExerciseLibrary: {},
  WorkoutPlan: {},
  WorkoutProgram: {},
  WORKOUT_WEEKDAYS: [],
  WORKOUT_WEEKDAY_LABELS: {},
}));

import { listLogs } from "../services/workout/workout.service.js";

function queryWith(rows: unknown[]) {
  const query = {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(rows),
  };
  workoutLogModel.find.mockReturnValue(query);
  return query;
}

describe("cursor-based workout history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a next cursor when a following page exists and uses a stable compound order", async () => {
    const first = { _id: "507f1f77bcf86cd799439011", date: "2026-11-02", completedAt: new Date("2026-11-02T12:00:00Z") };
    const extra = { _id: "507f1f77bcf86cd799439012", date: "2026-11-01", completedAt: new Date("2026-11-01T12:00:00Z") };
    const query = queryWith([first, extra]);

    const result = await listLogs("owner-1", 1);

    expect(workoutLogModel.find).toHaveBeenCalledWith({ ownerId: "owner-1" });
    expect(query.sort).toHaveBeenCalledWith({ date: -1, completedAt: -1, _id: -1 });
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(result).toMatchObject({ items: [first], hasMore: true });
    expect(JSON.parse(Buffer.from(result.nextCursor!, "base64url").toString("utf8"))).toEqual({
      date: first.date,
      completedAt: first.completedAt.toISOString(),
      id: first._id,
    });
  });

  it("uses the cursor tuple to request the next owner-scoped page", async () => {
    queryWith([]);
    const cursor = { date: "2026-11-02", completedAt: "2026-11-02T12:00:00.000Z", id: "507f1f77bcf86cd799439011" };

    const result = await listLogs("owner-1", 20, cursor);

    expect(workoutLogModel.find).toHaveBeenCalledWith({
      ownerId: "owner-1",
      $or: [
        { date: { $lt: cursor.date } },
        { date: cursor.date, completedAt: { $lt: new Date(cursor.completedAt) } },
        { date: cursor.date, completedAt: new Date(cursor.completedAt), _id: { $lt: expect.anything() } },
      ],
    });
    expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
  });
});
