import type { HeapObject, Step, Value } from "../types/trace";
import ValueCell from "./ValueCell";

const Cells = ({ items, prevItems, step, note }: { items: Value[]; prevItems?: Value[]; step: Step; note?: string }) => (
  <div className="flex flex-wrap items-stretch">
    {items.map((e, i) => {
      const changed = !!prevItems && JSON.stringify(prevItems[i]) !== JSON.stringify(e);
      return (
        <div key={`${step.index}-${i}`} className="min-w-11 border border-cell-line bg-cell text-center">
          <div className="px-1 text-left font-mono text-[10px] text-muted">{i}</div>
          <div className={`px-2 pb-1 ${changed ? "changed" : ""}`}><ValueCell v={e} heap={step.heap} /></div>
        </div>
      );
    })}
    {items.length === 0 && <span className="border border-cell-line bg-cell px-3 py-2 text-sm text-muted">empty</span>}
    {note && <span className="self-center px-2 text-xs text-muted">{note}</span>}
  </div>
);

function Card({ id, o, step, prev }: { id: string; o: HeapObject; step: Step; prev?: Step }) {
  const po = prev?.heap[id];
  return (
    <div data-heap-id={id} className="w-fit">
      <div className="mb-0.5 text-xs text-muted">{o.className} <span className="font-mono text-faint">{id}</span></div>
      {(o.kind === "array" || o.kind === "list") && (
        <Cells items={o.elements ?? []} prevItems={po?.elements} step={step} note={o.truncated ? "(first 50 shown)" : undefined} />
      )}
      {o.kind === "object" && (
        <table className="border-separate border-spacing-y-0.5 border-l-2 border-frame-line bg-frame/60 text-sm">
          <tbody>
            {(o.fields ?? []).map((f) => {
              const changed = !!po && JSON.stringify(po.fields?.find((x) => x.name === f.name)?.value) !== JSON.stringify(f.value);
              return (
                <tr key={f.name}>
                  <td className="pr-2 pl-2 text-right font-mono">{f.name}</td>
                  <td key={`${step.index}-${f.name}`} className={`min-w-10 border border-line-strong bg-panel px-2 py-0.5 ${changed ? "changed" : ""}`}><ValueCell v={f.value} heap={step.heap} /></td>
                </tr>
              );
            })}
            {!o.fields && <tr><td className="px-2 py-1 text-muted">(internal details hidden)</td></tr>}
            {o.fields?.length === 0 && <tr><td className="px-2 py-1 text-muted">no fields</td></tr>}
          </tbody>
        </table>
      )}
      {o.kind === "map" && (
        <table className="border-collapse text-sm">
          <tbody>
            {(o.entries ?? []).map((e, i) => (
              <tr key={i} className="border border-cell-line bg-cell">
                <td className="px-2 py-0.5"><ValueCell v={e.key} heap={step.heap} /></td>
                <td className="px-1 text-muted">→</td>
                <td className="px-2 py-0.5"><ValueCell v={e.value} heap={step.heap} /></td>
              </tr>
            ))}
            {(o.entries ?? []).length === 0 && <tr><td className="border border-cell-line bg-cell px-3 py-2 text-muted">empty</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ObjectsPanel({ step, prev }: { step: Step; prev?: Step }) {
  // Strings, boxed numbers, enums and StringBuilders are shown inline in the frames, so they get no card.
  const entries = Object.entries(step.heap).filter(([, o]) => o.kind !== "string" && o.kind !== "boxed");
  return (
    <div className="flex flex-col gap-5">
      {entries.map(([id, o]) => <Card key={id} id={id} o={o} step={step} prev={prev} />)}
      {entries.length === 0 && <p className="text-sm text-muted">No arrays or objects in memory right now.</p>}
    </div>
  );
}
