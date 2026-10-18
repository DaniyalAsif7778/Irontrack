import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import type { Task, TaskEditing } from "../../../types";
import { taskSchema, type TaskFormValues } from "../../../schemas/routine";

export const emptyTask: Omit<Task, "_id" | "completed"> = {
  title: "", description: "", type: "general", priority: "medium", category: "Personal",
  duration: 0, dueDate: "", reminderTime: "", subtasks: [],
};

export default function TaskDialog({ editing, onClose, onSave }: { editing: TaskEditing; onClose: () => void; onSave: (values: TaskFormValues) => void }) {
  const task = editing.task ?? emptyTask;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: task });
  return <div className="modal"><form onSubmit={handleSubmit(onSave)}>
    <header><h2>{editing.task ? "Edit task" : "New routine task"}</h2><button type="button" onClick={onClose} aria-label="Close"><X /></button></header>
    <input {...register("title")} placeholder="Task title" aria-invalid={Boolean(errors.title)} />
    {errors.title && <small className="field-error">{errors.title.message}</small>}
    <textarea {...register("description")} placeholder="Description" />
    <div className="form-grid"><input {...register("type")} placeholder="Type" /><select {...register("priority")}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><input {...register("category")} placeholder="Category" /><input {...register("duration", { valueAsNumber: true })} type="number" min="0" max="1440" /><input {...register("dueDate")} type="date" /><input {...register("reminderTime")} type="time" /></div>
    {errors.duration && <small className="field-error">{errors.duration.message}</small>}
    <button className="primary" disabled={isSubmitting}>Save task</button>
  </form></div>;
}
