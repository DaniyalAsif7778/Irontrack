import type { RequestHandler } from "express";
import { accountSettingsSchema, loginSchema, registerSchema } from "../../utils/authValidation.js";
import { authenticateAccount, getAccount, registerAccount, updateAccount } from "../../services/auth/auth.service.js";
import { fail } from "../../middlewares/errorHandler.js";
import { isSingleUserMode, requireAuth, SESSION_COOKIE, sessionCookieOptions, signSession } from "../../middlewares/requireAuth.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, parsed.error.issues[0]?.message ?? "Check the account details"); return; }
  try {
    const user = await registerAccount(parsed.data);
    res.cookie(SESSION_COOKIE, signSession(user.id), sessionCookieOptions);
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
  res.cookie(SESSION_COOKIE, signSession(user.id), sessionCookieOptions);
  res.json({ user: isSingleUserMode() ? { ...user, singleUser: true } : user });
});

export const logout: RequestHandler = (_req, res) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  res.status(204).end();
};

export const me: RequestHandler = asyncHandler(async (req, res) => {
  const user = await getAccount(req.auth!.userId);
  if (!user) { res.clearCookie(SESSION_COOKIE, sessionCookieOptions); fail(res, "Account not found", 401); return; }
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
