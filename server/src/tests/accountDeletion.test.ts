import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const deletable = () => ({ deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }) });
  const models = {
    User: { findById: vi.fn(), deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }) },
    AuthChallenge: deletable(),
    AuthSession: deletable(),
    RoutineCompletion: deletable(),
    RoutineEvent: deletable(),
    RoutineReminder: deletable(),
    RoutineTask: { ...deletable(), find: vi.fn() },
    RoutineTaskOccurrence: deletable(),
    ExerciseLibrary: deletable(),
    WorkoutLog: deletable(),
    WorkoutPlan: deletable(),
    WorkoutProgram: deletable(),
    WorkoutProgression: deletable(),
    WellnessLog: deletable(),
    WeightLog: deletable(),
    PushDelivery: deletable(),
    PushSubscription: deletable(),
  };
  const transaction = {
    withTransaction: vi.fn(),
    endSession: vi.fn().mockResolvedValue(undefined),
  };
  return {
    models,
    transaction,
    startSession: vi.fn().mockResolvedValue(transaction),
    comparePassword: vi.fn(),
    accountQuery: {
      select: vi.fn().mockReturnThis(),
      session: vi.fn(),
    },
    taskQuery: {
      select: vi.fn().mockReturnThis(),
      session: vi.fn(),
    },
  };
});

vi.mock("bcrypt", () => ({ default: { compare: mocks.comparePassword, hash: vi.fn() } }));
vi.mock("mongoose", () => ({ default: { startSession: mocks.startSession } }));
vi.mock("../models/auth/user.model.js", () => ({ User: mocks.models.User, toPublicUser: vi.fn() }));
vi.mock("../models/auth/authChallenge.model.js", () => ({ AuthChallenge: mocks.models.AuthChallenge }));
vi.mock("../models/auth/session.model.js", () => ({ AuthSession: mocks.models.AuthSession }));
vi.mock("../models/routine/routine.model.js", () => ({
  RoutineCompletion: mocks.models.RoutineCompletion,
  RoutineEvent: mocks.models.RoutineEvent,
  RoutineReminder: mocks.models.RoutineReminder,
  RoutineTask: mocks.models.RoutineTask,
  RoutineTaskOccurrence: mocks.models.RoutineTaskOccurrence,
}));
vi.mock("../models/workout/workout.model.js", () => ({
  ExerciseLibrary: mocks.models.ExerciseLibrary,
  WorkoutLog: mocks.models.WorkoutLog,
  WorkoutPlan: mocks.models.WorkoutPlan,
  WorkoutProgram: mocks.models.WorkoutProgram,
  WorkoutProgression: mocks.models.WorkoutProgression,
}));
vi.mock("../models/wellness/wellness.model.js", () => ({ WellnessLog: mocks.models.WellnessLog }));
vi.mock("../models/weight/weight.model.js", () => ({ WeightLog: mocks.models.WeightLog }));
vi.mock("../models/notifications/notification.model.js", () => ({
  PushDelivery: mocks.models.PushDelivery,
  PushSubscription: mocks.models.PushSubscription,
}));
vi.mock("../services/auth/email.service.js", () => ({ deliverAuthEmail: vi.fn() }));

import { deleteAccount } from "../services/auth/auth.service.js";

const userId = "507f1f77bcf86cd799439011";
const taskIds = [{ _id: "task-1" }, { _id: "task-2" }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.withTransaction.mockImplementation(async callback => callback());
  mocks.transaction.endSession.mockResolvedValue(undefined);
  mocks.accountQuery.session.mockResolvedValue({ _id: userId, passwordHash: "hashed-password" });
  mocks.taskQuery.session.mockResolvedValue(taskIds);
  mocks.models.User.findById.mockReturnValue(mocks.accountQuery);
  mocks.models.RoutineTask.find.mockReturnValue(mocks.taskQuery);
  mocks.models.User.deleteOne.mockResolvedValue({ deletedCount: 1 });
  mocks.comparePassword.mockResolvedValue(true);
});

describe("deleteAccount", () => {
  it("deletes all account-owned records and task-linked completions in one transaction", async () => {
    expect(await deleteAccount(userId, "correct-password")).toBe("deleted");

    expect(mocks.startSession).toHaveBeenCalledOnce();
    expect(mocks.accountQuery.select).toHaveBeenCalledWith("+passwordHash");
    expect(mocks.accountQuery.session).toHaveBeenCalledWith(mocks.transaction);
    expect(mocks.models.RoutineTask.find).toHaveBeenCalledWith({ ownerId: userId });
    expect(mocks.models.RoutineCompletion.deleteMany).toHaveBeenCalledWith(
      { taskId: { $in: ["task-1", "task-2"] } },
      { session: mocks.transaction },
    );
    for (const model of [
      mocks.models.RoutineTaskOccurrence,
      mocks.models.RoutineReminder,
      mocks.models.RoutineEvent,
      mocks.models.RoutineTask,
      mocks.models.WorkoutLog,
      mocks.models.WorkoutProgression,
      mocks.models.WorkoutProgram,
      mocks.models.WorkoutPlan,
      mocks.models.ExerciseLibrary,
      mocks.models.WellnessLog,
      mocks.models.WeightLog,
      mocks.models.PushDelivery,
      mocks.models.PushSubscription,
      mocks.models.AuthSession,
    ]) {
      expect(model.deleteMany).toHaveBeenCalledWith({ ownerId: userId }, { session: mocks.transaction });
    }
    expect(mocks.models.AuthChallenge.deleteMany).toHaveBeenCalledWith({ userId }, { session: mocks.transaction });
    expect(mocks.models.User.deleteOne).toHaveBeenCalledWith({ _id: userId }, { session: mocks.transaction });
    expect(mocks.transaction.endSession).toHaveBeenCalledOnce();
  });

  it("does not delete data when the password is wrong", async () => {
    mocks.comparePassword.mockResolvedValue(false);

    expect(await deleteAccount(userId, "wrong-password")).toBe("invalid_password");
    expect(mocks.models.RoutineTask.find).not.toHaveBeenCalled();
    expect(mocks.models.User.deleteOne).not.toHaveBeenCalled();
    expect(mocks.transaction.endSession).toHaveBeenCalledOnce();
  });

  it("does not remove the account when a cascade step fails", async () => {
    mocks.models.WorkoutLog.deleteMany.mockRejectedValue(new Error("database failure"));

    await expect(deleteAccount(userId, "correct-password")).rejects.toThrow("database failure");
    expect(mocks.models.User.deleteOne).not.toHaveBeenCalled();
    expect(mocks.transaction.endSession).toHaveBeenCalledOnce();
  });
});
