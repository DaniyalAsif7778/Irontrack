import type { RequestHandler } from "express";
import { accountSettingsSchema, loginSchema, registerSchema } from "../../utils/authValidation.js";
import { authenticateAccount, getAccount, registerAccount, updateAccount } from "../../services/auth/auth.service.js";
import { fail } from "../../middlewares/errorHandler.js";
import { isSingleUserMode, requireAuth, REFRESH_COOKIE, refreshCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "../../middlewares/requireAuth.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { issueSession, revokeSession, rotateSession } from "../../services/auth/session.service.js";

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
  try {
    const user = await registerAccount(parsed.data);
    setSessionCookies(res, await issueSession(user.id));
    res.status(201).json({ user });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      fail(res, "An account with that email already exists", 409);
      return;
    }
    throw error;
  }
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Enter a valid email and password"); return; }
  const user = await authenticateAccount(parsed.data.email, parsed.data.password);
  if (!user) { fail(res, "Email or password is incorrect", 401); return; }
  setSessionCookies(res, await issueSession(user.id));
  res.json({ user: isSingleUserMode() ? { ...user, singleUser: true } : user });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  const tokens = refreshToken ? await rotateSession(refreshToken) : null;
  if (!tokens) {
    fail(res, "Your session expired. Sign in again.", 401);
    return;
  }
  setSessionCookies(res, tokens);
  res.status(204).end();
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  await revokeSession(req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  res.status(204).end();
});

export const me: RequestHandler = asyncHandler(async (req, res) => {
  const user = await getAccount(req.auth!.userId);
  if (!user) { clearSessionCookies(res); fail(res, "Account not found", 401); return; }
  res.json({ user: isSingleUserMode() ? { ...user, singleUser: true } : user });
});

export const updateMe: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = accountSettingsSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, parsed.error.issues[0]?.message ?? "Check your settings"); return; }
  const user = await updateAccount(req.auth!.userId, parsed.data);
  if (!user) { fail(res, "Account not found", 404); return; }
  res.json({ user: isSingleUserMode() ? { ...user, singleUser: true } : user });
});

export { requireAuth };
