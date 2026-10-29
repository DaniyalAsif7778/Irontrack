import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { fail } from "./errorHandler.js";

export const SESSION_COOKIE = "irontrack_session";
export const REFRESH_COOKIE = "irontrack_refresh";
export const SESSION_ISSUER = "irontrack-api";
export const SESSION_AUDIENCE = "irontrack-client";
export const REFRESH_AUDIENCE = "irontrack-refresh";
export const SESSION_MAX_AGE = 15 * 60 * 1000;
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

export function signSession(userId: string) {
  return jwt.sign({ tokenType: "access" }, sessionSecret(), {
    subject: userId,
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
    expiresIn: "15m",
  });
}

export function signRefreshSession(userId: string, tokenId: string) {
  return jwt.sign({ tokenType: "refresh" }, refreshSecret(), {
    subject: userId,
    jwtid: tokenId,
    issuer: SESSION_ISSUER,
    audience: REFRESH_AUDIENCE,
    expiresIn: "30d",
  });
}

export function verifyRefreshSession(token: string) {
  const payload = jwt.verify(token, refreshSecret(), { issuer: SESSION_ISSUER, audience: REFRESH_AUDIENCE }) as JwtPayload;
  if (payload.tokenType !== "refresh" || !payload.sub || !payload.jti) throw new Error("Invalid refresh token");
  return { userId: payload.sub, tokenId: payload.jti };
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

export const sessionCookieOptions = {
  ...cookieBase,
  path: "/api",
  maxAge: SESSION_MAX_AGE,
};

export const refreshCookieOptions = {
  ...cookieBase,
  path: "/api/auth",
  maxAge: REFRESH_MAX_AGE,
};

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) { fail(res, "Sign in to continue", 401); return; }
  try {
    const payload = jwt.verify(token, sessionSecret(), { issuer: SESSION_ISSUER, audience: SESSION_AUDIENCE }) as JwtPayload;
    if (payload.tokenType !== "access" || !payload.sub) { fail(res, "Sign in to continue", 401); return; }
    req.auth = { userId: payload.sub };
    next();
  } catch {
    fail(res, "Your session has expired. Sign in again.", 401);
  }
};

function sessionSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("AUTH_JWT_SECRET must contain at least 32 bytes.");
  return secret;
}

function refreshSecret() {
  const secret = process.env.AUTH_REFRESH_SECRET || process.env.AUTH_JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("AUTH_REFRESH_SECRET must contain at least 32 bytes.");
  return secret;
}
