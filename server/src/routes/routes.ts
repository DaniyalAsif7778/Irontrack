import { Router } from "express";
import { read as readAnalytics } from "../controllers/analytics/analytics.controller.js";
import * as routine from "../controllers/routine/routine.controller.js";
import * as weights from "../controllers/weight/weight.controller.js";
import * as workout from "../controllers/workout/workout.controller.js";
import * as wellness from "../controllers/wellness/wellness.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import authRoutes from "./auth/auth.routes.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.use("/auth", authRoutes);
router.use(requireAuth);

router.get("/routine/schedules/:dayType", asyncHandler(routine.getSchedule));
router.post("/routine/schedules/copy", asyncHandler(routine.copySchedule));
router.get("/routine/days/:date", asyncHandler(routine.getDay));
router.post("/routine/tasks", asyncHandler(routine.createTask));
router.patch("/routine/tasks/:id", asyncHandler(routine.updateTask));
router.delete("/routine/tasks/:id", asyncHandler(routine.deleteTask));
router.put("/routine/tasks/:id/completion/:date", asyncHandler(routine.setCompletion));

router.get("/weight-logs", asyncHandler(weights.list));
router.post("/weight-logs", asyncHandler(weights.create));
router.patch("/weight-logs/:id", asyncHandler(weights.update));
router.delete("/weight-logs/:id", asyncHandler(weights.remove));

router.get("/workout-plans", asyncHandler(workout.listPlans));
router.put("/workout-plans/:dayType", asyncHandler(workout.savePlan));
router.get("/workout-logs", asyncHandler(workout.listLogs));
router.post("/workout-logs", asyncHandler(workout.saveLog));
router.get("/workout-week", workout.getWeek);

router.get("/analytics", asyncHandler(readAnalytics));
router.get("/wellness", asyncHandler(wellness.list));
router.put("/wellness/:date", asyncHandler(wellness.save));

export default router;
