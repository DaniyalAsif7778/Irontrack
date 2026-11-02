import express from "express";
import type { RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../middlewares/errorHandler.js";
import { authenticatedWriteLimiter, pushTestLimiter } from "../routes/routes.js";

function limitedApp(limiter: RequestHandler) {
  const app = express();
  app.post("/limited", ((req, _res, next) => { req.auth = { userId: "rate-limit-test-account" }; next(); }) as RequestHandler, limiter, (_req, res) => res.sendStatus(204));
  return app;
}

describe("API abuse and error controls", () => {
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
