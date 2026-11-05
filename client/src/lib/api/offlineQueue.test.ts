import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { enqueueOfflineAction, flushOfflineQueue, getOfflineQueue } from "./offlineQueue";

vi.mock("./api", () => ({ ApiError: class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }, api: vi.fn() }));
import { api } from "./api";

function resetDatabase() {
  return new Promise<void>((resolve, reject) => {
    const opening = indexedDB.open("irontrack-offline", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("actions", { keyPath: "key" });
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const database = opening.result;
      const transaction = database.transaction("actions", "readwrite");
      transaction.objectStore("actions").clear();
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  });
}

describe("offline action queue", () => {
  beforeEach(async () => { localStorage.clear(); await resetDatabase(); vi.mocked(api).mockReset(); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); });
  it("keeps entries scoped to the signed-in account and rejects other action kinds", async () => {
    await enqueueOfflineAction({ id: "action-0001", accountId: "account-a", kind: "routine_completion", path: "/routine/tasks/task-a/completion/2026-10-20", body: { completed: true } });
    expect(await getOfflineQueue("account-a")).toHaveLength(1);
    expect(await getOfflineQueue("account-b")).toHaveLength(0);
    await expect(enqueueOfflineAction({ id: "bad-action", accountId: "account-a", kind: "routine_completion", path: "/routine/tasks/task-a", body: {} })).resolves.toBeUndefined();
  });
  it("replays changes in order and removes successful idempotent records", async () => {
    await enqueueOfflineAction({ id: "action-0001", accountId: "account-a", kind: "routine_completion", path: "/routine/tasks/a/completion/2026-10-20", body: { actionId: "action-0001" } });
    await enqueueOfflineAction({ id: "action-0002", accountId: "account-a", kind: "workout_log", path: "/workout-logs", body: { actionId: "action-0002" } });
    vi.mocked(api).mockResolvedValue({});
    await flushOfflineQueue("account-a");
    expect(vi.mocked(api).mock.calls.map(call => call[0])).toEqual(["/routine/tasks/a/completion/2026-10-20", "/workout-logs"]);
    expect(await getOfflineQueue("account-a")).toEqual([]);
  });
  it("stops on network errors and retains permanent failures for attention", async () => {
    await enqueueOfflineAction({ id: "action-0001", accountId: "account-a", kind: "workout_log", path: "/workout-logs", body: {} });
    vi.mocked(api).mockRejectedValueOnce(new ApiError("offline", 0));
    await flushOfflineQueue("account-a");
    expect((await getOfflineQueue("account-a"))[0].state).toBe("pending");
    vi.mocked(api).mockRejectedValueOnce(new ApiError("conflict", 409));
    await flushOfflineQueue("account-a");
    expect((await getOfflineQueue("account-a"))[0]).toMatchObject({ state: "needs_attention", error: "conflict" });
  });
  it("migrates existing localStorage queues when IndexedDB is unavailable", async () => {
    localStorage.setItem("irontrack_sync_queue_v1_account-a", JSON.stringify([{ id: "legacy-1", accountId: "account-a", kind: "workout_log", path: "/workout-logs", body: {}, createdAt: "2026-11-01T00:00:00.000Z", state: "pending" }]));
    expect(await getOfflineQueue("account-a")).toHaveLength(1);
    expect(localStorage.getItem("irontrack_sync_queue_v1_account-a")).toBeNull();
    expect(await getOfflineQueue("account-a")).toHaveLength(1);
  });
});
