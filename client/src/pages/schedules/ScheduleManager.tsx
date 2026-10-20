import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, MoveRight } from "lucide-react";
import { useCopySchedule, useRoutineSchedule } from "../../hooks/hooks";
import type { PrayerTimes, Schedule } from "../../types";
import { flattenSchedule, previewScheduleDelay } from "../../utils/schedulePreview";

const prayerLabels: Record<string, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

export default function ScheduleManager({ onError, prayerTimes }: { onError: (value: string) => void; prayerTimes?: PrayerTimes }) {
  const weekdayQuery = useRoutineSchedule("weekday");
  const weekendQuery = useRoutineSchedule("weekend");
  const copyMutation = useCopySchedule();
  const weekday = weekdayQuery.data ?? null;
  const weekend = weekendQuery.data ?? null;
  const [previewDayType, setPreviewDayType] = useState<"weekday" | "weekend">("weekday");
  const [sourceTaskId, setSourceTaskId] = useState("");
  const [delayMinutes, setDelayMinutes] = useState(15);
  const previewSchedule = previewDayType === "weekday" ? weekday : weekend;
  const previewTasks = useMemo(() => flattenSchedule(previewSchedule), [previewSchedule]);
  const timedTasks = previewTasks.filter(({ task }) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.startTime) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.endTime));
  const selectedSource = timedTasks.some(({ task }) => task._id === sourceTaskId) ? sourceTaskId : timedTasks[0]?.task._id ?? "";
  const preview = useMemo(() => previewScheduleDelay(previewSchedule, selectedSource, delayMinutes, prayerTimes ?? { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" }), [previewSchedule, selectedSource, delayMinutes, prayerTimes]);
  const copying = copyMutation.isPending ? copyMutation.variables?.source ?? null : null;

  useEffect(() => {
    const error = weekdayQuery.error ?? weekendQuery.error;
    if (error) onError(error.message);
  }, [weekdayQuery.error, weekendQuery.error, onError]);
  useEffect(() => { if (selectedSource !== sourceTaskId) setSourceTaskId(selectedSource); }, [selectedSource, sourceTaskId]);

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
  </div>
  <section className="schedule-preview" aria-labelledby="delay-preview-title">
    <div className="schedule-preview-heading"><div><h2 id="delay-preview-title">Delay preview</h2><p>See which scheduled tasks move before applying a delay.</p></div><MoveRight size={18} /></div>
    <div className="schedule-preview-controls">
      <label>Schedule<select aria-label="Preview schedule" value={previewDayType} onChange={event => setPreviewDayType(event.target.value as "weekday" | "weekend")}><option value="weekday">Weekday</option><option value="weekend">Weekend</option></select></label>
      <label>Task running late<select aria-label="Task running late" value={selectedSource} onChange={event => setSourceTaskId(event.target.value)} disabled={!timedTasks.length}>{timedTasks.map(({ task, block }) => <option key={task._id} value={task._id}>{task.title} · {prayerLabels[block] ?? block}</option>)}</select></label>
      <label>Added time (minutes)<input aria-label="Added time in minutes" type="number" min="5" max="180" step="5" value={delayMinutes} onChange={event => setDelayMinutes(Math.max(5, Math.min(180, Number(event.target.value) || 5)))} /></label>
    </div>
    {!timedTasks.length ? <p className="schedule-preview-empty">Add start and end times to a task in this schedule to preview its delay.</p> : !preview.length ? <p className="schedule-preview-empty">No later tasks have time blocks in this schedule.</p> : <ol className="schedule-preview-list">{preview.map(item => <li key={item.id}><span><b>{item.title}</b><small>{item.carriedToTomorrow ? "Moves to tomorrow’s Isha card" : item.fromBlock === item.toBlock ? `Stays in ${prayerLabels[item.toBlock] ?? item.toBlock}` : <>{prayerLabels[item.fromBlock] ?? item.fromBlock}<ArrowRight size={12} />{prayerLabels[item.toBlock] ?? item.toBlock}</>}</small></span><time>{item.startTime} – {item.endTime}</time></li>)}</ol>}
    <p className="schedule-preview-note">Preview only. Saved schedules change when you accept a delay during a task.</p>
  </section>
  </>;
}

function ScheduleCard({ schedule, target, busy, onCopy }: { schedule: Schedule | null; target: string; busy: boolean; onCopy: () => void }) {
  const count = schedule?.blocks.reduce((sum, block) => sum + block.tasks.length, 0) ?? 0;
  return <section className="schedule-card"><div><small>{schedule?.dayType?.toUpperCase() ?? "LOADING"}</small><h2>{count} routine tasks</h2></div>
    <div className="schedule-blocks">{schedule?.blocks.map(block => <div key={block.id}><span>{block.label}</span><b>{block.tasks.length}</b></div>)}</div>
    <button className="copy-button" onClick={onCopy} disabled={busy || !count}><Copy />{busy ? "Copying…" : `Copy to ${target}`}</button>
  </section>;
}
