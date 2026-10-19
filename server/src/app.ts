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

export const app = express();
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false);

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }) as unknown as RequestHandler;
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174");
}

app.use(helmet());
app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Origin is not allowed by CORS"));
  },
}));
app.use(cookieParser() as unknown as RequestHandler);
app.use(express.json({ limit: "25mb" }));
app.use(mongoSanitize() as unknown as RequestHandler);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
  stream: { write: message => logger.info(message.trim()) },
}));
app.get("/api/health", (_req, res) => {
  const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const status = database === "connected" ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({ status, database });
});
app.use("/api", apiLimiter, apiRoutes);
app.use(errorHandler);
