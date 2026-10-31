import { execFile } from "node:child_process";
import { config } from "../config.js";

export interface SandboxStatus { docker: boolean; image: boolean }
let cache: { at: number; value: SandboxStatus } | null = null;

/** Is Docker reachable, and has the sandbox image been built? Cached for a few seconds. */
export function sandboxStatus(): Promise<SandboxStatus> {
  if (cache && Date.now() - cache.at < 6000) return Promise.resolve(cache.value);
  return new Promise((resolve) => {
    execFile("docker", ["image", "inspect", "--format", "ok", config.sandboxImage], { timeout: 5000 }, (err, _out, stderr) => {
      let value: SandboxStatus;
      if (!err) value = { docker: true, image: true };
      else if ((err as NodeJS.ErrnoException).code === "ENOENT") value = { docker: false, image: false };
      else {
        const msg = String(stderr || err.message);
        value = { docker: !/cannot connect|daemon|error during connect|pipe|is the docker/i.test(msg), image: false };
      }
      cache = { at: Date.now(), value };
      resolve(value);
    });
  });
}
