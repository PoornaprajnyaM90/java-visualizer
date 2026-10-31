import type { Heap, Value } from "../types/trace";

/** Primitives and strings render inline; other references render as a dot that ReferenceArrows connects to its heap card. */
export default function ValueCell({ v, heap }: { v: Value; heap: Heap }) {
  if (v.kind === "prim")
    return <span className="font-mono">{v.type === "char" ? `'${v.value}'` : String(v.value)}</span>;
  if (v.kind === "null") return <span className="font-mono text-faint">null</span>;
  const o = heap[v.id];
  if (o?.kind === "string") return <span className="font-mono text-str">"{o.display}"</span>;
  if (o?.kind === "boxed") return <span className="font-mono">{o.display}</span>;
  return <span data-ref-from={v.id} className="inline-block h-2.5 w-2.5 rounded-full bg-arrow" role="img" aria-label={`reference to ${v.id}`} />;
}
