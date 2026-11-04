import type { ErrorRequestHandler, Response } from "express";
import { logger } from "../utils/logger.js";

export const fail = (res: Response, message: string, status = 400) => res.status(status).json({ error: message });

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error?.name === "CastError") return fail(res, "Invalid record ID");
  if (error?.type === "entity.too.large") return fail(res, "Request body is too large", 413);
  if (error?.type === "entity.parse.failed") return fail(res, "Request body must contain valid JSON", 400);
  if (error?.code === "CORS_ORIGIN_DENIED") return fail(res, "This app origin is not allowed", 403);
  if (error?.statusCode === 503) return fail(res, error.message, 503);
  if (error?.statusCode === 400 || error?.statusCode === 409) return fail(res, error.message, error.statusCode);
  logger.error({
    requestId: res.getHeader("X-Request-Id"),
    method: req.method,
    path: req.path,
    status: 500,
    errorName: typeof error?.name === "string" ? error.name : "UnknownError",
    errorMessage: typeof error?.message === "string" ? error.message.slice(0, 500) : "Unknown error",
    errorCode: error?.code,
  }, "Unhandled API request failed");
  return fail(res, "Unexpected server error", 500);
};
