import { Plus, Sun } from "lucide-react";
import type { Day, Task, TaskEditing } from "../../types";
import TaskCard from "./components/TaskCard";

type RoutinePageProps = {
  date: string;
  title: string;
  day: Day | null;
  setDate: (value: string) => void;
  complete: (task: Task) => void;
  edit: (value: TaskEditing) => void;
  remove: (id: string) => void;
  saveSubtasks: (task: Task, subtasks: Task["subtasks"]) => void;
};

export default function RoutinePage({ date, title, day, setDate, complete, edit, remove, saveSubtasks }: RoutinePageProps) {
  return <>
    <header><div><h1>Routine</h1><p>Your day, anchored by prayer and intentional tasks.</p></div><input aria-label="Routine date" type="date" value={date} onChange={event => setDate(event.target.value)} /></header>
    <section className="summary"><div><small>{title.toUpperCase()}</small><strong>{day?.dayType ?? ""} routine</strong></div><div><small>PROGRESS</small><strong>{day?.progress.completed ?? 0}/{day?.progress.total ?? 0}</strong></div></section>
    {day && day.progress.total === 0 && <section className="routine-empty" aria-live="polite">
      <div><h2>Your routine is ready</h2><p>The backup had no routine tasks. Add the first one to start building your day.</p></div>
      <button type="button" className="settings-secondary" onClick={() => edit({ block: day.blocks[0]?.id ?? "fajr" })}><Plus size={15} /> Add your first task</button>
    </section>}
    <div className="blocks">{day?.blocks.map(block => {
      const prayerIndex = block.tasks.findIndex(task => task.type.toLowerCase() === "prayer");
      const firstAfterPrayer = prayerIndex < 0 ? -1 : block.tasks.findIndex((task, index) => index > prayerIndex && task.type.toLowerCase() !== "prayer");
      return <section className="block" key={block.id}>
        <div className="block-title"><h2><Sun /> {block.label}</h2><span>{block.completed}/{block.total}</span></div>
        <div className="progress"><i style={{ width: `${block.total ? block.completed / block.total * 100 : 0}%` }} /></div>
        {block.tasks.map((task, index) => <div className="task-wrap" key={task._id}>
          {index === firstAfterPrayer && <h3 className="block-divider">After {block.label}</h3>}
          <TaskCard task={task} blockId={block.id} complete={complete} edit={edit} remove={remove} saveSubtasks={saveSubtasks} />
        </div>)}
        <button className="add" onClick={() => edit({ block: block.id })}><Plus size={15} /> Add task</button>
      </section>;
    })}</div>
  </>;
}
