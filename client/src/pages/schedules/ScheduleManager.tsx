import { useEffect } from "react";
import { Copy } from "lucide-react";
import { useCopySchedule, useRoutineSchedule } from "../../hooks/hooks";
import type { Schedule } from "../../types";

export default function ScheduleManager({ onError }: { onError: (value: string) => void }) {
  const weekdayQuery = useRoutineSchedule("weekday");
  const weekendQuery = useRoutineSchedule("weekend");
  const copyMutation = useCopySchedule();
  const weekday = weekdayQuery.data ?? null;
  const weekend = weekendQuery.data ?? null;
  const copying = copyMutation.isPending ? copyMutation.variables?.source ?? null : null;

  useEffect(() => {
    const error = weekdayQuery.error ?? weekendQuery.error;
    if (error) onError(error.message);
  }, [weekdayQuery.error, weekendQuery.error, onError]);

  async function copy(source: "weekday" | "weekend") {
    const target = source === "weekday" ? "weekend" : "weekday";
    if (!confirm(`Replace the ${target} schedule with a copy of the ${source} schedule? Existing ${target} tasks and their completion history will be removed.`)) return;
    try {
      await copyMutation.mutateAsync({ source, target });
    } catch (reason) { onError((reason as Error).message); }
  }

  return <><header><div><h1>Schedules</h1><p>Keep your routine templates intentional and separate.</p></div></header><div className="schedule-grid">
    <ScheduleCard schedule={weekday} target="weekend" busy={copying === "weekday"} onCopy={() => void copy("weekday")} />
    <ScheduleCard schedule={weekend} target="weekday" busy={copying === "weekend"} onCopy={() => void copy("weekend")} />
  </div></>;
}

function ScheduleCard({ schedule, target, busy, onCopy }: { schedule: Schedule | null; target: string; busy: boolean; onCopy: () => void }) {
  const count = schedule?.blocks.reduce((sum, block) => sum + block.tasks.length, 0) ?? 0;
  return <section className="schedule-card"><div><small>{schedule?.dayType?.toUpperCase() ?? "LOADING"}</small><h2>{count} routine tasks</h2></div>
    <div className="schedule-blocks">{schedule?.blocks.map(block => <div key={block.id}><span>{block.label}</span><b>{block.tasks.length}</b></div>)}</div>
    <button className="copy-button" onClick={onCopy} disabled={busy || !count}><Copy />{busy ? "Copying…" : `Copy to ${target}`}</button>
  </section>;
}
