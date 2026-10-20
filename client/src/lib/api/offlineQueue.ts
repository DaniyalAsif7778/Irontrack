import { ApiError, api } from "./api";

export type OfflineAction = {
  id: string;
  accountId: string;
  kind: "routine_completion" | "workout_log";
  path: string;
  body: Record<string, unknown>;
  createdAt: string;
  state: "pending" | "needs_attention";
  error?: string;
};

const queueKey = (accountId: string) => `irontrack_sync_queue_v1_${accountId}`;
const safeKinds = new Set<OfflineAction["kind"]>(["routine_completion", "workout_log"]);

function read(accountId: string): OfflineAction[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(queueKey(accountId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is OfflineAction => item?.accountId === accountId && safeKinds.has(item.kind) && typeof item.id === "string") : [];
  } catch { return []; }
}

function announce(accountId: string) {
  window.dispatchEvent(new CustomEvent("irontrack:sync-queue", { detail: { accountId, count: read(accountId).filter(item => item.state === "pending").length } }));
}

export function enqueueOfflineAction(input: Omit<OfflineAction, "createdAt" | "state">) {
  if (!input.accountId || !safeKinds.has(input.kind)) throw new Error("This change cannot be saved for offline sync.");
  const queue = read(input.accountId);
  if (!queue.some(item => item.id === input.id)) queue.push({ ...input, createdAt: new Date().toISOString(), state: "pending" });
  localStorage.setItem(queueKey(input.accountId), JSON.stringify(queue));
  announce(input.accountId);
}

export function getOfflineQueue(accountId: string) { return read(accountId); }

export function retryOfflineAction(accountId: string, id: string) {
  const queue = read(accountId);
  const item = queue.find(candidate => candidate.id === id);
  if (!item) return;
  item.state = "pending";
  delete item.error;
  localStorage.setItem(queueKey(accountId), JSON.stringify(queue));
  announce(accountId);
}

export async function flushOfflineQueue(accountId: string) {
  if (!accountId || !navigator.onLine) return;
  const queue = read(accountId);
  let changed = false;
  for (const item of [...queue]) {
    if (item.state !== "pending") continue;
    try {
      await api(item.path, { method: item.kind === "routine_completion" ? "PUT" : "POST", body: JSON.stringify(item.body) });
      queue.splice(queue.findIndex(candidate => candidate.id === item.id), 1);
      changed = true;
      window.dispatchEvent(new CustomEvent("irontrack:sync-complete", { detail: { accountId, kind: item.kind } }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) break;
      item.state = "needs_attention";
      item.error = error instanceof Error ? error.message : "Could not sync this change.";
      changed = true;
    }
  }
  if (changed) localStorage.setItem(queueKey(accountId), JSON.stringify(queue));
  announce(accountId);
}
