import { Droplet, Footprints, Minus, Plus } from "lucide-react";
import { useWellness } from "../../hooks/hooks";
import { ironToday } from "../../utils/date";
import type { WellnessDay } from "../../types";
import { Link } from "react-router-dom";

export default function WellnessPage({ onError }: { onError: (message: string) => void }) {
  const date = ironToday();
  const wellness = useWellness(date);
  const today = wellness.data?.find(item => item.date === date) ?? { date, waterGlasses: 0, movementBreaks: 0 };
  const waterGoal = 8;
  const movementGoal = 6;

  async function change(field: "waterGlasses" | "movementBreaks", delta: number) {
    const value: WellnessDay = { ...today, [field]: Math.max(0, Math.min(100, today[field] + delta)) };
    try { await wellness.save.mutateAsync(value); }
    catch (error) { onError(error instanceof Error ? error.message : "Could not save today’s wellness log."); }
  }

  return <>
    <header><div><h1>Wellness</h1><p>Small check-ins for water and movement. <Link to="/settings">Configure reminders in Settings.</Link></p></div></header>
    <div className="wellness-grid">
      <section className="wellness-card"><div className="wellness-card-heading"><span className="wellness-icon water"><Droplet /></span><div><h2>Water</h2><p>Glasses today</p></div><strong>{today.waterGlasses}<small> / {waterGoal}</small></strong></div><div className="wellness-progress"><i style={{ width: `${Math.min(100, today.waterGlasses / waterGoal * 100)}%` }} /></div><div className="wellness-controls"><span>{today.waterGlasses >= waterGoal ? "Daily target reached" : `${waterGoal - today.waterGlasses} to your daily target`}</span><div><button type="button" aria-label="Remove one glass of water" disabled={!today.waterGlasses || wellness.save.isPending} onClick={() => void change("waterGlasses", -1)}><Minus /></button><button type="button" aria-label="Add one glass of water" disabled={wellness.save.isPending} onClick={() => void change("waterGlasses", 1)}><Plus /></button></div></div></section>
      <section className="wellness-card"><div className="wellness-card-heading"><span className="wellness-icon movement"><Footprints /></span><div><h2>Movement</h2><p>Movement breaks today</p></div><strong>{today.movementBreaks}<small> / {movementGoal}</small></strong></div><div className="wellness-progress movement"><i style={{ width: `${Math.min(100, today.movementBreaks / movementGoal * 100)}%` }} /></div><div className="wellness-controls"><span>{today.movementBreaks >= movementGoal ? "Daily target reached" : `${movementGoal - today.movementBreaks} to your daily target`}</span><div><button type="button" aria-label="Remove one movement break" disabled={!today.movementBreaks || wellness.save.isPending} onClick={() => void change("movementBreaks", -1)}><Minus /></button><button type="button" aria-label="Add one movement break" disabled={wellness.save.isPending} onClick={() => void change("movementBreaks", 1)}><Plus /></button></div></div></section>
    </div>
    <section className="wellness-history"><div className="section-heading"><h2>Last 7 days</h2><span>Daily check-ins</span></div>{wellness.isPending ? <p>Loading wellness history…</p> : <div className="wellness-days">{(wellness.data ?? []).map(day => <div className="wellness-day" key={day.date}><div className="wellness-bars"><i className="water-bar" style={{ height: `${Math.max(4, Math.min(100, day.waterGlasses / waterGoal * 100))}%` }} /><i className="movement-bar" style={{ height: `${Math.max(4, Math.min(100, day.movementBreaks / movementGoal * 100))}%` }} /></div><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</b><small>{day.date === date ? "Today" : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric" })}</small></div>)}</div>}<div className="wellness-legend"><span><i className="water-dot" /> Water</span><span><i className="movement-dot" /> Movement</span></div></section>
  </>;
}
