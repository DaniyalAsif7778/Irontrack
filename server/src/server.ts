import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./db/db.js";
import { logger } from "./utils/logger.js";
import { startNotificationScheduler } from "./services/notifications/push.service.js";

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

const logStarted = () => logger.info({ port }, "IronTrack API listening");
app.listen(port, logStarted);

async function connectWhenAvailable() {
  while (true) {
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
