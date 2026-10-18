import type { RequestHandler } from "express";
import { weightPayload } from "../../utils/validation.js";
import { fail } from "../../middlewares/errorHandler.js";
import { routeParam } from "../../utils/routeParam.js";
import * as weights from "../../services/weight/weight.service.js";

export const list: RequestHandler = async (req, res) => { res.json(await weights.listWeights(req.auth!.userId)); };
export const create: RequestHandler = async (req, res) => { res.status(201).json(await weights.saveWeight(req.auth!.userId, weightPayload(req.body))); };
export const update: RequestHandler = async (req, res) => {
  const value = await weights.updateWeight(req.auth!.userId, routeParam(req.params.id), weightPayload(req.body));
  if (!value) { fail(res, "Weight log not found", 404); return; }
  res.json(value);
};
export const remove: RequestHandler = async (req, res) => {
  if (!await weights.deleteWeight(req.auth!.userId, routeParam(req.params.id))) { fail(res, "Weight log not found", 404); return; }
  res.status(204).end();
};
