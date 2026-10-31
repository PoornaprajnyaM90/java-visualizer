import { useCallback, useEffect, useState } from "react";

export function useTracePlayer(total: number) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(700);

  const go = useCallback(
    (n: number) => setIdx(Math.min(Math.max(n, 0), Math.max(total - 1, 0))),
    [total],
  );
  const reset = useCallback(() => { setIdx(0); setPlaying(false); }, []);

  useEffect(() => {
    if (!playing) return;
    if (idx >= total - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx((i) => i + 1), speedMs);
    return () => clearTimeout(t);
  }, [playing, idx, total, speedMs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest(".monaco-editor, textarea, input, select")) return;
      if (e.key === "ArrowRight") go(idx + 1);
      if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, go]);

  const togglePlay = () => {
    if (idx >= total - 1) setIdx(0);
    setPlaying((p) => !p);
  };

  return { idx, go, reset, playing, setPlaying, togglePlay, speedMs, setSpeedMs };
}
