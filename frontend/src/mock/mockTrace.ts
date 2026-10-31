import type { Frame, Heap, Named, Step, Trace, Value } from "../types/trace";

// Hand-built trace that matches SAMPLES[0] ("Sum an array"), for UI work without a backend.
const p = (v: number): Value => ({ kind: "prim", type: "int", value: v });
const ref = (id: string): Value => ({ kind: "ref", id });

export function buildMockTrace(): Trace {
  const steps: Step[] = [];
  const heap: Heap = {
    "@1": { kind: "array", className: "String[]", elements: [] },
    "@2": { kind: "array", className: "int[]", elements: [p(3), p(5), p(7)] },
  };
  let out = "";
  const push = (event: Step["event"], line: number, stack: Frame[], h: Heap = heap) =>
    steps.push({ index: steps.length, event, line, stack, heap: h, stdout: out, stderr: "" });

  const main = (line: number, extra: Named[] = []): Frame => ({
    method: "Main.main", line,
    locals: [{ name: "args", value: ref("@1") }, ...extra],
  });
  const sum = (line: number, extra: Named[] = [], returnValue?: Value): Frame => ({
    method: "Main.sum", line, returnValue,
    locals: [{ name: "a", value: ref("@2") }, ...extra],
  });
  const nums: Named = { name: "nums", value: ref("@2") };
  const S = (v: number): Named => ({ name: "s", value: p(v) });
  const I = (v: number): Named => ({ name: "i", value: p(v) });

  push("line", 10, [main(10)], { "@1": heap["@1"] });
  push("line", 11, [main(11, [nums])]);
  const m11 = main(11, [nums]);
  push("call", 3, [m11, sum(3)]);
  push("line", 4, [m11, sum(4, [S(0)])]);
  let s = 0;
  [3, 5, 7].forEach((v, i) => {
    push("line", 5, [m11, sum(5, [S(s), I(i)])]);
    s += v;
    if (i < 2) push("line", 4, [m11, sum(4, [S(s), I(i)])]);
  });
  push("line", 7, [m11, sum(7, [S(s)])]);
  push("return", 8, [m11, sum(8, [S(s)], p(s))]);
  push("line", 11, [m11]);
  const m12 = main(12, [nums, { name: "total", value: p(s) }]);
  push("line", 12, [m12]);
  out = "Total: 15\n";
  push("line", 13, [{ ...m12, line: 13 }]);
  push("end", 13, [{ ...m12, line: 13 }]);
  return { version: 1, status: "ok", steps };
}
