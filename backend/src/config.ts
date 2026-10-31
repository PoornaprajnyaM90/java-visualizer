import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // In production set HOST=127.0.0.1 so only the reverse proxy (Caddy/nginx) can reach the API.
  host: process.env.HOST,
  // Number of reverse proxies in front of the API (0 = none, 1 = Caddy/nginx). Needed so rate limits are per visitor.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  sandboxImage: process.env.SANDBOX_IMAGE ?? "java-visualizer-sandbox:latest",
  maxConcurrent: Number(process.env.MAX_CONCURRENT ?? 4),
  wallTimeoutMs: 20_000,
  maxSteps: 2500,
  schemaPath: process.env.SCHEMA_PATH ?? path.resolve(here, "../../shared/trace.schema.json"),
};
