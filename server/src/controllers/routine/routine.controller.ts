import type { Request, RequestHandler } from "express";
import { isDayType } from "../../constant.js";
import { taskPayload } from "../../utils/validation.js";
import { User } from "../../models/auth/user.model.js";
import { fail } from "../../middlewares/errorHandler.js";
import { routeParam } from "../../utils/routeParam.js";
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "../../utils/analyticsPeriod.js";
import * as routine from "../../services/routine/routine.service.js";
import { completeRoutineOccurrence, extendRoutineTask, isValidRoutineDate, newActionId, queueRoutineTask, recordRoutineParentChange, RoutineActionError, routineEventAnalytics, snoozeRoutineTask, startRoutineTask } from "../../services/routine/routine-events.service.js";

const validDate = (date: string) => isValidRoutineDate(date);

export const getSchedule: RequestHandler = async (req, res) => {
  const dayType = routeParam(req.params.dayType);
  if (!isDayType(dayType)) { fail(res, "Invalid day type"); return; }
  res.json(await routine.listSchedule(req.auth!.userId, dayType));
};

export const copySchedule: RequestHandler = async (req, res) => {
  const { sourceDayType, targetDayType } = req.body;
  if (!isDayType(sourceDayType) || !isDayType(targetDayType) || sourceDayType === targetDayType) { fail(res, "Provide two different valid schedule types"); return; }
  const result = await routine.copySchedule(req.auth!.userId, sourceDayType, targetDayType);
  if (!result) { fail(res, "The source schedule has no tasks"); return; }
  await recordRoutineParentChange(req.auth!.userId, null, newActionId(req.body?.actionId), "schedule_copied", "Routine schedule copied", `${result.copiedTasks} tasks were copied from ${sourceDayType} to ${targetDayType}.`, result);
  res.json(result);
};

export const getDay: RequestHandler = async (req, res) => {
  const date = routeParam(req.params.date);
  if (!validDate(date)) { fail(res, "date must be YYYY-MM-DD"); return; }
  const dayType = [0, 6].includes(new Date(`${date}T00:00:00`).getDay()) ? "weekend" : "weekday";
  const timezone = typeof req.query.timezone === "string" ? req.query.timezone : "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); }
  catch { fail(res, "timezone must be a valid IANA timezone"); return; }
  res.json(await routine.getDay(req.auth!.userId, date, dayType, timezone));
};

export const createTask: RequestHandler = async (req, res) => {
  const user = await User.findById(req.auth!.userId).select("preferences.prayerTimes").lean();
  if (!user) { fail(res, "Account not found", 401); return; }
  let payload: ReturnType<typeof taskPayload>;
  try { payload = taskPayload(req.body, false, user.preferences?.prayerTimes); }
  catch (error) { fail(res, error instanceof Error ? error.message : "Check the routine task", 400); return; }
  const task = await routine.createTask(req.auth!.userId, payload);
  await recordRoutineParentChange(req.auth!.userId, String(task._id), newActionId(req.body?.actionId), "task_created", "Routine task added", `${task.title} was added to ${task.block}.`, { taskTitle: task.title, block: task.block });
  res.status(201).json(task);
};

export const updateTask: RequestHandler = async (req, res) => {
  const id = routeParam(req.params.id);
  const current = await routine.findTask(req.auth!.userId, id);
  if (!current) { fail(res, "Task not found", 404); return; }
  const user = await User.findById(req.auth!.userId).select("preferences.prayerTimes").lean();
  if (!user) { fail(res, "Account not found", 401); return; }
  let payload: ReturnType<typeof taskPayload>;
  try { payload = taskPayload({ ...req.body, dayType: req.body.dayType ?? current.dayType, block: req.body.block ?? current.block }, true, user.preferences?.prayerTimes); }
  catch (error) { fail(res, error instanceof Error ? error.message : "Check the routine task", 400); return; }
  if (req.body.dayType === undefined) delete payload.dayType;
  if (req.body.block === undefined) delete payload.block;
  const task = await routine.updateTask(req.auth!.userId, id, payload);
  if (!task) { fail(res, "Task not found", 404); return; }
  await recordRoutineParentChange(req.auth!.userId, String(task._id), newActionId(req.body?.actionId), "task_updated", "Routine task updated", `${task.title} was updated successfully.`, { taskTitle: task.title });
  res.json(task);
};

