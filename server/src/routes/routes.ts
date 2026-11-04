import { Router, type RequestHandler } from "express";
import { read as readAnalytics } from "../controllers/analytics/analytics.controller.js";
import * as routine from "../controllers/routine/routine.controller.js";
import * as weights from "../controllers/weight/weight.controller.js";
import * as workout from "../controllers/workout/workout.controller.js";
import * as wellness from "../controllers/wellness/wellness.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import authRoutes from "./auth/auth.routes.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import * as notifications from "../controllers/notifications/notifications.controller.js";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const router = Router();

router.use("/auth", authRoutes);
export const authenticatedWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: req => ["GET", "HEAD", "OPTIONS"].includes(req.method),
  keyGenerator: req => req.auth?.userId ? `account:${req.auth.userId}` : ipKeyGenerator(req.ip ?? "unknown"),
}) as unknown as RequestHandler;
export const pushTestLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: req => req.auth?.userId ? `account:${req.auth.userId}` : ipKeyGenerator(req.ip ?? "unknown"),
}) as unknown as RequestHandler;
router.use(requireAuth, authenticatedWriteLimiter);


router.get("/notifications/config", notifications.config);
router.get("/notifications/status", asyncHandler(notifications.status));
router.post("/notifications/subscriptions", asyncHandler(notifications.subscribe));
router.put("/notifications/preferences", asyncHandler(notifications.updatePreferences));
router.delete("/notifications/subscriptions", asyncHandler(notifications.unsubscribe));
router.post("/notifications/test", pushTestLimiter, asyncHandler(notifications.test));

router.get("/routine/schedules/:dayType", asyncHandler(routine.getSchedule));
router.post("/routine/schedules/copy", asyncHandler(routine.copySchedule));
router.get("/routine/days/:date", asyncHandler(routine.getDay));
router.post("/routine/tasks", asyncHandler(routine.createTask));
router.patch("/routine/tasks/:id", asyncHandler(routine.updateTask));
router.delete("/routine/tasks/:id", asyncHandler(routine.deleteTask));
router.put("/routine/tasks/:id/completion/:date", asyncHandler(routine.setCompletion));
router.post("/routine/tasks/:id/occurrences/:date/start", asyncHandler(routine.startTask));
router.post("/routine/tasks/:id/occurrences/:date/queue", asyncHandler(routine.queueTask));
router.post("/routine/tasks/:id/occurrences/:date/extend", asyncHandler(routine.extendTask));
router.post("/routine/tasks/:id/occurrences/:date/snooze", asyncHandler(routine.snoozeTask));
router.get("/routine/events/analytics", asyncHandler(routine.eventAnalytics));

router.get("/weight-logs", asyncHandler(weights.list));
router.post("/weight-logs", asyncHandler(weights.create));
router.patch("/weight-logs/:id", asyncHandler(weights.update));
router.delete("/weight-logs/:id", asyncHandler(weights.remove));

router.get("/workout-plans", asyncHandler(workout.listPlans));
router.get("/exercise-library", asyncHandler(workout.listExerciseLibrary));
router.put("/workout-program", asyncHandler(workout.saveProgram));
router.put("/workout-plans/:dayType/exercises/:exerciseId", asyncHandler(workout.savePlanExercise));
router.put("/workout-plans/:dayType", asyncHandler(workout.savePlan));
router.delete("/workout-plans/:dayType", asyncHandler(workout.removePlan));
router.put("/workout-week", asyncHandler(workout.putWeek));
router.get("/workout-logs", asyncHandler(workout.listLogs));
router.post("/workout-logs", asyncHandler(workout.saveLog));
router.get("/workout-week", asyncHandler(workout.getWeek));

router.get("/analytics", asyncHandler(readAnalytics));
router.get("/wellness", asyncHandler(wellness.list));
router.put("/wellness/:date", asyncHandler(wellness.save));

export default router;
