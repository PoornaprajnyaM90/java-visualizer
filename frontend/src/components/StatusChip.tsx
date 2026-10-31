import type { BackendState } from "../hooks/useBackendStatus";

const INFO: Record<BackendState, { label: string; hint: string; tone: "ok" | "warn" | "danger" | "idle" }> = {
  checking: { label: "Checking…", hint: "Looking for the backend.", tone: "idle" },
  online: { label: "Ready", hint: "Backend and Docker sandbox are working. Any Java program can run.", tone: "ok" },
  demo: { label: "Demo data", hint: "Demo mode replays one canned example and ignores your code. Set VITE_USE_MOCK=false in frontend/.env and restart the frontend.", tone: "warn" },
  offline: { label: "Backend offline", hint: "Start it: open a new terminal, cd backend, npm install, npm run dev.", tone: "danger" },
  "no-docker": { label: "Docker not running", hint: "Open Docker Desktop and wait until it says it is running.", tone: "danger" },
  "no-image": { label: "Sandbox not built", hint: "Run `docker compose build sandbox` in the project folder.", tone: "danger" },
};
const DOT = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", idle: "bg-faint" };

export default function StatusChip({ state }: { state: BackendState }) {
  const { label, hint, tone } = INFO[state];
  return (
    <span title={hint} role="status" className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-panel px-3 text-sm">
      <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} aria-hidden="true" />
      <span className="font-medium">{label}</span>
      {tone !== "ok" && tone !== "idle" && <span className="hidden max-w-72 truncate text-xs text-muted xl:inline">{hint}</span>}
    </span>
  );
}
