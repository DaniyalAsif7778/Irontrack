import type { RequestHandler } from "express";
import { z } from "zod";
import { fail } from "../../middlewares/errorHandler.js";
import { routeParam } from "../../utils/routeParam.js";
import * as wellness from "../../services/wellness/wellness.service.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const wellnessSchema = z.object({ waterGlasses: z.number().int().min(0).max(100), movementBreaks: z.number().int().min(0).max(100) }).strict();

export const list: RequestHandler = async (req, res) => {
  const days = Number(req.query.days ?? 7);
  const through = String(req.query.through ?? "");
  if (![7, 14, 30].includes(days) || !datePattern.test(through)) { fail(res, "Use a valid through date and 7, 14, or 30 days"); return; }
  res.json(await wellness.listWellness(req.auth!.userId, through, days));
};

export const save: RequestHandler = async (req, res) => {
  const date = routeParam(req.params.date);
  if (!datePattern.test(date)) { fail(res, "date must be YYYY-MM-DD"); return; }
  const parsed = wellnessSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, parsed.error.issues[0]?.message ?? "Check the wellness values"); return; }
  res.json(await wellness.saveWellness(req.auth!.userId, date, parsed.data));
};
