import { ArrowRight, CalendarDays, CheckCircle2, Scale } from "lucide-react";
import type { Day, Weight } from "../../types";
import { MetricCard } from "../../components/components";

export default function HomePage({ day, latest, onRoutine }: { day: Day | null; latest: Weight | undefined; onRoutine: () => void }) {
  return <>
    <header><div><p>Welcome back</p><h1>Today, with intention.</h1></div></header>
    <section className="hero"><small>TODAY’S ROUTINE</small><h2>{day?.progress.completed ?? 0} of {day?.progress.total ?? 0} tasks complete</h2><p>Move calmly from one prayer anchor to the next.</p><button className="primary" onClick={onRoutine}>Open routine <ArrowRight /></button></section>
    <div className="dashboard">
      <MetricCard icon={<CheckCircle2 />} value={day?.progress.completed ?? 0} label="Done today" />
      <MetricCard icon={<Scale />} value={latest ? `${latest.weight} ${latest.unit}` : "—"} label="Latest weight" />
      <MetricCard icon={<CalendarDays />} value={day?.progress.total ?? 0} label="Routine tasks" />
    </div>
  </>;
}
