import "dotenv/config"; // load backend/.env first (real environment variables still win)
import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import traceRoute from "./routes/trace.route.js";
import explainRoute from "./routes/explain.route.js";
import { sandboxStatus } from "./services/health.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.set("trust proxy", config.trustProxy);
app.use(compression());
app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json({ limit: "64kb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/health", async (_req, res) => res.json({ ok: true, ...(await sandboxStatus()) }));
app.use("/api/trace", rateLimit({ windowMs: 60_000, limit: 20 }));
app.use("/api/explain", rateLimit({ windowMs: 60_000, limit: 8 }));
app.use("/api", traceRoute);
app.use("/api", explainRoute);
app.use(errorHandler);

const onListen = () => console.log(`JavaLens API listening on ${config.host ?? "all interfaces"}:${config.port}`);
if (config.host) app.listen(config.port, config.host, onListen);
else app.listen(config.port, onListen);
