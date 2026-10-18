import type { RequestHandler } from "express";
import { fail } from "../../middlewares/errorHandler.js";
import { getAnalytics } from "../../services/analytics/analytics.service.js";

export const read: RequestHandler = async (req, res) => {
  const days = Number(req.query.days ?? 7);
  if (![7, 14, 30].includes(days)) { fail(res, "days must be 7, 14, or 30"); return; }
  const today = String(req.query.today ?? new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(`${today}T12:00:00Z`))) { fail(res, "today must be a valid YYYY-MM-DD date"); return; }
  res.json(await getAnalytics(req.auth!.userId, days, today));
};
