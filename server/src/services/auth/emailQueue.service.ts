import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { logger } from "../../utils/logger.js";
import type { AuthEmailKind } from "./email.service.js";
import { encryptEmailToken } from "./emailTokenCrypto.js";

export const AUTH_EMAIL_QUEUE = "irontrack-auth-email";

type AuthEmailJob = { kind: AuthEmailKind; to: string; name: string; encryptedToken: string; expiresAt: number };
let queue: Queue<AuthEmailJob> | undefined;

function getQueue() {
  if (queue) return queue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for authentication email delivery");
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableReadyCheck: true });
  connection.on("error", error => logger.warn({ event: "auth_email_redis_connection_error", errorName: error.name }));
  queue = new Queue<AuthEmailJob>(AUTH_EMAIL_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
    },
  });
  return queue;
}

export async function enqueueAuthEmail(kind: AuthEmailKind, to: string, name: string, token: string) {
  const expiresAt = Date.now() + 30 * 60_000;
  try {
    const job = await getQueue().add(kind, {
      kind,
      to,
      name,
      encryptedToken: encryptEmailToken(token),
      expiresAt,
    }, { jobId: `${kind}-${randomUUID()}` });
    return job.id;
  } catch (error) {
    logger.warn({ event: "auth_email_enqueue_failed", kind, errorName: error instanceof Error ? error.name : "UnknownError" });
    const unavailable = new Error("Email delivery is temporarily unavailable. Try again shortly.");
    Object.assign(unavailable, { statusCode: 503 });
    throw unavailable;
  }
}

export async function closeAuthEmailQueue() {
  if (!queue) return;
  await queue.close();
  queue = undefined;
}
