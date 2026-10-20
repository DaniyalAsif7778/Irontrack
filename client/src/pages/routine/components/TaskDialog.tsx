import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, X } from "lucide-react";
import type { Task, TaskEditing } from "../../../types";
import { taskSchema, type TaskFormValues } from "../../../schemas/routine";

export const emptyTask: Omit<Task, "_id" | "completed"> = {
  title: "", description: "", type: "general", priority: "medium", category: "Personal",
  duration: 0, dueDate: "", reminderTime: "", startTime: "", endTime: "", subtasks: [],
};

export default function TaskDialog({ editing, onClose, onSave }: { editing: TaskEditing; onClose: () => void; onSave: (values: TaskFormValues) => void }) {
  const task = editing.task ?? emptyTask;
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: task });
  const subtasks = useFieldArray({ control, name: "subtasks" });
  return <div className="modal"><form onSubmit={handleSubmit(onSave)}>
    <header><h2>{editing.task ? "Edit task" : "New routine task"}</h2><button type="button" onClick={onClose} aria-label="Close"><X /></button></header>
    <input {...register("title")} placeholder="Task title" aria-invalid={Boolean(errors.title)} />
    {errors.title && <small className="field-error">{errors.title.message}</small>}
    <textarea {...register("description")} placeholder="Description" />
    <div className="form-grid"><input {...register("type")} placeholder="Type" /><select {...register("priority")}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><input {...register("category")} placeholder="Category" /><label>Planned duration<input {...register("duration", { valueAsNumber: true })} type="number" min="0" max="1440" /></label><label>Due date<input {...register("dueDate")} type="date" /></label><label>Reminder time<input {...register("reminderTime")} type="time" /></label><label>Daily block starts<input {...register("startTime")} type="time" /></label><label>Daily block ends<input {...register("endTime")} type="time" /></label></div>
    {errors.duration && <small className="field-error">{errors.duration.message}</small>}
    <fieldset className="task-subtask-fields"><legend>Subtasks</legend>{subtasks.fields.map((field, index) => <div key={field.id}><input {...register(`subtasks.${index}.title`)} aria-label={`Subtask ${index + 1}`} placeholder="Subtask title" /><label><input {...register(`subtasks.${index}.completed`)} type="checkbox" /> Done</label><button type="button" onClick={() => subtasks.remove(index)} aria-label={`Remove subtask ${index + 1}`}><X size={14} /></button></div>)}<button type="button" onClick={() => subtasks.append({ title: "", completed: false })}><Plus size={14} /> Add subtask</button></fieldset>
    <button className="primary" disabled={isSubmitting}>Save task</button>
  </form></div>;
}
