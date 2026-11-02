import type { RequestHandler } from "express";
import { fail } from "../../middlewares/errorHandler.js";
import { getAnalytics } from "../../services/analytics/analytics.service.js";
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "../../utils/analyticsPeriod.js";
import { isValidDateKey } from "../../utils/dateValidation.js";

export const read: RequestHandler = async (req, res) => {
  const period = String(req.query.period ?? "7d");
  if (!ANALYTICS_PERIODS.includes(period as AnalyticsPeriod)) { fail(res, "Choose a supported analytics period"); return; }
  const today = String(req.query.today ?? new Date().toISOString().slice(0, 10));
  if (!isValidDateKey(today)) { fail(res, "today must be a valid YYYY-MM-DD date"); return; }
  res.json(await getAnalytics(req.auth!.userId, period as AnalyticsPeriod, today));
};
