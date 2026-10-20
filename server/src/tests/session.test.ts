import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../models/auth/session.model.js", () => ({
  AuthSession: { create: vi.fn(), findOneAndUpdate: vi.fn(), deleteOne: vi.fn() },
}));

import { AuthSession } from "../models/auth/session.model.js";
import { REFRESH_MAX_AGE, signRefreshSession, verifyRefreshSession } from "../middlewares/requireAuth.js";
import { issueSession, revokeSession, rotateSession } from "../services/auth/session.service.js";

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = "test-access-secret-with-more-than-thirty-two-bytes";
  process.env.AUTH_REFRESH_SECRET = "test-refresh-secret-with-more-than-thirty-two-bytes";
  vi.clearAllMocks();
  vi.mocked(AuthSession.create).mockResolvedValue({} as never);
});

describe("rotating cookie sessions", () => {
  it("persists a refresh session and issues a short-lived access token", async () => {
    const tokens = await issueSession("507f1f77bcf86cd799439011");
    expect(AuthSession.create).toHaveBeenCalledOnce();
    expect(AuthSession.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: "507f1f77bcf86cd799439011",
      expiresAt: expect.any(Date),
    }));
    expect(verifyRefreshSession(tokens.refreshToken).userId).toBe("507f1f77bcf86cd799439011");
    const createCalls = (AuthSession.create as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(Date.now() + REFRESH_MAX_AGE - (createCalls[0][0] as { expiresAt: Date }).expiresAt.getTime()).toBeLessThan(1000);
  });

  it("rotates a refresh token once and rejects replay", async () => {
    const original = await issueSession("507f1f77bcf86cd799439011");
    vi.mocked(AuthSession.findOneAndUpdate).mockResolvedValueOnce({} as never).mockResolvedValueOnce(null);

    const rotated = await rotateSession(original.refreshToken);
    expect(rotated).not.toBeNull();
    expect(rotated!.refreshToken).not.toBe(original.refreshToken);
    expect(verifyRefreshSession(rotated!.refreshToken).userId).toBe("507f1f77bcf86cd799439011");
    expect(await rotateSession(original.refreshToken)).toBeNull();
    expect(AuthSession.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "507f1f77bcf86cd799439011", expiresAt: expect.objectContaining({ $gt: expect.any(Date) }) }),
      expect.objectContaining({ $set: expect.objectContaining({ tokenId: expect.any(String), expiresAt: expect.any(Date) }) }),
      { new: true },
    );
  });

  it("rejects malformed, expired, and access tokens as refresh tokens", async () => {
    expect(await rotateSession("not-a-jwt")).toBeNull();
    const expired = signRefreshSession("507f1f77bcf86cd799439011", "expired-id");
    const jwt = await import("jsonwebtoken");
    const expiredToken = jwt.default.sign({ tokenType: "refresh" }, process.env.AUTH_REFRESH_SECRET!, {
      subject: "507f1f77bcf86cd799439011", jwtid: "expired-id", issuer: "irontrack-api", audience: "irontrack-refresh", expiresIn: -1,
    });
    expect(await rotateSession(expiredToken)).toBeNull();
    expect(await rotateSession(expired.replace(/.$/, "x"))).toBeNull();
    expect(AuthSession.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("revokes a valid refresh session and tolerates invalid logout cookies", async () => {
    const tokens = await issueSession("507f1f77bcf86cd799439011");
    await revokeSession(tokens.refreshToken);
    expect(AuthSession.deleteOne).toHaveBeenCalledWith({ ownerId: "507f1f77bcf86cd799439011", tokenId: verifyRefreshSession(tokens.refreshToken).tokenId });
    await expect(revokeSession("bad-cookie")).resolves.toBeUndefined();
    await expect(revokeSession(undefined)).resolves.toBeUndefined();
  });
});
