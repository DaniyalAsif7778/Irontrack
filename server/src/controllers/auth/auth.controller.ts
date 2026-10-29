import type { RequestHandler } from "express";
import { accountSettingsSchema, emailSchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema } from "../../utils/authValidation.js";
import { authenticateAccount, getAccount, registerAccount, requestPasswordReset, resetPassword, sendVerificationForEmail, updateAccount, verifyEmail } from "../../services/auth/auth.service.js";
import { fail } from "../../middlewares/errorHandler.js";
import { requireAuth, REFRESH_COOKIE, refreshCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "../../middlewares/requireAuth.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { issueSession, listSessions, revokeSession, revokeSessionById, rotateSession } from "../../services/auth/session.service.js";
import { isAuthEmailConfigured } from "../../services/auth/email.service.js";

function setSessionCookies(res: Parameters<RequestHandler>[1], tokens: Awaited<ReturnType<typeof issueSession>>) {
  res.cookie(SESSION_COOKIE, tokens.accessToken, sessionCookieOptions);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
}

function clearSessionCookies(res: Parameters<RequestHandler>[1]) {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
}

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, parsed.error.issues[0]?.message ?? "Check the account details"); return; }
  if (!isAuthEmailConfigured()) { fail(res, "Email verification is temporarily unavailable.", 503); return; }
  const startedAt = Date.now();
  try {
    const user = await registerAccount(parsed.data);
    await sendVerificationForEmail(user.email);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      await sendVerificationForEmail(parsed.data.email);
    } else {
      throw error;
    }
  }
  await authResponseFloor(startedAt);
  res.status(202).json({ message: "If this address can receive mail, a verification link is on its way." });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Enter a valid email and password"); return; }
  const user = await authenticateAccount(parsed.data.email, parsed.data.password);
  if (!user) { fail(res, "Email, password, or verification status is incorrect", 401); return; }
  setSessionCookies(res, await issueSession(user.id, requestMetadata(req)));
  res.json({ user });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  const tokens = refreshToken ? await rotateSession(refreshToken, requestMetadata(req)) : null;
  if (!tokens) {
    fail(res, "Your session expired. Sign in again.", 401);
    return;
  }
  setSessionCookies(res, tokens);
  res.status(204).end();
});

export const verifyEmailAddress: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "This verification link is invalid or expired", 400); return; }
  if (!await verifyEmail(parsed.data.token)) { fail(res, "This verification link is invalid or expired", 400); return; }
  res.json({ message: "Email verified. You can now sign in." });
});

export const resendVerification: RequestHandler = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Enter a valid email address"); return; }
  if (!isAuthEmailConfigured()) { fail(res, "Email delivery is temporarily unavailable.", 503); return; }
  await sendVerificationForEmail(parsed.data.email);
  await authResponseFloor(startedAt);
  res.status(202).json({ message: "If an unverified account exists for this address, a verification link is on its way." });
});

export const forgotPassword: RequestHandler = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Enter a valid email address"); return; }
  if (!isAuthEmailConfigured()) { fail(res, "Email delivery is temporarily unavailable.", 503); return; }
  await requestPasswordReset(parsed.data.email);
  await authResponseFloor(startedAt);
  res.status(202).json({ message: "If an account exists for this address, password reset instructions are on their way." });
});

export const setNewPassword: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, parsed.error.issues[0]?.message ?? "Check the new password"); return; }
  if (!await resetPassword(parsed.data.token, parsed.data.password)) { fail(res, "This reset link is invalid or expired", 400); return; }
  clearSessionCookies(res);
  res.json({ message: "Password updated. Sign in with your new password." });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  await revokeSession(req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  res.status(204).end();
});

export const me: RequestHandler = asyncHandler(async (req, res) => {
  const user = await getAccount(req.auth!.userId);
  if (!user) { clearSessionCookies(res); fail(res, "Account not found", 401); return; }
  res.json({ user });
});

export const updateMe: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = accountSettingsSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, parsed.error.issues[0]?.message ?? "Check your settings"); return; }
  const user = await updateAccount(req.auth!.userId, parsed.data);
  if (!user) { fail(res, "Account not found", 404); return; }
  res.json({ user });
});

export const sessions: RequestHandler = asyncHandler(async (req, res) => {
  res.json({ sessions: await listSessions(req.auth!.userId, req.cookies?.[REFRESH_COOKIE]) });
});

export const revokeSessionEntry: RequestHandler = asyncHandler(async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  const currentToken = req.cookies?.[REFRESH_COOKIE];
  const currentSession = await listSessions(req.auth!.userId, currentToken);
  const selected = currentSession.find(session => session.id === id);
  if (!selected || !await revokeSessionById(req.auth!.userId, id)) { fail(res, "Session not found", 404); return; }
  if (selected.current) clearSessionCookies(res);
  res.status(204).end();
});

function requestMetadata(req: Parameters<RequestHandler>[0]) {
  return { userAgent: req.get("user-agent") ?? "", ipAddress: req.ip ?? "" };
}

async function authResponseFloor(startedAt: number) {
  const delay = 500 - (Date.now() - startedAt);
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

export { requireAuth };
