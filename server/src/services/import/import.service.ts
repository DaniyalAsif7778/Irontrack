import { extractBackup } from "../../utils/importer.js";
import { RoutineCompletion, RoutineTask } from "../../models/routine/routine.model.js";
import { WeightLog } from "../../models/weight/weight.model.js";

export async function importBackup(ownerId: string, payload: unknown) {
  const { tasks, weights } = extractBackup(payload);
  let taskCount = 0, completionCount = 0, weightCount = 0;
  for (const input of tasks) {
    const { completedDate, ...data } = input;
    const task = await RoutineTask.findOneAndUpdate(
      { ownerId, dayType: data.dayType, block: data.block, title: data.title },
      { ...data, ownerId }, { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    taskCount++;
    if (completedDate) {
      await RoutineCompletion.findOneAndUpdate({ taskId: task._id, date: completedDate }, { completed: true }, { upsert: true });
      completionCount++;
    }
  }
  for (const weight of weights) {
    await WeightLog.findOneAndUpdate({ ownerId, date: weight.date }, { ...weight, ownerId }, { upsert: true, new: true, runValidators: true });
    weightCount++;
  }
  return { imported: { tasks: taskCount, completions: completionCount, weightLogs: weightCount }, ignored: ["workout logs", "analytics", "notifications", "legacy task storage"] };
}
