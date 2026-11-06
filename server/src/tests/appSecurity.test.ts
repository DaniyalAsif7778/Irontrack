import express from "express";
import type { RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../middlewares/errorHandler.js";
import { authenticatedWriteLimiter, pushTestLimiter } from "../routes/routes.js";
import { app } from "../app.js";

function limitedApp(limiter: RequestHandler) {
  const app = express();
  app.post("/limited", ((req, _res, next) => { req.auth = { userId: "rate-limit-test-account" }; next(); }) as RequestHandler, limiter, (_req, res) => res.sendStatus(204));
  return app;
}

describe("API abuse and error controls", () => {
  it("allows the production app origin and rejects unknown origins without a server error", async () => {
    const allowed = await request(app)
      .options("/api/workout-plans")
      .set("Origin", "https://irontrack-nu.vercel.app")
      .set("Access-Control-Request-Method", "PUT")
      .set("Access-Control-Request-Headers", "content-type")
      .expect(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://irontrack-nu.vercel.app");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example")
      .expect(403);
    expect(denied.body).toEqual({ error: "This app origin is not allowed" });
  });

  it("requires configured origin or referer for cookie-authenticated mutations", async () => {
    const missingOrigin = await request(app)
      .post("/api/workout-program")
      .set("Cookie", "irontrack_session=opaque-session")
      .expect(403);
    expect(missingOrigin.body).toEqual({ error: "This app origin is not allowed" });

    await request(app)
      .post("/api/workout-program")
      .set("Origin", "https://irontrack-nu.vercel.app")
      .expect(503); // The origin guard passed; this test app intentionally has no database connection.
  });

  it("returns a fast generic 503 for API requests while MongoDB is disconnected", async () => {
    const started = performance.now();
    const [health, api, signedOutSession] = await Promise.all([
      request(app).get("/api/health").expect(503),
      request(app).get("/api/notifications/config").expect(503),
      request(app).get("/api/auth/session").expect(200),
    ]);
    expect(health.body).toEqual({ status: "degraded", database: "disconnected" });
    expect(api.body).toEqual({ error: "Something went wrong. Please try again later." });
    expect(signedOutSession.body).toEqual({ user: null });
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("limits authenticated writes per account", async () => {
    const app = limitedApp(authenticatedWriteLimiter as unknown as RequestHandler);
    const results = await Promise.all(Array.from({ length: 41 }, () => request(app).post("/limited")));
    expect(results.filter(result => result.status === 204)).toHaveLength(40);
    expect(results.filter(result => result.status === 429)).toHaveLength(1);
  });

  it("limits expensive push-test requests to three per account per window", async () => {
    const app = limitedApp(pushTestLimiter as unknown as RequestHandler);
    const results = await Promise.all(Array.from({ length: 4 }, () => request(app).post("/limited")));
    expect(results.filter(result => result.status === 204)).toHaveLength(3);
    expect(results.filter(result => result.status === 429)).toHaveLength(1);
  });

  it("returns generic internal errors and bounded JSON body errors", async () => {
    const app = express();
    app.use(express.json({ limit: "1kb" }));
    app.get("/failure", (_req, _res, next) => next(new Error("internal database detail")));
    app.post("/large", (_req, res) => res.sendStatus(204));
    app.use(errorHandler);

    const failed = await request(app).get("/failure").expect(500);
    expect(failed.body).toEqual({ error: "Unexpected server error" });
    const tooLarge = await request(app).post("/large").send({ value: "x".repeat(2048) }).expect(413);
    expect(tooLarge.body).toEqual({ error: "Request body is too large" });
    const malformed = await request(app).post("/large").set("Content-Type", "application/json").send("{broken").expect(400);
    expect(malformed.body).toEqual({ error: "Request body must contain valid JSON" });
  });
});
