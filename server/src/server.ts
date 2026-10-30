import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./db/db.js";
import { logger } from "./utils/logger.js";
import { startNotificationScheduler } from "./services/notifications/push.service.js";
import { closeAuthEmailQueue } from "./services/auth/emailQueue.service.js";
import mongoose from "mongoose";

const port = Number(process.env.PORT || 5000);
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

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "IronTrack API shutting down");
  const forcedExit = setTimeout(() => process.exit(1), 10_000);
  forcedExit.unref();
  httpServer.close(async error => {
    try {
      await Promise.all([closeAuthEmailQueue(), mongoose.disconnect()]);
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
  while (!shuttingDown) {
    try {
      await connectDatabase(uri!);
      startNotificationScheduler();
      logger.info("MongoDB connected; scheduled notifications are active");
      return;
    } catch (error) {
      logger.error({ err: error }, "MongoDB connection failed; retrying in 30 seconds");
      await new Promise(resolve => setTimeout(resolve, 30_000));
    }
  }
}

void connectWhenAvailable();
