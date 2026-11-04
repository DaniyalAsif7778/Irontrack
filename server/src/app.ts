import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type RequestHandler } from "express";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import apiRoutes from "./routes/routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

export const app = express();
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false);

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }) as unknown as RequestHandler;
const normalizeOrigin = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
};
const allowedOrigins = ["https://irontrack-nu.vercel.app", ...(process.env.CLIENT_ORIGIN ?? "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean)];
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174");
}

app.use(helmet());
app.use((_req, res, next) => {
  res.setHeader("X-Request-Id", randomUUID());
  next();
});
app.use(cors({
  credentials: true,
  exposedHeaders: ["X-Request-Id"],
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(Object.assign(new Error("Origin is not allowed by CORS"), { statusCode: 403, code: "CORS_ORIGIN_DENIED" }));
  },
}));
app.use(cookieParser() as unknown as RequestHandler);
app.use(express.json({ limit: "1mb" }));
app.use(mongoSanitize() as unknown as RequestHandler);
morgan.token("request-id", (_req, res) => String(res.getHeader("X-Request-Id") ?? "-"));
morgan.token("safe-path", req => (req.url ?? "/").split("?", 1)[0]);
const requestLogFormat = ":method :safe-path :status :response-time ms requestId=:request-id";
app.use(morgan(requestLogFormat, {
  stream: { write: message => logger.info(message.trim()) },
}));
app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
app.get("/api/health", (_req, res) => {
  const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const status = database === "connected" ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({ status, database });
});
app.use("/api", apiLimiter, (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: "Something went wrong. Please try again later." });
    return;
  }
  next();
}, apiRoutes);
app.use(errorHandler);
