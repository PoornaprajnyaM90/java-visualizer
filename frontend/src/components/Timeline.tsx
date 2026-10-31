import { useMemo, useRef } from "react";
import type { Step } from "../types/trace";

/**
 * The whole run as one picture: bar height = call-stack depth at each step.
 * Recursion shows up as a mountain. Red = exception, small ticks = something was printed. Click or drag to scrub.
 */
export default function Timeline({ steps, idx, go }: { steps: Step[]; idx: number; go: (n: number) => void }) {
  const n = steps.length;
  const H = 28;
  const dragging = useRef(false);
  const svg = useRef<SVGSVGElement>(null);

  const { bars, ticks, errors } = useMemo(() => {
    const maxD = Math.max(2, ...steps.map((s) => s.stack.length));
    let bars = "", ticks = "", errors = "";
    steps.forEach((s, i) => {
      const h = Math.max(3, Math.round(((s.stack.length || 1) / maxD) * (H - 6)));
      bars += `M${i},${H}v-${h}h1v${h}z`;
      if (s.event === "exception") errors += `M${i},${H}v-${H}h1v${H}z`;
      if (i > 0 && s.stdout.length > steps[i - 1].stdout.length) ticks += `M${i},0h1v4h-1z`;
    });
    return { bars, ticks, errors };
  }, [steps]);

  const pick = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    go(Math.round(((e.clientX - r.left) / r.width) * (n - 1)));
  };

  return (
    <div className="relative" role="slider" aria-label="Execution timeline" aria-valuemin={1} aria-valuemax={n} aria-valuenow={idx + 1} tabIndex={0}>
      <svg
        ref={svg} viewBox={`0 0 ${n} ${H}`} preserveAspectRatio="none"
        className="block h-9 w-full cursor-pointer touch-none rounded bg-sunken"
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={(e) => dragging.current && pick(e)}
        onPointerUp={() => (dragging.current = false)}
      >
        <defs><clipPath id="played"><rect x="0" y="0" width={idx + 1} height={H} /></clipPath></defs>
        <path d={bars} style={{ fill: "var(--line-strong)" }} />
        <path d={bars} clipPath="url(#played)" style={{ fill: "var(--accent)" }} />
        <path d={ticks} style={{ fill: "var(--ok)" }} />
        <path d={errors} style={{ fill: "var(--danger)" }} />
      </svg>
      <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-ink" style={{ left: `calc(${n > 1 ? (idx / (n - 1)) * 100 : 0}% - 1px)` }} />
    </div>
  );
}
