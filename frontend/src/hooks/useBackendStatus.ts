import { useEffect, useState } from "react";
import { IS_MOCK } from "../api/client";

export type BackendState = "checking" | "demo" | "offline" | "no-docker" | "no-image" | "online";

export function useBackendStatus(): BackendState {
  const [state, setState] = useState<BackendState>(IS_MOCK ? "demo" : "checking");
  useEffect(() => {
    if (IS_MOCK) return;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch("/api/health");
        const j = await r.json();
        if (alive) setState(!j.docker ? "no-docker" : !j.image ? "no-image" : "online");
      } catch {
        if (alive) setState("offline");
      }
    };
    void check();
    const id = setInterval(check, 8000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return state;
}
