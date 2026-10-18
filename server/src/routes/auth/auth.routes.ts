import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import * as auth from "../../controllers/auth/auth.controller.js";
import { isSingleUserMode } from "../../middlewares/requireAuth.js";

const router = Router();
const signInLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false }) as unknown as RequestHandler;

if (!isSingleUserMode()) {
  router.post("/register", signInLimiter, auth.register);
  router.post("/login", signInLimiter, auth.login);
}
router.post("/logout", auth.logout);
router.get("/me", auth.requireAuth, auth.me);
router.patch("/me", auth.requireAuth, auth.updateMe);

export default router;
