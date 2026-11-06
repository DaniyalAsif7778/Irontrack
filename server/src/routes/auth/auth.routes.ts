import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import * as auth from "../../controllers/auth/auth.controller.js";
import { REFRESH_COOKIE, SESSION_COOKIE } from "../../middlewares/requireAuth.js";

const router = Router();
const signInLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false }) as unknown as RequestHandler;
const registrationLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }) as unknown as RequestHandler;
const emailLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }) as unknown as RequestHandler;
const tokenLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }) as unknown as RequestHandler;
const accountDeletionLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 3, standardHeaders: "draft-7", legacyHeaders: false }) as unknown as RequestHandler;

router.post("/register", registrationLimiter, auth.register);
router.post("/login", signInLimiter, auth.login);
router.post("/verify-email", tokenLimiter, auth.verifyEmailAddress);
router.post("/resend-verification", emailLimiter, auth.resendVerification);
router.post("/password/forgot", emailLimiter, auth.forgotPassword);
router.post("/password/reset", tokenLimiter, auth.setNewPassword);
router.post("/logout", auth.logout);
router.post("/refresh", auth.refresh);
router.get("/session", (req, res, next) => {
  if (!req.cookies?.[SESSION_COOKIE] && !req.cookies?.[REFRESH_COOKIE]) {
    res.json({ user: null });
    return;
  }
  next();
}, auth.requireAuth, auth.me);
router.get("/me", auth.requireAuth, auth.me);
router.patch("/me", auth.requireAuth, auth.updateMe);
router.delete("/me", accountDeletionLimiter, auth.requireAuth, auth.deleteMe);
router.get("/sessions", auth.requireAuth, auth.sessions);
router.delete("/sessions/:id", auth.requireAuth, auth.revokeSessionEntry);

export default router;
