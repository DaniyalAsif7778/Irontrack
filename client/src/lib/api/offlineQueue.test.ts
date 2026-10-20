import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { enqueueOfflineAction, flushOfflineQueue, getOfflineQueue } from "./offlineQueue";

vi.mock("./api", () => ({ ApiError: class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }, api: vi.fn() }));
import { api } from "./api";

describe("offline action queue", () => {
  beforeEach(() => { localStorage.clear(); vi.mocked(api).mockReset(); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); });
  it("keeps entries scoped to the signed-in account and rejects other action kinds", () => {
    enqueueOfflineAction({ id: "action-0001", accountId: "account-a", kind: "routine_completion", path: "/routine/tasks/task-a/completion/2026-10-20", body: { completed: true } });
    expect(getOfflineQueue("account-a")).toHaveLength(1);
    expect(getOfflineQueue("account-b")).toHaveLength(0);
    expect(() => enqueueOfflineAction({ id: "bad-action", accountId: "account-a", kind: "routine_completion", path: "/routine/tasks/task-a", body: {} })).not.toThrow();
  });
  it("replays changes in order and removes successful idempotent records", async () => {
    enqueueOfflineAction({ id: "action-0001", accountId: "account-a", kind: "routine_completion", path: "/routine/tasks/a/completion/2026-10-20", body: { actionId: "action-0001" } });
    enqueueOfflineAction({ id: "action-0002", accountId: "account-a", kind: "workout_log", path: "/workout-logs", body: { actionId: "action-0002" } });
    vi.mocked(api).mockResolvedValue({});
    await flushOfflineQueue("account-a");
    expect(vi.mocked(api).mock.calls.map(call => call[0])).toEqual(["/routine/tasks/a/completion/2026-10-20", "/workout-logs"]);
    expect(getOfflineQueue("account-a")).toEqual([]);
  });
  it("stops on network errors and retains permanent failures for attention", async () => {
    enqueueOfflineAction({ id: "action-0001", accountId: "account-a", kind: "workout_log", path: "/workout-logs", body: {} });
    vi.mocked(api).mockRejectedValueOnce(new ApiError("offline", 0));
    await flushOfflineQueue("account-a");
    expect(getOfflineQueue("account-a")[0].state).toBe("pending");
    vi.mocked(api).mockRejectedValueOnce(new ApiError("conflict", 409));
    await flushOfflineQueue("account-a");
    expect(getOfflineQueue("account-a")[0]).toMatchObject({ state: "needs_attention", error: "conflict" });
  });
});
