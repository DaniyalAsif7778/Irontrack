import mongoose from "mongoose";
import { RoutineEvent } from "../models/routine/routine.model.js";
import { WorkoutLog, WorkoutPlan } from "../models/workout/workout.model.js";
import { WeightLog } from "../models/weight/weight.model.js";
import { logger } from "../utils/logger.js";

const monitoredClients = new WeakSet<object>();
const configuredSlowQueryMs = Number(process.env.MONGO_SLOW_QUERY_MS);
const slowQueryMs = Number.isFinite(configuredSlowQueryMs) && configuredSlowQueryMs > 0 ? configuredSlowQueryMs : 250;

export async function connectDatabase(uri: string) {
  await mongoose.connect(uri, { dbName: "irontrack", monitorCommands: true });
  monitorDatabaseCommands();
  // Replace the pre-account global unique indexes with per-owner uniqueness.
  // Existing unowned records remain untouched and inaccessible to accounts.
  await Promise.all([
    dropLegacyIndex(WeightLog.collection, "date_1"),
    dropLegacyIndex(WorkoutPlan.collection, "dayType_1"),
    dropLegacyIndex(WorkoutLog.collection, "date_1_dayType_1"),
    ensureRoutineEventTimelineIndex(),
  ]);
}

function monitorDatabaseCommands() {
  const client = mongoose.connection.getClient();
  if (monitoredClients.has(client)) return;
  monitoredClients.add(client);
  client.on("commandSucceeded", event => {
    if (event.duration < slowQueryMs) return;
    logger.warn({ command: event.commandName, durationMs: event.duration, mongoRequestId: event.requestId }, "Slow MongoDB command");
  });
  client.on("commandFailed", event => {
    const errorCode = (event.failure as Error & { code?: number } | undefined)?.code;
    if (errorCode === 27) return;
    logger.error({ command: event.commandName, durationMs: event.duration, mongoRequestId: event.requestId, errorName: event.failure?.name ?? "MongoCommandError", errorCode }, "MongoDB command failed");
  });
}

async function ensureRoutineEventTimelineIndex() {
  await RoutineEvent.collection.createIndex({ ownerId: 1, occurredAt: -1, _id: -1 }, { name: "routine_events_owner_timeline" });
  await dropLegacyIndex(RoutineEvent.collection, "ownerId_1_occurredAt_-1");
}

async function dropLegacyIndex(collection: mongoose.mongo.Collection, indexName: string) {
  try {
    await collection.dropIndex(indexName);
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 27) throw error;
  }
}
