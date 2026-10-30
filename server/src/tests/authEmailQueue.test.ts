import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queueConstructor: vi.fn(), queueAdd: vi.fn(), queueClose: vi.fn(), redisConstructor: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(name: string, options: unknown) { mocks.queueConstructor(name, options); }
    add(...args: unknown[]) { return mocks.queueAdd(...args); }
    close() { return mocks.queueClose(); }
  },
}));
vi.mock("ioredis", () => ({
  Redis: class {
    constructor(url: string, options: unknown) { mocks.redisConstructor(url, options); }
    on() { return this; }
  },
}));

import { closeAuthEmailQueue, enqueueAuthEmail } from "../services/auth/emailQueue.service.js";
import { decryptEmailToken } from "../services/auth/emailTokenCrypto.js";

beforeEach(async () => {
  await closeAuthEmailQueue();
  vi.clearAllMocks();
  vi.stubEnv("REDIS_URL", "redis://localhost:6379/0");
  vi.stubEnv("AUTH_JWT_SECRET", "test-secret-with-more-than-thirty-two-bytes");
  mocks.queueAdd.mockResolvedValue({ id: "verify_email-job" });
  mocks.queueClose.mockResolvedValue(undefined);
});

afterEach(async () => {
  await closeAuthEmailQueue();
  vi.unstubAllEnvs();
});

describe("authentication email queue", () => {
  it("stores only an encrypted token and configures bounded retries and retention", async () => {
    const token = "single-use-verification-token";
    await expect(enqueueAuthEmail("verify_email", "person@example.com", "Person", token)).resolves.toBe("verify_email-job");
    const [queueName, options] = mocks.queueConstructor.mock.calls[0];
    expect(queueName).toBe("irontrack-auth-email");
    expect(options.defaultJobOptions).toMatchObject({
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600, count: 1000 },
    });
    const [kind, payload] = mocks.queueAdd.mock.calls[0];
    expect(kind).toBe("verify_email");
    expect(payload.encryptedToken).not.toContain(token);
    expect(decryptEmailToken(payload.encryptedToken)).toBe(token);
    expect(payload.expiresAt).toBeGreaterThan(Date.now());
  });

  it("returns a retryable service error if Redis cannot accept the job", async () => {
    mocks.queueAdd.mockRejectedValue(new Error("connection failure"));
    await expect(enqueueAuthEmail("verify_email", "person@example.com", "Person", "token"))
      .rejects.toMatchObject({ statusCode: 503 });
  });
});