export const deleteTask: RequestHandler = async (req, res) => {
  const task = await routine.deleteTask(req.auth!.userId, routeParam(req.params.id));
  if (!task) { fail(res, "Task not found", 404); return; }
  await recordRoutineParentChange(req.auth!.userId, String(task._id), newActionId(req.body?.actionId), "task_deleted", "Routine task removed", `${task.title} was removed from your routine.`, { taskTitle: task.title });
  res.status(204).end();
};

export const setCompletion: RequestHandler = async (req, res) => {
  const date = routeParam(req.params.date);
  if (!validDate(date) || typeof req.body.completed !== "boolean") { fail(res, "Provide a valid date and completed boolean"); return; }
  const completion = await completeRoutineOccurrence(req.auth!.userId, routeParam(req.params.id), date, req.body.completed, newActionId(req.body.actionId));
  if (!completion) { fail(res, "Task not found", 404); return; }
  res.json(completion);
};

const actionBody = (body: any) => ({ timezone: typeof body?.timezone === "string" ? body.timezone : "UTC", actionId: newActionId(body?.actionId) });
const validTaskDate = (req: Request) => {
  const date = routeParam(req.params.date);
  if (!validDate(date)) throw new RoutineActionError("date must be YYYY-MM-DD", 400);
  return date;
};

export const startTask: RequestHandler = async (req, res) => {
  try { const { timezone, actionId } = actionBody(req.body); res.json(await startRoutineTask(req.auth!.userId, routeParam(req.params.id), validTaskDate(req), timezone, actionId)); }
  catch (error: any) { if (error instanceof RoutineActionError) { fail(res, error.message, error.status); return; } if (error?.code === 11000) { fail(res, "Another task start is already being processed. Refresh the routine and try again.", 409); return; } throw error; }
};
export const queueTask: RequestHandler = async (req, res) => {
  try { const { timezone, actionId } = actionBody(req.body); res.json(await queueRoutineTask(req.auth!.userId, routeParam(req.params.id), validTaskDate(req), timezone, actionId)); }
  catch (error: any) { if (error instanceof RoutineActionError) { fail(res, error.message, error.status); return; } if (error?.code === 11000) { fail(res, "Another queued task is already set. Refresh the routine first.", 409); return; } throw error; }
};
export const extendTask: RequestHandler = async (req, res) => {
  try { const { actionId } = actionBody(req.body); res.json(await extendRoutineTask(req.auth!.userId, routeParam(req.params.id), validTaskDate(req), actionId)); }
  catch (error) { if (error instanceof RoutineActionError) { fail(res, error.message, error.status); return; } throw error; }
};
export const snoozeTask: RequestHandler = async (req, res) => {
  try { const { actionId } = actionBody(req.body); const minutes = Number(req.body?.minutes); res.json(await snoozeRoutineTask(req.auth!.userId, routeParam(req.params.id), validTaskDate(req), minutes, actionId)); }
  catch (error) { if (error instanceof RoutineActionError) { fail(res, error.message, error.status); return; } throw error; }
};
export const eventAnalytics: RequestHandler = async (req, res) => {
  const period = String(req.query.period ?? "30d");
  const page = Number(req.query.page ?? 1);
  const today = String(req.query.today ?? new Date().toISOString().slice(0, 10));
  if (!ANALYTICS_PERIODS.includes(period as AnalyticsPeriod)) { fail(res, "Choose a supported activity period"); return; }
  if (!Number.isInteger(page) || page < 1 || page > 10_000) { fail(res, "page must be a positive integer"); return; }
  if (!isValidRoutineDate(today)) { fail(res, "today must be a valid YYYY-MM-DD date"); return; }
  res.json(await routineEventAnalytics(req.auth!.userId, period as AnalyticsPeriod, page, 10, today));
};
