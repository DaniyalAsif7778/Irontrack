import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { flushOfflineQueue, getOfflineQueue, retryOfflineAction } from "../lib/api/offlineQueue";
import { useQueryClient } from "@tanstack/react-query";

export default function OfflineSyncStatus({ accountId }: { accountId?: string }) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [blockedActions, setBlockedActions] = useState<ReturnType<typeof getOfflineQueue>>([]);
  useEffect(() => {
    if (!accountId) { setPending(0); setBlocked(0); return; }
    const syncCount = () => {
      const queue = getOfflineQueue(accountId);
      setPending(queue.filter(item => item.state === "pending").length);
      setBlocked(queue.filter(item => item.state === "needs_attention").length);
      setBlockedActions(queue.filter(item => item.state === "needs_attention"));
    };
    const handleOnline = () => { setOnline(true); void flushOfflineQueue(accountId); };
    const handleOffline = () => setOnline(false);
    const handleQueue = (event: Event) => { if ((event as CustomEvent).detail?.accountId === accountId) syncCount(); };
    const handleSynced = (event: Event) => {
      if ((event as CustomEvent).detail?.accountId !== accountId) return;
      syncCount();
      void queryClient.invalidateQueries();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("irontrack:sync-queue", handleQueue);
    window.addEventListener("irontrack:sync-complete", handleSynced);
    syncCount();
    if (navigator.onLine) void flushOfflineQueue(accountId);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("irontrack:sync-queue", handleQueue);
      window.removeEventListener("irontrack:sync-complete", handleSynced);
    };
  }, [accountId, queryClient]);
  if (!accountId || (online && !pending && !blocked)) return null;
  return <aside className={`offline-sync-status ${online ? "is-online" : "is-offline"}`} aria-label="Offline sync status">
    <div className="offline-sync-heading" role="status" aria-live="polite">{online ? <Cloud size={16} /> : <CloudOff size={16} />}<span>{!online ? "Offline" : blocked ? `${blocked} change${blocked === 1 ? "" : "s"} need attention` : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`}</span>
      {online && pending > 0 && <button type="button" aria-label="Sync queued changes" onClick={() => void flushOfflineQueue(accountId)}><RefreshCw size={14} /> Sync</button>}</div>
    {online && blockedActions.length > 0 && <ul>{blockedActions.map(item => <li key={item.id}><span>{item.kind === "workout_log" ? "Workout save" : "Routine completion"}: {item.error}</span><button type="button" onClick={() => { retryOfflineAction(accountId, item.id); void flushOfflineQueue(accountId); }}>Retry</button></li>)}</ul>}
  </aside>;
}
