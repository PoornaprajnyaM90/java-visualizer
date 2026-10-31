import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { runTracer } from "../services/dockerRunner.js";
import { detectMain } from "../services/detectMain.js";
import { validateTrace } from "../services/traceValidator.js";

const router = Router();

const Body = z.object({
  code: z.string().min(1).max(30_000),
  stdin: z.string().max(5_000).default(""),
});

let active = 0; // cap concurrent containers so a burst can't exhaust the host

router.post("/trace", async (req, res, next) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request." });
  const { code, stdin } = parsed.data;

  const info = detectMain(code);
  if ("error" in info) return res.status(400).json({ error: info.error });
  if (active >= config.maxConcurrent)
    return res.status(429).json({ error: "The server is busy. Try again in a moment." });

  active++;
  try {
    const trace = await runTracer(code, stdin, info.fileName, info.mainClass);
    const check = validateTrace(trace);
    if (!check.ok) {
      console.error("Invalid trace", check.errors);
      return res.status(502).json({ error: "The tracer returned an unexpected result." });
    }
    res.json(trace);
  } catch (err) {
    next(err);
  } finally {
    active--;
  }
});

export default router;
