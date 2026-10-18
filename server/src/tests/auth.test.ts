import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { requireAuth, SESSION_COOKIE, signSession } from "../middlewares/requireAuth.js";
import apiRoutes from "../routes/routes.js";
import { accountSettingsSchema, loginSchema, registerSchema } from "../utils/authValidation.js";

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-bytes";
});

describe("account validation", () => {
  it("normalizes email and requires strong passwords for new accounts", () => {
    expect(registerSchema.parse({ name: "  Daniyal ", email: " USER@Example.com ", password: "long-enough-password" })).toMatchObject({
      name: "Daniyal", email: "user@example.com",
    });
    expect(registerSchema.safeParse({ name: "D", email: "nope", password: "short" }).success).toBe(false);
  });

  it("allows an existing shorter password through login validation", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "short" }).success).toBe(true);
  });

  it("bounds account preference updates and rejects unknown keys", () => {
    expect(accountSettingsSchema.safeParse({ preferences: { weightUnit: "lb", focusMinutes: 50, breakMinutes: 10 } }).success).toBe(true);
    expect(accountSettingsSchema.safeParse({ preferences: { weightUnit: "lb", focusMinutes: 2, breakMinutes: 10 } }).success).toBe(false);
    expect(accountSettingsSchema.safeParse({ email: "other@example.com" }).success).toBe(false);
  });
});

describe("account session middleware", () => {
  const app = express();
  app.use(cookieParser() as unknown as express.RequestHandler);
  app.get("/protected", requireAuth, (req, res) => res.json({ userId: req.auth?.userId }));

  it("rejects requests without a session", async () => {
    await request(app).get("/protected").expect(401);
  });

  it("accepts a signed, unexpired session cookie", async () => {
    const token = signSession("507f1f77bcf86cd799439011");
    const response = await request(app).get("/protected").set("Cookie", `${SESSION_COOKIE}=${token}`).expect(200);
    expect(response.body.userId).toBe("507f1f77bcf86cd799439011");
  });
});

describe("API authentication boundary", () => {
  const app = express();
  app.use(cookieParser() as unknown as express.RequestHandler);
  app.use("/api", apiRoutes);

  it("allows public auth endpoints but blocks private data routes", async () => {
    await request(app).get("/api/auth/me").expect(401);
    await request(app).patch("/api/auth/me").send({ name: "Updated" }).expect(401);
    await request(app).get("/api/weight-logs").expect(401);
    await request(app).get("/api/workout-plans").expect(401);
  });
});
