import type { ErrorRequestHandler, Response } from "express";
import { logger } from "../utils/logger.js";

export const fail = (res: Response, message: string, status = 400) => res.status(status).json({ error: message });

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.name === "CastError") return fail(res, "Invalid record ID");
  if (error?.type === "entity.too.large") return fail(res, "Request body is too large", 413);
  if (error?.type === "entity.parse.failed") return fail(res, "Request body must contain valid JSON", 400);
  if (error?.statusCode === 503) return fail(res, error.message, 503);
  if (error?.statusCode === 400 || error?.statusCode === 409) return fail(res, error.message, error.statusCode);
  logger.error({ errorName: typeof error?.name === "string" ? error.name : "UnknownError" }, "Unhandled API error");
  return fail(res, "Unexpected server error", 500);
};
