import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { requireAuth, signRefreshSession, SESSION_COOKIE, signSession } from "../middlewares/requireAuth.js";
import { User } from "../models/auth/user.model.js";
import apiRoutes from "../routes/routes.js";
import { deleteAccount } from "../services/auth/auth.service.js";
import { accountSettingsSchema, deleteAccountSchema, loginSchema, registerSchema } from "../utils/authValidation.js";

const mocks = vi.hoisted(() => ({
  isAuthEmailConfigured: vi.fn(),
  registerAccount: vi.fn(),
  sendVerificationForEmail: vi.fn(),
  verifyEmail: vi.fn(),
  getAccount: vi.fn(),
}));

vi.mock("../models/auth/user.model.js", () => ({ User: { exists: vi.fn().mockResolvedValue(true) }, toPublicUser: vi.fn() }));
vi.mock("../services/auth/auth.service.js", async () => {
  const actual = await vi.importActual<typeof import("../services/auth/auth.service.js")>("../services/auth/auth.service.js");
  return {
    ...actual,
    deleteAccount: vi.fn(),
    registerAccount: mocks.registerAccount,
    sendVerificationForEmail: mocks.sendVerificationForEmail,
    verifyEmail: mocks.verifyEmail,
    getAccount: mocks.getAccount,
  };
});
vi.mock("../services/auth/email.service.js", () => ({ isAuthEmailConfigured: mocks.isAuthEmailConfigured, deliverAuthEmail: vi.fn() }));

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-bytes";
  mocks.isAuthEmailConfigured.mockReturnValue(true);
});

describe("account validation", () => {
  it("normalizes email and requires strong passwords for new accounts", () => {
    expect(registerSchema.parse({ name: "  Daniyal ", email: " USER@Example.com ", password: "long-enough-password" })).toMatchObject({
      name: "Daniyal", email: "user@example.com",
    });
    expect(registerSchema.safeParse({ name: "Daniyal", email: "user@example.com", password: "short-password" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Daniyal", email: "user@example.com", password: "é".repeat(40) }).success).toBe(false);
  });

  it("allows an existing shorter password through login validation", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "short" }).success).toBe(true);
  });

  it("bounds account preference updates and rejects unknown keys", () => {
    expect(accountSettingsSchema.safeParse({ preferences: { weightUnit: "lb", focusMinutes: 50, breakMinutes: 10 } }).success).toBe(true);
    expect(accountSettingsSchema.safeParse({ preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "05:10", dhuhr: "12:30", asr: "", maghrib: "18:25", isha: "20:10" } } }).success).toBe(true);
    expect(accountSettingsSchema.safeParse({ preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "25:70", dhuhr: "", asr: "", maghrib: "", isha: "" } } }).success).toBe(false);
    expect(accountSettingsSchema.safeParse({ preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "05:10", dhuhr: "04:30", asr: "15:45", maghrib: "18:20", isha: "20:10" } } }).success).toBe(false);
    expect(accountSettingsSchema.safeParse({ preferences: { weightUnit: "lb", focusMinutes: 2, breakMinutes: 10 } }).success).toBe(false);
    expect(accountSettingsSchema.safeParse({ email: "other@example.com" }).success).toBe(false);
  });

  it("requires a current password and the exact deletion confirmation", () => {
    expect(deleteAccountSchema.safeParse({ password: "current-password", confirmation: "DELETE" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ password: "current-password", confirmation: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ password: "", confirmation: "DELETE" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ password: "current-password", confirmation: "DELETE", extra: true }).success).toBe(false);
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

  it("immediately invalidates access tokens after the account is gone", async () => {
    vi.mocked(User.exists).mockResolvedValueOnce(null);
    const token = signSession("507f1f77bcf86cd799439011");
    const response = await request(app).get("/protected").set("Cookie", `${SESSION_COOKIE}=${token}`).expect(401);
    expect(response.headers["set-cookie"]).toHaveLength(2);
  });

  it("rejects malformed, expired, and refresh tokens as access cookies", async () => {
    await request(app).get("/protected").set("Cookie", `${SESSION_COOKIE}=not-a-jwt`).expect(401);
    const expired = jwt.sign({ tokenType: "access" }, process.env.AUTH_JWT_SECRET!, {
      subject: "507f1f77bcf86cd799439011", issuer: "irontrack-api", audience: "irontrack-client", expiresIn: -1,
    });
    await request(app).get("/protected").set("Cookie", `${SESSION_COOKIE}=${expired}`).expect(401);
    const refreshToken = signRefreshSession("507f1f77bcf86cd799439011", "refresh-id");
    await request(app).get("/protected").set("Cookie", `${SESSION_COOKIE}=${refreshToken}`).expect(401);
  });
});

