import { useLayoutEffect, useState, type RefObject } from "react";

/** Draws a curved arrow from every [data-ref-from] dot to its [data-heap-id] card. Re-measures each step, resize and scroll. */
export default function ReferenceArrows({ containerRef, stepKey }: { containerRef: RefObject<HTMLDivElement>; stepKey: number }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const next: string[] = [];
      root.querySelectorAll<HTMLElement>("[data-ref-from]").forEach((src) => {
        const target = root.querySelector<HTMLElement>(`[data-heap-id="${src.dataset.refFrom}"]`);
        if (!target) return;
        const a = src.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        const x1 = a.left + a.width / 2 - box.left + root.scrollLeft;
        const y1 = a.top + a.height / 2 - box.top + root.scrollTop;
        const x2 = b.left - box.left + root.scrollLeft - 2;
        const y2 = b.top + 22 - box.top + root.scrollTop;
        const dx = Math.max(40, Math.abs(x2 - x1) / 2);
        next.push(`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
      });
      setPaths((old) => (old.join("|") === next.join("|") ? old : next));
      setSize({ w: root.scrollWidth, h: root.scrollHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.addEventListener("scroll", measure);
    return () => { ro.disconnect(); root.removeEventListener("scroll", measure); };
  }, [stepKey, containerRef]);

  return (
    <svg className="pointer-events-none absolute top-0 left-0" width={size.w} height={size.h} aria-hidden="true">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" style={{ fill: "var(--arrow)" }} />
        </marker>
      </defs>
      {paths.map((d, i) => <path key={i} d={d} fill="none" strokeWidth="1.5" markerEnd="url(#arrowhead)" style={{ stroke: "var(--arrow)" }} />)}
    </svg>
  );
}
