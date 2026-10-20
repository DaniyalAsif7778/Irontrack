import { BLOCKS, blockLabel } from "../../constant.js";
import { RoutineCompletion, RoutineReminder, RoutineTask, RoutineTaskOccurrence } from "../../models/routine/routine.model.js";
import { listRoutineOccurrences } from "./routine-events.service.js";

export async function listSchedule(ownerId: string, dayType: string) {
  const tasks = await RoutineTask.find({ ownerId, dayType }).sort({ block: 1, order: 1, createdAt: 1 });
  return { dayType, blocks: BLOCKS.map(id => ({ id, label: blockLabel[id], tasks: tasks.filter(task => task.block === id) })) };
}

export async function copySchedule(ownerId: string, sourceDayType: string, targetDayType: string) {
  const sourceTasks = await RoutineTask.find({ ownerId, dayType: sourceDayType }).sort({ block: 1, order: 1, createdAt: 1 }).lean();
  if (!sourceTasks.length) return null;
  const targetTasks = await RoutineTask.find({ ownerId, dayType: targetDayType }).select("_id").lean();
  if (targetTasks.length) {
    const taskIds = targetTasks.map(task => task._id);
    await Promise.all([RoutineCompletion.deleteMany({ taskId: { $in: taskIds } }), RoutineTaskOccurrence.deleteMany({ ownerId, taskId: { $in: taskIds } }), RoutineReminder.deleteMany({ ownerId, taskId: { $in: taskIds } })]);
  }
  await RoutineTask.deleteMany({ ownerId, dayType: targetDayType });
  const cloned = sourceTasks.map(({ _id, createdAt, updatedAt, __v, ...task }) => ({ ...task, dayType: targetDayType }));
  await RoutineTask.insertMany(cloned);
  return { sourceDayType, targetDayType, copiedTasks: cloned.length };
}

export async function getDay(ownerId: string, date: string, dayType: string, timezone = "UTC") {
  const tasks = await listRoutineOccurrences(ownerId, date, timezone);
  const completions = await RoutineCompletion.find({ date, taskId: { $in: tasks.map(task => task._id) }, completed: true }).lean();
  const done = new Set(completions.map(completion => String(completion.taskId)));
  const blocks = BLOCKS.map(id => {
    const items = tasks.filter(task => task.block === id).map(task => ({ ...task, completed: done.has(String(task._id)) || task.occurrence?.status === "completed" }));
    return { id, label: blockLabel[id], tasks: items, completed: items.filter(task => task.completed).length, total: items.length };
  });
  return { date, dayType, blocks, progress: { completed: blocks.reduce((total, block) => total + block.completed, 0), total: blocks.reduce((total, block) => total + block.total, 0) } };
}

export async function createTask(ownerId: string, data: Record<string, unknown>) {
  const order = await RoutineTask.countDocuments({ ownerId, dayType: data.dayType, block: data.block });
  return RoutineTask.create({ ...data, ownerId, order });
}

export async function updateTask(ownerId: string, id: string, data: Record<string, unknown>) {
  const task = await RoutineTask.findOneAndUpdate({ _id: id, ownerId }, data, { new: true, runValidators: true });
  if (task) await RoutineTaskOccurrence.deleteMany({ ownerId, taskId: id, status: "planned" });
  return task;
}

export async function deleteTask(ownerId: string, id: string) {
  const task = await RoutineTask.findOneAndDelete({ _id: id, ownerId });
  if (task) await Promise.all([RoutineCompletion.deleteMany({ taskId: task._id }), RoutineTaskOccurrence.deleteMany({ ownerId, taskId: task._id }), RoutineReminder.deleteMany({ ownerId, taskId: task._id })]);
  return task;
}

export async function setCompletion(ownerId: string, id: string, date: string, completed: boolean) {
  if (!await RoutineTask.exists({ _id: id, ownerId })) return null;
  await RoutineTask.updateOne({ _id: id, ownerId }, { $set: { status: completed ? "completed" : "pending" } });
  return RoutineCompletion.findOneAndUpdate({ taskId: id, date }, { completed }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
