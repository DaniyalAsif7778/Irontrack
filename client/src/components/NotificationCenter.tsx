import { useMemo, useState } from "react";
import { Bell, BellRing, CalendarClock, ChevronRight, X } from "lucide-react";
import { useRoutineDay } from "../hooks/hooks";
import { ironToday } from "../utils/date";

export default function NotificationCenter({ onNavigate }: { onNavigate: (view: "routine" | "wellness") => void }) {
  const date = ironToday();
  const { data } = useRoutineDay(date);
  const [open, setOpen] = useState(false);
  const upcoming = useMemo(() => {
    const current = new Date();
    const time = `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;
    return (data?.blocks ?? []).flatMap(block => block.tasks.filter(task => task.reminderTime && task.reminderTime >= time && !task.completed).map(task => ({ ...task, block: block.label }))).sort((a, b) => a.reminderTime.localeCompare(b.reminderTime));
  }, [data]);
  return <>
    <button className="notification-center-trigger" type="button" aria-label={`Open reminder center${upcoming.length ? `, ${upcoming.length} upcoming` : ""}`} aria-expanded={open} onClick={() => setOpen(value => !value)}><Bell size={18} />{upcoming.length > 0 && <i>{upcoming.length > 9 ? "9+" : upcoming.length}</i>}</button>
    {open && <><button type="button" className="notification-center-scrim" aria-label="Close reminder center" onClick={() => setOpen(false)} /><section className="notification-center" aria-label="Reminder center"><div className="notification-center-head"><div><span><BellRing size={16} /></span><div><b>Today’s reminders</b><small>{upcoming.length ? `${upcoming.length} upcoming` : "Nothing scheduled ahead"}</small></div></div><button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={16} /></button></div>
      {upcoming.length ? <div className="notification-center-list">{upcoming.map(task => <button type="button" className="notification-center-item" key={task._id} onClick={() => { setOpen(false); onNavigate("routine"); }}><span className="notification-time"><CalendarClock size={14} />{task.reminderTime}</span><span><b>{task.title}</b><small>{task.block}</small></span><ChevronRight size={15} /></button>)}</div> : <p className="notification-center-empty">Set a reminder time on any routine task and it will appear here.</p>}
      <button className="notification-center-manage" type="button" onClick={() => { setOpen(false); onNavigate("wellness"); }}>Manage notifications and wellness</button>
    </section></>}
  </>;
}
