import type { RequestHandler } from "express";
import { weightPayload } from "../../utils/validation.js";
import { fail } from "../../middlewares/errorHandler.js";
import { routeParam } from "../../utils/routeParam.js";
import * as weights from "../../services/weight/weight.service.js";

export const list: RequestHandler = async (req, res) => { res.json(await weights.listWeights(req.auth!.userId)); };
function parseWeight(input: unknown) {
  try { return { value: weightPayload(input), error: "" }; }
  catch (error) { return { value: null, error: error instanceof Error ? error.message : "Check the weight entry" }; }
}
export const create: RequestHandler = async (req, res) => {
  const parsed = parseWeight(req.body);
  if (!parsed.value) { fail(res, parsed.error); return; }
  res.status(201).json(await weights.saveWeight(req.auth!.userId, parsed.value));
};
export const update: RequestHandler = async (req, res) => {
  const parsed = parseWeight(req.body);
  if (!parsed.value) { fail(res, parsed.error); return; }
  const value = await weights.updateWeight(req.auth!.userId, routeParam(req.params.id), parsed.value);
  if (!value) { fail(res, "Weight log not found", 404); return; }
  res.json(value);
};
export const remove: RequestHandler = async (req, res) => {
  if (!await weights.deleteWeight(req.auth!.userId, routeParam(req.params.id))) { fail(res, "Weight log not found", 404); return; }
  res.status(204).end();
};
