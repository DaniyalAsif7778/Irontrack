import type { RequestHandler } from "express";
import { isDayType } from "../../constant.js";
import { taskPayload } from "../../utils/validation.js";
import { fail } from "../../middlewares/errorHandler.js";
import { routeParam } from "../../utils/routeParam.js";
import * as routine from "../../services/routine/routine.service.js";

const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date);

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
  res.json(result);
};

export const getDay: RequestHandler = async (req, res) => {
  const date = routeParam(req.params.date);
  if (!validDate(date)) { fail(res, "date must be YYYY-MM-DD"); return; }
  const dayType = [0, 6].includes(new Date(`${date}T00:00:00`).getDay()) ? "weekend" : "weekday";
  res.json(await routine.getDay(req.auth!.userId, date, dayType));
};

export const createTask: RequestHandler = async (req, res) => {
  res.status(201).json(await routine.createTask(req.auth!.userId, taskPayload(req.body)));
};

export const updateTask: RequestHandler = async (req, res) => {
  const task = await routine.updateTask(req.auth!.userId, routeParam(req.params.id), taskPayload(req.body, true));
  if (!task) { fail(res, "Task not found", 404); return; }
  res.json(task);
};

export const deleteTask: RequestHandler = async (req, res) => {
  const task = await routine.deleteTask(req.auth!.userId, routeParam(req.params.id));
  if (!task) { fail(res, "Task not found", 404); return; }
  res.status(204).end();
};

export const setCompletion: RequestHandler = async (req, res) => {
  const date = routeParam(req.params.date);
  if (!validDate(date) || typeof req.body.completed !== "boolean") { fail(res, "Provide a valid date and completed boolean"); return; }
  const completion = await routine.setCompletion(req.auth!.userId, routeParam(req.params.id), date, req.body.completed);
  if (!completion) { fail(res, "Task not found", 404); return; }
  res.json(completion);
};
