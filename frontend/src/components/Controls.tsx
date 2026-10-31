import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { Step } from "../types/trace";
import Timeline from "./Timeline";

interface Props {
  steps: Step[]; idx: number; playing: boolean; speedMs: number;
  go: (n: number) => void; togglePlay: () => void; setSpeedMs: (n: number) => void;
}

export default function Controls({ steps, idx, playing, speedMs, go, togglePlay, setSpeedMs }: Props) {
  const total = steps.length;
  const btn = "flex items-center gap-1 rounded-md border border-line-strong bg-panel px-3 py-1.5 text-sm hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-panel";
  return (
    <div className="flex flex-col gap-2 border-t border-line bg-panel px-3 py-2.5">
      <Timeline steps={steps} idx={idx} go={go} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className={btn} disabled={idx === 0} onClick={() => go(0)}><SkipBack size={14} />First</button>
        <button className={btn} disabled={idx === 0} onClick={() => go(idx - 1)} title="Left arrow key"><ChevronLeft size={14} />Prev</button>
        <span className="min-w-24 text-center font-mono text-xs text-muted">Step {idx + 1} / {total}</span>
        <button className={btn} disabled={idx >= total - 1} onClick={() => go(idx + 1)} title="Right arrow key">Next<ChevronRight size={14} /></button>
        <button className={btn} disabled={idx >= total - 1} onClick={() => go(total - 1)}>Last<SkipForward size={14} /></button>
        <button className={`${btn} ml-1`} onClick={togglePlay}>
          {playing ? <><Pause size={14} />Pause</> : <><Play size={14} />Auto-play</>}
        </button>
        <label className="flex items-center gap-2 text-xs text-muted">
          Slow
          <input type="range" min={100} max={1500} step={100} value={1600 - speedMs}
                 onChange={(e) => setSpeedMs(1600 - Number(e.target.value))} aria-label="Playback speed" className="w-20 accent-[var(--accent)]" />
          Fast
        </label>
      </div>
    </div>
  );
}
