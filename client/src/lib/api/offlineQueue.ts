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

type StoredAction = OfflineAction & { key: string };
const legacyKey = (accountId: string) => `irontrack_sync_queue_v1_${accountId}`;
const actionKey = (action: Pick<OfflineAction, "accountId" | "id">) => `${action.accountId}:${action.id}`;
const safeKinds = new Set<OfflineAction["kind"]>(["routine_completion", "workout_log"]);
let databasePromise: Promise<IDBDatabase | null> | undefined;
const activeFlushes = new Map<string, Promise<void>>();

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  databasePromise = new Promise(resolve => {
    try {
      const opening = indexedDB.open("irontrack-offline", 1);
      opening.onupgradeneeded = () => {
        if (!opening.result.objectStoreNames.contains("actions")) opening.result.createObjectStore("actions", { keyPath: "key" });
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => resolve(null);
      opening.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return databasePromise;
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read offline storage."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save offline storage."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline storage transaction was cancelled."));
  });
}

function parseQueue(value: string | null, accountId: string): OfflineAction[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is OfflineAction => Boolean(item && typeof item === "object" && item.accountId === accountId && safeKinds.has(item.kind) && typeof item.id === "string")) : [];
  } catch { return []; }
}

async function migrateLegacyQueue(db: IDBDatabase, accountId: string) {
  let value: string | null;
  try { value = localStorage.getItem(legacyKey(accountId)); } catch { return; }
  if (value === null) return;
  const legacy = parseQueue(value, accountId);
  if (!legacy.length) {
    try { localStorage.removeItem(legacyKey(accountId)); } catch { /* Ignore blocked browser storage. */ }
    return;
  }
  const transaction = db.transaction("actions", "readwrite");
  const finished = transactionDone(transaction);
  const store = transaction.objectStore("actions");
  for (const item of legacy) store.put({ ...item, key: actionKey(item) } satisfies StoredAction);
  await finished;
  try { localStorage.removeItem(legacyKey(accountId)); } catch { /* The IndexedDB copy is already durable. */ }
}

async function readQueue(accountId: string): Promise<OfflineAction[]> {
  const db = await openDatabase();
  if (db) {
    try {
      await migrateLegacyQueue(db, accountId);
      const transaction = db.transaction("actions", "readonly");
      const finished = transactionDone(transaction);
      const stored = await requestValue(transaction.objectStore("actions").getAll() as IDBRequest<StoredAction[]>);
      await finished;
      return stored.filter(item => item.accountId === accountId).map(({ key: _key, ...action }) => action);
    } catch { /* Keep a localStorage fallback for browser storage failures. */ }
  }
  try { return parseQueue(localStorage.getItem(legacyKey(accountId)), accountId); }
  catch { return []; }
}

async function writeQueue(accountId: string, queue: OfflineAction[]) {
  const db = await openDatabase();
  if (db) {
    const transaction = db.transaction("actions", "readwrite");
    const finished = transactionDone(transaction);
    const store = transaction.objectStore("actions");
    const request = store.getAll() as IDBRequest<StoredAction[]>;
    request.onsuccess = () => {
      for (const item of request.result) if (item.accountId === accountId) store.delete(item.key);
      for (const item of queue) store.put({ ...item, key: actionKey(item) } satisfies StoredAction);
    };
    await finished;
    try { localStorage.removeItem(legacyKey(accountId)); } catch { /* The IndexedDB copy is already durable. */ }
    return;
  }
  localStorage.setItem(legacyKey(accountId), JSON.stringify(queue));
}

async function announce(accountId: string) {
  const queue = await readQueue(accountId);
  window.dispatchEvent(new CustomEvent("irontrack:sync-queue", { detail: { accountId, count: queue.filter(item => item.state === "pending").length } }));
}

export async function enqueueOfflineAction(input: Omit<OfflineAction, "createdAt" | "state">) {
  if (!input.accountId || !safeKinds.has(input.kind)) throw new Error("This change cannot be saved for offline sync.");
  const queue = await readQueue(input.accountId);
  if (!queue.some(item => item.id === input.id)) queue.push({ ...input, createdAt: new Date().toISOString(), state: "pending" });
  await writeQueue(input.accountId, queue);
  await announce(input.accountId);
}

export function getOfflineQueue(accountId: string) { return readQueue(accountId); }

export async function clearOfflineQueue(accountId: string) {
  if (!accountId) return;
  await writeQueue(accountId, []);
  try { localStorage.removeItem(legacyKey(accountId)); } catch { /* Ignore blocked browser storage. */ }
  await announce(accountId);
}

export async function retryOfflineAction(accountId: string, id: string) {
  const queue = await readQueue(accountId);
  const item = queue.find(candidate => candidate.id === id);
  if (!item) return;
  item.state = "pending";
  delete item.error;
  await writeQueue(accountId, queue);
  await announce(accountId);
}

export function flushOfflineQueue(accountId: string): Promise<void> {
  if (!accountId || !navigator.onLine) return Promise.resolve();
  const active = activeFlushes.get(accountId);
  if (active) return active;
  const flush = flushQueue(accountId).finally(() => activeFlushes.delete(accountId));
  activeFlushes.set(accountId, flush);
  return flush;
}

async function flushQueue(accountId: string) {
  const queue = await readQueue(accountId);
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
  if (changed) await writeQueue(accountId, queue);
  await announce(accountId);
}
