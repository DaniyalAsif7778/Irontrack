import type { ErrorRequestHandler, Response } from "express";
import { logger } from "../utils/logger.js";

export const fail = (res: Response, message: string, status = 400) => res.status(status).json({ error: message });

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.name === "CastError") return fail(res, "Invalid record ID");
  if (error?.statusCode === 503) return fail(res, error.message, 503);
  logger.error({ err: error }, "Unhandled API error");
  return fail(res, error?.message || "Unexpected server error", 500);
};
