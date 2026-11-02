import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus, X } from "lucide-react";
import type { PrayerTimes, Task, TaskEditing } from "../../../types";
import { taskSchema, type TaskFormValues } from "../../../schemas/routine";
import { calculateEndTime, prayerWindow, taskTimingError, timeAt } from "../../../utils/routineTiming";

export const emptyTask: Omit<Task, "_id" | "completed"> = {
  title: "", description: "", type: "general", priority: "medium", category: "Personal",
  duration: 45, dueDate: "", reminderTime: "", startTime: "", endTime: "", subtasks: [],
};

function taskDuration(task: Task | typeof emptyTask) {
  if (task.duration > 0) return task.duration;
  if (task.startTime && task.endTime) {
    const [startHour, startMinute] = task.startTime.split(":").map(Number);
    const [endHour, endMinute] = task.endTime.split(":").map(Number);
    const difference = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    if (difference > 0) return difference;
  }
  return 45;
}

export default function TaskDialog({
  editing,
  prayerTimes,
  scheduledTasks = [],
  onClose,
  onSave,
}: {
  editing: TaskEditing;
  prayerTimes: PrayerTimes;
  scheduledTasks?: Task[];
  onClose: () => void;
  onSave: (values: TaskFormValues) => void;
}) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const task = editing.task ?? emptyTask;
  const window = prayerWindow(editing.block, prayerTimes);
  const initialDuration = taskDuration(task);
  const initialStartTime = task.startTime || (!editing.task ? window?.startTime ?? "" : "");
  const { register, handleSubmit, control, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { ...task, duration: initialDuration, startTime: initialStartTime },
  });
  const subtasks = useFieldArray({ control, name: "subtasks" });
  const startTime = useWatch({ control, name: "startTime" }) ?? "";
  const duration = useWatch({ control, name: "duration" }) ?? 0;
  const endTime = calculateEndTime(startTime, duration);
  const latestStart = window && duration > 0 ? timeAt(window.endMinutes - duration) : "";

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const firstField = dialog?.querySelector<HTMLElement>("#routine-task-title")
      ?? dialog?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])');
    firstField?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    setValue("endTime", endTime, { shouldValidate: false });
  }, [endTime, setValue]);

  function submit(values: TaskFormValues) {
    const calculatedEndTime = calculateEndTime(values.startTime, values.duration);
    const timingError = taskTimingError(
      editing.block,
      values.startTime,
      calculatedEndTime,
      values.duration,
      prayerTimes,
      scheduledTasks,
      editing.task?._id,
    );
    if (timingError) {
      setError("startTime", { type: "validate", message: timingError });
      return;
    }
    if (values.reminderTime && window) {
      const reminder = Number(values.reminderTime.slice(0, 2)) * 60 + Number(values.reminderTime.slice(3));
      if (reminder < window.startMinutes || reminder >= window.endMinutes) {
        setError("reminderTime", { type: "validate", message: `Choose a reminder inside the ${editing.block} prayer window.` });
        return;
      }
    }
    clearErrors(["startTime", "duration", "reminderTime"]);
    onSave({ ...values, endTime: calculatedEndTime });
  }

  return <div className="modal"><form ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onSubmit={handleSubmit(submit)}>
    <header><h2 id="task-dialog-title">{editing.task ? "Edit task" : "New routine task"}</h2><button type="button" onClick={onClose} aria-label="Close"><X /></button></header>
    <label className="sr-only" htmlFor="routine-task-title">Task title</label><input id="routine-task-title" {...register("title")} placeholder="Task title" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "routine-task-title-error" : undefined} />
    {errors.title && <small id="routine-task-title-error" className="field-error" role="alert">{errors.title.message}</small>}
    <label className="sr-only" htmlFor="routine-task-description">Description</label><textarea id="routine-task-description" {...register("description")} placeholder="Description" />
    <div className="form-grid">
      <label className="sr-only" htmlFor="routine-task-type">Task type</label><input id="routine-task-type" {...register("type")} placeholder="Type" />
      <label className="sr-only" htmlFor="routine-task-priority">Priority</label><select id="routine-task-priority" {...register("priority")}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
      <label className="sr-only" htmlFor="routine-task-category">Category</label><input id="routine-task-category" {...register("category")} placeholder="Category" />
      <label>Block time (minutes)<input {...register("duration", { valueAsNumber: true })} type="number" min="1" max={window ? window.endMinutes - window.startMinutes : 1440} step="1" /></label>
      <label>Due date<input {...register("dueDate")} type="date" /></label>
      <label>Reminder time<input {...register("reminderTime")} type="time" min={window?.startTime} max={window ? timeAt(window.endMinutes - 1) : undefined} disabled={!window} /></label>
      <label>Starts in {editing.block === "fajr" ? "Fajr" : editing.block[0].toUpperCase() + editing.block.slice(1)} block<input {...register("startTime")} type="time" min={window?.startTime} max={latestStart || undefined} disabled={!window} /></label>
      <label>Calculated end<input type="time" value={endTime} readOnly aria-label="Calculated end time" /></label>
    </div>
    <input type="hidden" {...register("endTime")} />
    {window && <small className="settings-hint">{editing.block[0].toUpperCase() + editing.block.slice(1)} tasks run from {window.startTime} until {window.endTime}{window.nextPrayer ? `, before ${window.nextPrayer}` : ""}. Scheduled tasks cannot overlap.</small>}
    {!window && <small className="settings-hint">Set this prayer and the next prayer time in Settings to schedule tasks in this block.</small>}
    {errors.duration && <small className="field-error">{errors.duration.message}</small>}
    {(errors.startTime || errors.endTime) && <small className="field-error">{errors.startTime?.message ?? errors.endTime?.message}</small>}
    {errors.reminderTime && <small className="field-error">{errors.reminderTime.message}</small>}
    <fieldset className="task-subtask-fields"><legend>Subtasks</legend>{subtasks.fields.map((field, index) => <div key={field.id}><input {...register(`subtasks.${index}.title`)} aria-label={`Subtask ${index + 1}`} placeholder="Subtask title" /><label><input {...register(`subtasks.${index}.completed`)} type="checkbox" /> Done</label><button type="button" onClick={() => subtasks.remove(index)} aria-label={`Remove subtask ${index + 1}`}><X size={14} /></button></div>)}<button type="button" onClick={() => subtasks.append({ title: "", completed: false })}><Plus size={14} /> Add subtask</button></fieldset>
    <button className="primary" disabled={isSubmitting}>Save task</button>
  </form></div>;
}
