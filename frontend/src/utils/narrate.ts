import type { Heap, Step, Value } from "../types/trace";

export function show(v: Value | undefined, heap: Heap): string {
  if (!v) return "nothing";
  switch (v.kind) {
    case "prim": return v.type === "char" ? `'${v.value}'` : String(v.value);
    case "null": return "null";
    case "ref": {
      const o = heap[v.id];
      if (o?.kind === "string") return `"${o.display}"`;
      if (o?.kind === "boxed") return String(o.display);
      return `a reference to the ${o?.className ?? "object"} ${v.id}`;
    }
  }
}

export const methodLabel = (m: string): string => {
  const parts = m.split(".");
  const last = parts[parts.length - 1];
  return last === "<init>" ? `new ${parts[parts.length - 2]}` : last;
};

/** Layer A: facts only. Diffs two consecutive steps and says what changed, in plain English. */
export function narrate(prev: Step | undefined, cur: Step): string[] {
  const out: string[] = [];
  if (!prev) return ["Execution starts at the first line of `main`."];
  const f = cur.stack[cur.stack.length - 1];
  const pf = prev.stack[cur.stack.length - 1];

  if (cur.event === "exception") out.push(`The program threw **${cur.exception}** and stops here.`);
  if (cur.stack.length > prev.stack.length && f)
    out.push(`Calling **${methodLabel(f.method)}**. A new frame is pushed onto the call stack.`);
  if (cur.event === "return" && f)
    out.push(
      f.returnValue
        ? `**${methodLabel(f.method)}** returns ${show(f.returnValue, cur.heap)} to its caller.`
        : `**${methodLabel(f.method)}** finishes.`,
    );
  if (cur.stack.length < prev.stack.length) out.push("The finished frame was removed from the call stack.");

  if (f) {
    const sameFrame = pf && pf.method === f.method && cur.stack.length >= prev.stack.length;
    for (const l of f.locals) {
      const old = sameFrame ? pf.locals.find((x) => x.name === l.name)?.value : undefined;
      if (!old) {
        out.push(`\`${l.name}\` is created and holds ${show(l.value, cur.heap)}.`);
      } else if (JSON.stringify(old) !== JSON.stringify(l.value)) {
        out.push(`\`${l.name}\` changed from ${show(old, prev.heap)} to ${show(l.value, cur.heap)}.`);
      }
    }
  }
  for (const [id, o] of Object.entries(cur.heap))
    if (!(id in prev.heap) && o.kind !== "string" && o.kind !== "boxed")
      out.push(`A new ${o.className} was created in memory (${id}).`);

  if (cur.stdout.length > prev.stdout.length)
    out.push(`Printed \`${cur.stdout.slice(prev.stdout.length).trimEnd()}\` to the console.`);
  return out;
}
