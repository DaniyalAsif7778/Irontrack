import { createServer } from "node:http";
import { performance } from "node:perf_hooks";

process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "silent";
process.env.TRUST_PROXY = "1";
process.env.AUTH_JWT_SECRET = `local-load-test-${crypto.randomUUID()}-${crypto.randomUUID()}-irontrack`;

const [{ app }, { signSession }] = await Promise.all([
  import("../dist/app.js"),
  import("../dist/middlewares/requireAuth.js"),
]);

const server = createServer(app);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const iterationsPerUser = Number(process.env.LOAD_ITERATIONS ?? 50);
const levels = (process.env.LOAD_USERS ?? "5,20,50,100").split(",").map(Number).filter(value => Number.isInteger(value) && value > 0);
const results = [];
let userOffset = 0;

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

try {
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
  console.log(JSON.stringify({ target: "local Express app; authenticated non-database route", iterationsPerUser, results }, null, 2));
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
