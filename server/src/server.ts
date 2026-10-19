import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase } from "./db/db.js";
import { logger } from "./utils/logger.js";
import { ensureSingleUser } from "./services/auth/singleUser.service.js";
import { isSingleUserMode } from "./middlewares/requireAuth.js";
import { startNotificationScheduler } from "./services/notifications/push.service.js";

const port = Number(process.env.PORT ?? 4000);
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

if (process.env.NODE_ENV === "production" && process.env.SINGLE_USER_MODE === "true") {
  logger.error("SINGLE_USER_MODE is for local use only. Protect production with authentication.");
  process.exit(1);
}

const logStarted = () => logger.info({ port, singleUserMode: isSingleUserMode() }, "IronTrack API listening");
if (isSingleUserMode()) app.listen(port, "127.0.0.1", logStarted);
else app.listen(port, logStarted);

async function connectWhenAvailable() {
  while (true) {
    try {
      await connectDatabase(uri!);
      if (isSingleUserMode()) await ensureSingleUser();
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
