import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../utils/logger.js";
import { AUTH_EMAIL_QUEUE } from "../services/auth/emailQueue.service.js";
import { deliverAuthEmail, type AuthEmailKind } from "../services/auth/email.service.js";
import { decryptEmailToken } from "../services/auth/emailTokenCrypto.js";

type AuthEmailJob = { kind: AuthEmailKind; to: string; name: string; encryptedToken: string; expiresAt: number };

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  logger.fatal("REDIS_URL is required to start the authentication email worker");
  process.exit(1);
}

const workerConcurrency = Math.max(1, Math.min(20, Number.parseInt(process.env.EMAIL_WORKER_CONCURRENCY ?? "5", 10) || 5));
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
connection.on("error", error => logger.warn({ event: "auth_email_worker_redis_error", errorName: error.name }));

const worker = new Worker<AuthEmailJob>(AUTH_EMAIL_QUEUE, processEmailJob, {
  connection,
  concurrency: workerConcurrency,
  limiter: { max: 5, duration: 1000 },
});

async function processEmailJob(job: Job<AuthEmailJob>) {
  const { kind, to, name, encryptedToken, expiresAt } = job.data;
  if (Date.now() >= expiresAt) {
    logger.info({ event: "auth_email_job_expired", jobId: job.id, kind });
    return;
  }
  await deliverAuthEmail(kind, to, name, decryptEmailToken(encryptedToken));
}

worker.on("completed", job => logger.info({ event: "auth_email_job_sent", jobId: job.id, kind: job.data.kind }));
worker.on("failed", (job, error) => logger.warn({
  event: "auth_email_job_failed",
  jobId: job?.id,
  kind: job?.data.kind,
  attemptsMade: job?.attemptsMade,
  errorName: error.name,
}));
worker.on("error", error => logger.error({ event: "auth_email_worker_error", errorName: error.name }));
logger.info({ event: "auth_email_worker_started", concurrency: workerConcurrency });

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  logger.info({ event: "auth_email_worker_stopping", signal });
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
