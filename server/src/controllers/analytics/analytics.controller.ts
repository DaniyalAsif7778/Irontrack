import type { RequestHandler } from "express";
import { fail } from "../../middlewares/errorHandler.js";
import { getAnalytics } from "../../services/analytics/analytics.service.js";

export const read: RequestHandler = async (req, res) => {
  const days = Number(req.query.days ?? 7);
  if (![7, 14, 30].includes(days)) { fail(res, "days must be 7, 14, or 30"); return; }
  res.json(await getAnalytics(req.auth!.userId, days));
};
