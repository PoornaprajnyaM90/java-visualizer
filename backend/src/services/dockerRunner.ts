import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { config } from "../config.js";

/**
 * Runs one job in a throw-away container: no network, capped CPU/RAM/PIDs,
 * read-only root FS, no capabilities, non-root user. Only the job dir is writable.
 */
export async function runTracer(code: string, stdin: string, fileName: string, mainClass: string): Promise<unknown> {
  const dir = await mkdtemp(path.join(tmpdir(), "jv-"));
  const name = `jv-${path.basename(dir)}`;
  try {
    await chmod(dir, 0o777); // container user (uid 10001) must write classes/ and trace.json
    await writeFile(path.join(dir, fileName), code, "utf8");
    await writeFile(path.join(dir, "stdin.txt"), stdin, "utf8");

    const args = [
      "run", "--rm", "--name", name,
      "--network", "none",
      "--memory", "320m", "--memory-swap", "320m",
      "--cpus", "1",
      "--pids-limit", "96",
      "--read-only",
      "--tmpfs", "/tmp:rw,size=32m,noexec",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--user", "10001:10001",
      "-v", `${dir}:/work:rw`,
      config.sandboxImage,
      "java", "-Xmx128m", "-XX:-UsePerfData", "-jar", "/opt/tracer.jar",
      `/work/${fileName}`, "/work/stdin.txt", "/work/trace.json",
      "--main", mainClass,
      "--max-steps", String(config.maxSteps),
    ];

    const child = spawn("docker", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => { if (stderr.length < 4000) stderr += d.toString(); });

    const outcome = await new Promise<"done" | "timeout">((resolve) => {
      const timer = setTimeout(() => {
        spawn("docker", ["kill", name]); // hard-kill runaway containers
        resolve("timeout");
      }, config.wallTimeoutMs);
      child.on("close", () => { clearTimeout(timer); resolve("done"); });
      child.on("error", () => { clearTimeout(timer); resolve("done"); });
    });

    if (outcome === "timeout") return { version: 1, status: "timeout", steps: [] };

    try {
      return JSON.parse(await readFile(path.join(dir, "trace.json"), "utf8"));
    } catch {
      throw new Error(`Tracer produced no output. ${stderr.slice(0, 300)}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
