import type { RequestHandler } from "express";
import { z } from "zod";
import { PushSubscription } from "../../models/notifications/notification.model.js";
import { fail } from "../../middlewares/errorHandler.js";
import { pushConfiguration, sendTestPush } from "../../services/notifications/push.service.js";

const prefsSchema = z.object({ taskTimes: z.boolean(), workoutAtNine: z.boolean(), hydration: z.boolean(), movement: z.boolean() }).strict();
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(16).max(256), auth: z.string().min(8).max(256) }).strict(),
  timezone: z.string().min(1).max(100),
  preferences: prefsSchema,
}).strict();

export const config: RequestHandler = (_req, res) => res.json(pushConfiguration());
export const status: RequestHandler = async (req, res) => {
  const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint : "";
  const subscription = await PushSubscription.findOne({ ownerId: req.auth!.userId, ...(endpoint ? { endpoint } : {}) }).lean();
  res.json({ configured: pushConfiguration().enabled, subscribed: Boolean(subscription), preferences: subscription?.preferences ?? null });
};
export const subscribe: RequestHandler = async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, parsed.error.issues[0]?.message ?? "Invalid push subscription"); return; }
  if (!pushConfiguration().enabled) { fail(res, "Background push is not configured on the server", 503); return; }
  const { endpoint, ...data } = parsed.data;
  await PushSubscription.findOneAndUpdate({ endpoint }, { ...data, endpoint, ownerId: req.auth!.userId }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json({ subscribed: true });
};
export const updatePreferences: RequestHandler = async (req, res) => {
  const parsed = z.object({ endpoint: z.string().url().max(2048), preferences: prefsSchema, timezone: z.string().min(1).max(100) }).strict().safeParse(req.body);
  if (!parsed.success) { fail(res, parsed.error.issues[0]?.message ?? "Invalid reminder preferences"); return; }
  const result = await PushSubscription.updateOne({ ownerId: req.auth!.userId, endpoint: parsed.data.endpoint }, { $set: { preferences: parsed.data.preferences, timezone: parsed.data.timezone } });
  res.json({ updated: result.modifiedCount, matched: result.matchedCount });
};
export const unsubscribe: RequestHandler = async (req, res) => {
  const parsed = z.object({ endpoint: z.string().url().max(2048) }).strict().safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid subscription endpoint"); return; }
  await PushSubscription.deleteOne({ ownerId: req.auth!.userId, endpoint: parsed.data.endpoint });
  res.json({ subscribed: false });
};
export const test: RequestHandler = async (req, res) => {
  try { await sendTestPush(req.auth!.userId); res.json({ sent: true }); }
  catch (error) { fail(res, error instanceof Error ? error.message : "Could not send a push notification", 503); }
};
