import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./db/db.js";
import { logger } from "./utils/logger.js";
import { startNotificationScheduler } from "./services/notifications/push.service.js";
import mongoose from "mongoose";

const port = Number(process.env.PORT || 4000);
const uri = process.env.MONGODB_URI;
const authSecret = process.env.AUTH_JWT_SECRET;

if (!uri) {
  logger.error("MONGODB_URI is required. Add it to server/.env.");
  process.exit(1);
}

if (!authSecret || Buffer.byteLength(authSecret) < 32) {
  logger.error("AUTH_JWT_SECRET must contain at least 32 bytes. Generate one before starting the API.");
  process.exit(1);
}

const httpServer = app.listen(port, () => logger.info({ port }, "IronTrack API listening"));

mongoose.connection.on("disconnected", () => logger.warn({ databaseState: mongoose.connection.readyState }, "MongoDB connection lost"));
mongoose.connection.on("connected", () => logger.info("MongoDB connection established"));
mongoose.connection.on("error", error => logger.error({
  errorName: error.name,
  errorCode: "code" in error ? error.code : undefined,
  errorMessage: error.message.slice(0, 500),
}, "MongoDB connection error"));

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "IronTrack API shutting down");
  const forcedExit = setTimeout(() => process.exit(1), 10_000);
  forcedExit.unref();
  httpServer.close(async error => {
    try {
      await mongoose.disconnect();
      if (error) logger.error({ errorName: error.name }, "HTTP server did not close cleanly");
      process.exit(error ? 1 : 0);
    } catch (shutdownError) {
      logger.error({ errorName: shutdownError instanceof Error ? shutdownError.name : "UnknownError" }, "IronTrack API shutdown failed");
      process.exit(1);
    }
  });
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function connectWhenAvailable() {
  let attempt = 0;
  while (!shuttingDown) {
    try {
      const connectStartedAt = Date.now();
      await connectDatabase(uri!);
      attempt = 0;
      startNotificationScheduler();
      logger.info({ connectDurationMs: Date.now() - connectStartedAt }, "MongoDB connected; scheduled notifications are active");
      return;
    } catch (error) {
      attempt += 1;
      const backoff = Math.min(120_000, 5_000 * 2 ** Math.min(attempt - 1, 5));
      const retryInMs = backoff + Math.floor(Math.random() * Math.min(backoff / 5, 5_000));
      logger.error({
        attempt,
        retryInMs,
        databaseState: mongoose.connection.readyState,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown database connection error",
        errorCode: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
      }, "MongoDB connection failed; retry scheduled");
      await mongoose.disconnect().catch(() => undefined);
      await new Promise(resolve => setTimeout(resolve, retryInMs));
    }
  }
}

void connectWhenAvailable();