describe("API authentication boundary", () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser() as unknown as express.RequestHandler);
  app.use(express.json());
  app.use("/api", apiRoutes);

  it("allows public auth endpoints but blocks private data routes", async () => {
    await request(app).get("/api/auth/me").expect(401);
    await request(app).patch("/api/auth/me").send({ name: "Updated" }).expect(401);
    await request(app).delete("/api/auth/me").send({ password: "current-password", confirmation: "DELETE" }).expect(401);
    await request(app).get("/api/weight-logs").expect(401);
    await request(app).get("/api/workout-plans").expect(401);
  });

  it("returns a signed-out session without a follow-up refresh request", async () => {
    const response = await request(app).get("/api/auth/session").expect(200);
    expect(response.body).toEqual({ user: null });
    expect(mocks.getAccount).not.toHaveBeenCalled();
  });

  it("returns a clean unauthorized response when the refresh cookie is missing", async () => {
    await request(app).post("/api/auth/refresh").expect(401);
  });

  it("limits verification resend attempts by source IP", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => request(app)
      .post("/api/auth/resend-verification")
      .set("X-Forwarded-For", "198.51.100.61")
      .send({ email: "invalid" })));
    expect(results.filter(result => result.status === 400)).toHaveLength(5);
    expect(results.filter(result => result.status === 429)).toHaveLength(1);
  });

  it("registers an account by sending verification and grants no session before verification", async () => {
    mocks.registerAccount.mockResolvedValue({ id: "user-1", name: "Athlete", email: "athlete@example.com" });
    mocks.sendVerificationForEmail.mockResolvedValue(undefined);
    const response = await request(app).post("/api/auth/register")
      .send({ name: "Athlete", email: "athlete@example.com", password: "long-enough-password" })
      .expect(202);
    expect(response.body.message).toMatch(/verification link/i);
    expect(mocks.registerAccount).toHaveBeenCalledWith({ name: "Athlete", email: "athlete@example.com", password: "long-enough-password" });
    expect(mocks.sendVerificationForEmail).toHaveBeenCalledWith("athlete@example.com");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("accepts a valid email verification link through the API", async () => {
    mocks.verifyEmail.mockResolvedValue(true);
    const response = await request(app).post("/api/auth/verify-email").send({ token: "valid-one-time-verification-token-123456" }).expect(200);
    expect(response.body.message).toMatch(/email verified/i);
    expect(mocks.verifyEmail).toHaveBeenCalledWith("valid-one-time-verification-token-123456");
  });

  it("returns the authenticated account in the /auth/me response envelope", async () => {
    const user = {
      id: "507f1f77bcf86cd799439011", name: "Athlete", email: "athlete@example.com",
      preferences: { weightUnit: "kg", focusMinutes: 45, breakMinutes: 15, prayerTimes: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" } },
    };
    mocks.getAccount.mockResolvedValue(user);
    const response = await request(app).get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=${signSession(user.id)}`)
      .expect(200);
    expect(response.body).toEqual({ user });
  });

  it("requires authentication and deliberate confirmation, then clears cookies after deletion", async () => {
    const cookie = `${SESSION_COOKIE}=${signSession("507f1f77bcf86cd799439011")}`;
    vi.mocked(deleteAccount).mockResolvedValue("invalid_password");
    await request(app).delete("/api/auth/me")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", "203.0.113.1")
      .send({ password: "current-password", confirmation: "delete" })
      .expect(400);
    expect(deleteAccount).not.toHaveBeenCalled();

    await request(app).delete("/api/auth/me")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", "203.0.113.1")
      .send({ password: "wrong-password", confirmation: "DELETE" })
      .expect(401);
    expect(deleteAccount).toHaveBeenLastCalledWith("507f1f77bcf86cd799439011", "wrong-password");

    vi.mocked(deleteAccount).mockResolvedValue("deleted");
    const response = await request(app).delete("/api/auth/me")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", "203.0.113.1")
      .send({ password: "current-password", confirmation: "DELETE" })
      .expect(204);
    expect(response.headers["set-cookie"]).toHaveLength(2);
  });
});
