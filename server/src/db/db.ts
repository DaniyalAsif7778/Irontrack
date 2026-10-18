import mongoose from "mongoose";
import { WorkoutLog, WorkoutPlan } from "../models/workout/workout.model.js";
import { WeightLog } from "../models/weight/weight.model.js";

export async function connectDatabase(uri: string) {
  await mongoose.connect(uri, { dbName: "irontrack" });
  // Replace the pre-account global unique indexes with per-owner uniqueness.
  // Existing unowned records remain untouched and inaccessible to accounts.
  await Promise.all([
    dropLegacyIndex(WeightLog.collection, "date_1"),
    dropLegacyIndex(WorkoutPlan.collection, "dayType_1"),
    dropLegacyIndex(WorkoutLog.collection, "date_1_dayType_1"),
  ]);
}

async function dropLegacyIndex(collection: mongoose.mongo.Collection, indexName: string) {
  try {
    await collection.dropIndex(indexName);
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 27) throw error;
  }
}
