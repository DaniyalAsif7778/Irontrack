import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import mongoose from "mongoose";

process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "silent";
process.env.TRUST_PROXY = "1";
process.env.AUTH_JWT_SECRET = `local-load-test-${crypto.randomUUID()}-${crypto.randomUUID()}-irontrack`;

const [{ app }, { signSession }, { User }] = await Promise.all([
  import("../dist/app.js"),
  import("../dist/middlewares/requireAuth.js"),
  import("../dist/models/auth/user.model.js"),
]);

const mongoUri = process.env.LOAD_MONGO_URI;
if (!mongoUri) throw new Error("Set LOAD_MONGO_URI to a temporary MongoDB database URI.");
const iterationsPerUser = Number(process.env.LOAD_ITERATIONS ?? 50);
const levels = (process.env.LOAD_USERS ?? "5,20,50,100").split(",").map(Number).filter(value => Number.isInteger(value) && value > 0);
const results = [];
let userOffset = 0;
let server;
let baseUrl;

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

try {
  await mongoose.connect(mongoUri, { dbName: "irontrack_loadtest", serverSelectionTimeoutMS: 5000 });
  const totalUsers = levels.reduce((total, value) => total + value, 0);
  await User.insertMany(Array.from({ length: totalUsers }, (_, index) => {
    const userId = `64${String(index + 1).padStart(22, "0")}`;
    return { _id: new mongoose.Types.ObjectId(userId), name: `Smoke User ${index + 1}`, email: `smoke-${index + 1}@irontrack.invalid`, passwordHash: "not-a-real-password-hash", emailVerified: true };
  }));
  server = createServer(app);
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", error => error ? reject(error) : resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not bind smoke-test server to a TCP port.");
  baseUrl = `http://127.0.0.1:${address.port}`;

  for (const userCount of levels) {
    const samples = [];
    let failures = 0;
    let completed = 0;
    const statuses = {};
    const memoryBefore = process.memoryUsage().rss;
    const cpuBefore = process.cpuUsage();
    const startedAt = performance.now();
    await Promise.all(Array.from({ length: userCount }, async (_, userIndex) => {
      const userId = `64${String(userIndex + 1).padStart(22, "0")}`;
      const token = signSession(userId);
      for (let iteration = 0; iteration < iterationsPerUser; iteration += 1) {
        const started = performance.now();
        try {
          const response = await fetch(`${baseUrl}/api/notifications/config`, {
            headers: {
              cookie: `irontrack_session=${token}`,
              "x-forwarded-for": `198.51.${Math.floor((userIndex + userOffset) / 250)}.${((userIndex + userOffset) % 250) + 1}`,
            },
          });
          statuses[response.status] = (statuses[response.status] ?? 0) + 1;
          if (response.status !== 200) failures += 1;
          await response.arrayBuffer();
        } catch {
          failures += 1;
        }
        samples.push(performance.now() - started);
        completed += 1;
      }
    }));
    const elapsedMs = performance.now() - startedAt;
    const cpuUsed = process.cpuUsage(cpuBefore);
    samples.sort((left, right) => left - right);
    results.push({
      fakeUsers: userCount,
      requests: completed,
      errors: failures,
      statusCounts: statuses,
      elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
      requestsPerSecond: Number((completed / (elapsedMs / 1000)).toFixed(1)),
      process: {
        cpuSeconds: Number(((cpuUsed.user + cpuUsed.system) / 1_000_000).toFixed(2)),
        rssDeltaMiB: Number(((process.memoryUsage().rss - memoryBefore) / (1024 * 1024)).toFixed(1)),
      },
      latencyMs: {
        p50: Number(percentile(samples, 0.5).toFixed(2)),
        p95: Number(percentile(samples, 0.95).toFixed(2)),
        p99: Number(percentile(samples, 0.99).toFixed(2)),
        max: Number(Math.max(...samples).toFixed(2)),
      },
    });
    userOffset += userCount;
  }
  console.log(JSON.stringify({ target: "local Express app; authenticated notification config route with isolated database readiness", database: mongoose.connection.name, iterationsPerUser, results }, null, 2));
  if (results.some(result => result.errors > 0)) process.exitCode = 1;
} finally {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === "irontrack_loadtest") await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
