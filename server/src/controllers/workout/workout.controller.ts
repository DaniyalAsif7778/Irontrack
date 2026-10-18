import type { RequestHandler } from "express";
import { WORKOUT_DAYS } from "../../models/workout/workout.model.js";
import { workoutLogPayload, workoutPlanPayload } from "../../utils/workoutValidation.js";
import { fail } from "../../middlewares/errorHandler.js";
import { routeParam } from "../../utils/routeParam.js";
import * as workout from "../../services/workout/workout.service.js";

export const listPlans: RequestHandler = async (req, res) => { res.json(await workout.listPlans(req.auth!.userId)); };
export const savePlan: RequestHandler = async (req, res) => {
  const dayType = routeParam(req.params.dayType);
  if (!WORKOUT_DAYS.includes(dayType as typeof WORKOUT_DAYS[number])) { fail(res, "Invalid workout day"); return; }
  res.json(await workout.savePlan(req.auth!.userId, dayType, workoutPlanPayload(req.body)));
};
export const listLogs: RequestHandler = async (req, res) => { res.json(await workout.listLogs(req.auth!.userId, req.query.limit)); };
export const saveLog: RequestHandler = async (req, res) => {
  const data = workoutLogPayload(req.body);
  if (!data.totalSets) { fail(res, "Complete at least one set before saving the workout"); return; }
  const saved = await workout.saveLog(req.auth!.userId, data);
  if (!saved) { fail(res, "This workout is already complete for that day", 409); return; }
  res.status(201).json(saved);
};
export const getWeek: RequestHandler = (_req, res) => { res.json(workout.workoutWeek); };
