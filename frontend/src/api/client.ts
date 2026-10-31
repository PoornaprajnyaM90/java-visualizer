import type { Level, LineDoc, Trace } from "../types/trace";
import { buildMockTrace } from "../mock/mockTrace";
import { SAMPLES } from "../samples";

export const IS_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const USE_MOCK = IS_MOCK;

export async function fetchTrace(code: string, stdin: string): Promise<Trace> {
  if (USE_MOCK) {
    // Demo mode replays one canned trace. Refuse anything else instead of silently showing the wrong program.
    if (code.trim() !== SAMPLES[0].code.trim())
      throw new Error("Demo mode can't run your own code. In frontend/.env set VITE_USE_MOCK=false (or delete the file), restart `npm run dev`, and start the backend.");
    await new Promise((r) => setTimeout(r, 300));
    return buildMockTrace();
  }
  const res = await fetch("/api/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, stdin }),
  });
  const body = await res.json().catch(() => null);
  if (!body) throw new Error("Can't reach the API server. Is the backend running on port 4000?");
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as Trace;
}

/** Optional AI layer. Callers treat any failure as "not available". */
export async function fetchExplain(code: string, level: Level, language: string): Promise<LineDoc[]> {
  if (USE_MOCK) {
    return [
      { line: 3, explanation: "Creates a variable `s` that will hold the running total. It starts at 0 so adding to it is safe.", concept: "variable declaration" },
      { line: 4, explanation: "A for loop: it repeats the block below once for every index of the array, from 0 up to length - 1.", concept: "for loop" },
      { line: 5, explanation: "Adds the current element to the running total. `s += x` is shorthand for `s = s + x`.", concept: "compound assignment" },
      { line: 7, explanation: "Sends the finished total back to whoever called this method.", concept: "return" },
      { line: 10, explanation: "Creates an array holding three ints. The variable `nums` stores a reference (an arrow) to it, not the numbers themselves.", concept: "arrays and references" },
      { line: 11, explanation: "Calls `sum`, passing the same array. Java hands over the reference, so no copy is made.", concept: "method call" },
      { line: 12, explanation: "Prints the text and the total to the console, then moves to a new line.", concept: "System.out.println" },
    ];
  }
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, level, language }),
  });
  if (!res.ok) throw new Error("explain unavailable");
  return res.json();
}
