import mongoose from "mongoose";
import { WorkoutLog, WorkoutPlan, WorkoutProgression } from "../../models/workout/workout.model.js";
import { extractWorkoutExport } from "../../utils/workoutImporter.js";

/** Imports a legacy export without replacing any account-owned records. */
export async function importWorkoutExport(ownerId: string, source: unknown) {
  if (!mongoose.isValidObjectId(ownerId)) throw new Error("A valid account id is required");
  const imported = extractWorkoutExport(source);
  const owner = new mongoose.Types.ObjectId(ownerId);
  const counts = { plansAdded: 0, plansSkipped: 0, logsAdded: 0, logsSkipped: 0, progressionAdded: 0, progressionSkipped: 0 };

  for (const plan of imported.plans) {
    const result = await WorkoutPlan.updateOne(
      { ownerId: owner, dayType: plan.dayType },
      { $setOnInsert: { ownerId: owner, dayType: plan.dayType, exercises: plan.exercises } },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount) counts.plansAdded++;
    else counts.plansSkipped++;
  }

  for (const log of imported.logs) {
    const result = await WorkoutLog.updateOne(
      { ownerId: owner, date: log.date, dayType: log.dayType },
      { $setOnInsert: { ...log, ownerId: owner } },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount) counts.logsAdded++;
    else counts.logsSkipped++;
  }

  for (const progression of imported.progression) {
    const result = await WorkoutProgression.updateOne(
      { ownerId: owner, exerciseId: progression.exerciseId },
      { $setOnInsert: { ...progression, ownerId: owner } },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount) counts.progressionAdded++;
    else counts.progressionSkipped++;
  }

  return counts;
}
