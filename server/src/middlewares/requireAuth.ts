import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { fail } from "./errorHandler.js";

export const SESSION_COOKIE = "irontrack_session";
export const SESSION_ISSUER = "irontrack-api";
export const SESSION_AUDIENCE = "irontrack-client";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function isSingleUserMode() {
  return process.env.SINGLE_USER_MODE === "true" && process.env.NODE_ENV !== "production";
}

export function signSession(userId: string) {
  return jwt.sign({}, sessionSecret(), {
    subject: userId,
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
    expiresIn: "7d",
  });
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
  path: "/api",
  maxAge: SESSION_MAX_AGE,
};

export const requireAuth: RequestHandler = (req, res, next) => {
  if (isSingleUserMode()) {
    const userId = process.env.SINGLE_USER_ID;
    if (!userId) { fail(res, "Single-user profile has not been initialized", 503); return; }
    req.auth = { userId };
    next();
    return;
  }
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) { fail(res, "Sign in to continue", 401); return; }
  try {
    const payload = jwt.verify(token, sessionSecret(), { issuer: SESSION_ISSUER, audience: SESSION_AUDIENCE }) as JwtPayload;
    if (!payload.sub) { fail(res, "Sign in to continue", 401); return; }
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
