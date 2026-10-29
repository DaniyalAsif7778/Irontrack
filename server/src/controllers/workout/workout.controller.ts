import type { RequestHandler } from "express";
import { workoutLogPayload, workoutPlanDataPayload, workoutWeekPayload } from "../../utils/workoutValidation.js";
import { fail } from "../../middlewares/errorHandler.js";
import { routeParam } from "../../utils/routeParam.js";
import * as workout from "../../services/workout/workout.service.js";

export const listPlans: RequestHandler = async (req, res) => { res.json(await workout.listPlans(req.auth!.userId)); };
export const savePlan: RequestHandler = async (req, res) => {
  const planId = routeParam(req.params.dayType);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(planId)) { fail(res, "Invalid workout day ID"); return; }
  let data: ReturnType<typeof workoutPlanDataPayload>;
  try { data = workoutPlanDataPayload(req.body); }
  catch (error) { fail(res, error instanceof Error ? error.message : "Check the workout day"); return; }
  const plans = await workout.listPlans(req.auth!.userId);
  if (!plans.some(plan => plan.id === planId) && plans.length >= 20) { fail(res, "You can save up to 20 workout days"); return; }
  res.json(await workout.savePlan(req.auth!.userId, planId, data.name, data.exercises));
};
export const removePlan: RequestHandler = async (req, res) => {
  const planId = routeParam(req.params.dayType);
  if (!await workout.deletePlan(req.auth!.userId, planId)) { fail(res, "Workout day not found", 404); return; }
  res.status(204).end();
};
export const getWeek: RequestHandler = async (req, res) => { res.json(await workout.listWeek(req.auth!.userId)); };
export const putWeek: RequestHandler = async (req, res) => {
  const ownerId = req.auth!.userId;
  const plans = await workout.listPlans(ownerId);
  try {
    const { days } = workoutWeekPayload(req.body, plans.map(plan => plan.id));
    res.json(await workout.saveWeek(ownerId, days));
  } catch (error) {
    fail(res, error instanceof Error ? error.message : "Check the weekly schedule");
  }
};
export const listLogs: RequestHandler = async (req, res) => { res.json(await workout.listLogs(req.auth!.userId, req.query.limit)); };
export const saveLog: RequestHandler = async (req, res) => {
  let data: ReturnType<typeof workoutLogPayload>;
  try { data = workoutLogPayload(req.body); }
  catch (error) { fail(res, error instanceof Error ? error.message : "Check the workout log"); return; }
  if (!data.totalSets) { fail(res, "Complete at least one set before saving the workout"); return; }
  if (!await workout.ownerHasPlan(req.auth!.userId, data.dayType)) { fail(res, "Workout day not found", 404); return; }
  const saved = await workout.saveLog(req.auth!.userId, data);
  if (!saved) { fail(res, "This workout is already complete for that day", 409); return; }
  res.status(201).json(saved);
};
