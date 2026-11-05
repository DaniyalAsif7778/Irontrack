import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { discardOfflineAction, enqueueOfflineAction, flushOfflineQueue, getOfflineQueue } from "./offlineQueue";

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
  afterEach(() => { vi.useRealTimers(); Reflect.deleteProperty(navigator, "locks"); });
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
  it("uses the browser lock to prevent two tabs flushing the same account queue", async () => {
    let lockHeld = false;
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_name, _options, callback) => {
      if (lockHeld) return callback(null);
      lockHeld = true;
      try { return await callback({}); } finally { lockHeld = false; }
    }) } });
    await enqueueOfflineAction({ id: "action-0001", accountId: "account-a", kind: "workout_log", path: "/workout-logs", body: { actionId: "action-0001" } });
    let finishRequest!: (value: unknown) => void;
    vi.mocked(api).mockImplementation(() => new Promise(resolve => { finishRequest = resolve; }) as never);

    const first = flushOfflineQueue("account-a");
    await vi.waitFor(() => expect(api).toHaveBeenCalledOnce());
    vi.resetModules(); // A second module instance models the independent queue state in another tab.
    const secondTabQueue = await import("./offlineQueue");
    await secondTabQueue.flushOfflineQueue("account-a");
    expect(api).toHaveBeenCalledOnce();
    finishRequest({});
    await first;
  });
  it("marks old pending actions for review and lets the user discard them", async () => {
    await enqueueOfflineAction({ id: "action-old", accountId: "account-a", kind: "routine_completion", path: "/routine/tasks/a/completion/2026-01-01", body: { completed: true } });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open("irontrack-offline", 1);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("actions", "readwrite");
      const store = transaction.objectStore("actions");
      const request = store.get("account-a:action-old");
      request.onsuccess = () => store.put({ ...request.result, createdAt: "2026-01-01T00:00:00.000Z" });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    });
    await flushOfflineQueue("account-a");
    expect((await getOfflineQueue("account-a"))[0]).toMatchObject({ state: "needs_attention", error: expect.stringContaining("over 30 days old") });
    expect(api).not.toHaveBeenCalled();
    await discardOfflineAction("account-a", "action-old");
    expect(await getOfflineQueue("account-a")).toEqual([]);
  });
  it("migrates existing localStorage queues when IndexedDB is unavailable", async () => {
    localStorage.setItem("irontrack_sync_queue_v1_account-a", JSON.stringify([{ id: "legacy-1", accountId: "account-a", kind: "workout_log", path: "/workout-logs", body: {}, createdAt: "2026-11-01T00:00:00.000Z", state: "pending" }]));
    expect(await getOfflineQueue("account-a")).toHaveLength(1);
    expect(localStorage.getItem("irontrack_sync_queue_v1_account-a")).toBeNull();
    expect(await getOfflineQueue("account-a")).toHaveLength(1);
  });
});
