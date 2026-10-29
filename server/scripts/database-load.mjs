import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";

process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "silent";
process.env.TRUST_PROXY = "1";
process.env.AUTH_JWT_SECRET = `local-db-load-${crypto.randomUUID()}-${crypto.randomUUID()}`;
process.env.AUTH_REFRESH_SECRET = `local-db-refresh-${crypto.randomUUID()}-${crypto.randomUUID()}`;

const [{ app }, { User }, { WorkoutLog, WorkoutPlan, WorkoutProgram }, { AuthSession }, { AuthChallenge }] = await Promise.all([
  import("../dist/app.js"),
  import("../dist/models/auth/user.model.js"),
  import("../dist/models/workout/workout.model.js"),
  import("../dist/models/auth/session.model.js"),
  import("../dist/models/auth/authChallenge.model.js"),
]);

const mongoUri = process.env.LOAD_MONGO_URI;
if (!mongoUri) throw new Error("Set LOAD_MONGO_URI to the temporary local MongoDB container URI.");
const password = "LoadTest-Only-Password-NotReal-2026!";
const levels = (process.env.LOAD_USERS ?? "5,20,50,100").split(",").map(Number).filter(value => Number.isInteger(value) && value > 0);
const date = new Date().toISOString().slice(0, 10);
const statusCounts = {};
const latencies = new Map();
const failures = [];
let requestCount = 0;
let userOffset = 0;
let server;

function record(name, status, elapsed) {
  requestCount += 1;
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  const values = latencies.get(name) ?? [];
  values.push(elapsed);
  latencies.set(name, values);
  if (status < 200 || status >= 300) failures.push({ endpoint: name, status });
}

async function request(name, path, { ip, cookie, body, method } = {}) {
  const started = performance.now();
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method: method ?? (body === undefined ? "GET" : "PUT"),
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
        ...(ip ? { "x-forwarded-for": ip } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    record(name, response.status, performance.now() - started);
    if (!response.ok) throw new Error(`${name} returned ${response.status}: ${text.slice(0, 180)}`);
    return { response, data: text ? JSON.parse(text) : null };
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith(`${name} returned`)) record(name, 0, performance.now() - started);
    throw error;
  }
}

function summarize(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const p = fraction => ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)] ?? 0;
  return { count: ordered.length, p50: Number(p(0.5).toFixed(1)), p95: Number(p(0.95).toFixed(1)), p99: Number(p(0.99).toFixed(1)), max: Number((ordered.at(-1) ?? 0).toFixed(1)) };
}

try {
  await mongoose.connect(mongoUri, { dbName: "irontrack_loadtest", serverSelectionTimeoutMS: 5000 });
  server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

  const totalUsers = levels.reduce((total, value) => total + value, 0);
  const passwordHash = await bcrypt.hash(password, 12);
  await User.insertMany(Array.from({ length: totalUsers }, (_, index) => ({
    name: `Synthetic User ${index + 1}`,
    email: `load-${index + 1}@irontrack.invalid`,
    passwordHash,
    emailVerified: true,
  })), { ordered: false });

  const stages = [];
  for (const userCount of levels) {
    const stageStarted = performance.now();
    const firstIndex = userOffset;
    const stageFailures = [];
    await Promise.all(Array.from({ length: userCount }, async (_, localIndex) => {
      const index = firstIndex + localIndex;
      const ip = `198.51.${Math.floor(index / 250)}.${(index % 250) + 1}`;
      const email = `load-${index + 1}@irontrack.invalid`;
      const planId = `load-plan-${index + 1}`;
      try {
        const login = await request("POST /auth/login", "/api/auth/login", { ip, method: "POST", body: { email, password } });
        const sessionCookie = login.response.headers.getSetCookie().map(value => value.split(";", 1)[0]).find(value => value.startsWith("irontrack_session="));
        if (!sessionCookie) throw new Error("Login response did not set the access session cookie.");

        await request("GET /workout-plans", "/api/workout-plans", { ip, cookie: sessionCookie });
        await request("GET /workout-week", "/api/workout-week", { ip, cookie: sessionCookie });
        await request("PUT /workout-plans/:id", `/api/workout-plans/${planId}`, {
          ip, cookie: sessionCookie,
          body: { name: "Load Test Day", exercises: [{ id: "load-exercise", name: "Test Squat", muscle: "Legs", sets: 1, reps: 5, tempo: "3-1-2", rest: 60, cues: [], setList: [{ reps: 5, weight: 20 }] }] },
        });
        const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((key, dayIndex) => ({ key, label: key, planId: dayIndex === 0 ? planId : null }));
        await request("PUT /workout-week", "/api/workout-week", { ip, cookie: sessionCookie, body: { days } });
        const log = await request("POST /workout-logs", "/api/workout-logs", {
          ip, cookie: sessionCookie,
          method: "POST", body: { date, dayType: planId, dayName: "Load Test Day", duration: 60, actionId: `load-action-${index + 1}`, exercises: [{ exerciseId: "load-exercise", name: "Test Squat", muscle: "Legs", sets: [{ reps: 5, weight: 20 }] }] },
        });
        if (log.data?.totalSets !== 1) throw new Error("Workout log aggregate did not preserve the completed set.");
        const plans = await request("GET /workout-plans", "/api/workout-plans", { ip, cookie: sessionCookie });
        const week = await request("GET /workout-week", "/api/workout-week", { ip, cookie: sessionCookie });
        const logs = await request("GET /workout-logs", "/api/workout-logs", { ip, cookie: sessionCookie });
        if (plans.data.length !== 1 || week.data[0]?.planId !== planId || logs.data.length !== 1) throw new Error("Account data isolation/read-after-write check failed.");
      } catch (error) {
        stageFailures.push({ syntheticUser: index + 1, error: error instanceof Error ? error.message : String(error) });
      }
    }));
    const durationMs = performance.now() - stageStarted;
    stages.push({ fakeUsersAtOnce: userCount, elapsedSeconds: Number((durationMs / 1000).toFixed(2)), usersPerSecond: Number((userCount / (durationMs / 1000)).toFixed(2)), failures: stageFailures });
    userOffset += userCount;
  }

  console.log(JSON.stringify({
    target: "local Express app + isolated MongoDB database irontrack_loadtest",
    database: mongoose.connection.name,
    syntheticAccounts: totalUsers,
    endpointRequests: requestCount,
    statusCounts,
    endpointLatencyMs: Object.fromEntries([...latencies].map(([name, values]) => [name, summarize(values)])),
    stages,
    sampleFailures: failures.slice(0, 12),
    cleanup: "test database dropped; synthetic records removed",
  }, null, 2));
} finally {
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === "irontrack_loadtest") {
    await Promise.all([AuthSession.deleteMany({}), AuthChallenge.deleteMany({}), WorkoutLog.deleteMany({}), WorkoutProgram.deleteMany({}), WorkoutPlan.deleteMany({}), User.deleteMany({})]);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
