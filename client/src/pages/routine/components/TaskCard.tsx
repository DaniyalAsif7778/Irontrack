import { Check, Clock3, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Task } from "../../../types";

type TaskCardProps = {
  task: Task;
  blockId: string;
  complete: (task: Task) => void;
  edit: (value: { block: string; task?: Task }) => void;
  remove: (id: string) => void;
  saveSubtasks: (task: Task, subtasks: Task["subtasks"]) => void;
};

export default function TaskCard({ task, blockId, complete, edit, remove, saveSubtasks }: TaskCardProps) {
  const [adding, setAdding] = useState(false);
  const isPrayer = task.type.toLowerCase() === "prayer";

  function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget), title = String(form.get("title") ?? "").trim();
    if (!title) return;
    saveSubtasks(task, [...(task.subtasks ?? []), { title, completed: false }]);
    event.currentTarget.reset();
    setAdding(false);
  }

  function toggleSubtask(index: number) {
    saveSubtasks(task, task.subtasks.map((subtask, item) => item === index ? { ...subtask, completed: !subtask.completed } : subtask));
  }

  return <article className={`task ${task.completed ? "done" : ""}`}>
    <button className="check" onClick={() => complete(task)} aria-label={`Mark ${task.title} ${task.completed ? "incomplete" : "complete"}`}>{task.completed && <Check size={11} />}</button>
    <div className="task-content">
      <b>{task.title}</b>{task.description && <p>{task.description}</p>}
      <div className="tags"><em className={`task-type ${isPrayer ? "prayer-type" : ""}`}>{task.type}</em>{task.duration > 0 && <span className="task-duration"><Clock3 size={12} /> {task.duration}m</span>}</div>
      {task.subtasks?.length > 0 && <ul className="subtask-list">{task.subtasks.map((subtask, index) => <li key={index}><button type="button" className={subtask.completed ? "subtask-done" : ""} onClick={() => toggleSubtask(index)}><span>{subtask.completed && <Check size={10} />}</span>{subtask.title}</button></li>)}</ul>}
      {adding ? <form className="subtask-form" onSubmit={addSubtask}><input name="title" aria-label={`New subtask for ${task.title}`} placeholder="Subtask name" autoFocus required /><button type="submit">Add</button><button type="button" onClick={() => setAdding(false)}>Cancel</button></form> : <button type="button" className="subtask-add" onClick={() => setAdding(true)}><Plus size={14} /> Add subtask</button>}
    </div>
    <div className="task-actions"><button onClick={() => window.dispatchEvent(new CustomEvent("irontrack:start-task-timer", { detail: { taskId: task._id, taskTitle: task.title } }))} aria-label={`Start focus timer for ${task.title}`}><Play /></button><button onClick={() => edit({ block: blockId, task })} aria-label={`Edit ${task.title}`}><Pencil /></button><button onClick={() => remove(task._id)} aria-label={`Delete ${task.title}`}><Trash2 /></button></div>
  </article>;
}
