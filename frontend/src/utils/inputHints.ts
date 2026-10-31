/** Static hints about what a program reads from stdin, found by scanning its source. Hints only: never block a run. */

const stripComments = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

export function usesInput(code: string): boolean {
  return /\bSystem\s*\.\s*in\b|\bBufferedReader\b|\bSystem\s*\.\s*console\s*\(/.test(stripComments(code));
}

export type ReadKind = "integer" | "long" | "decimal" | "true/false" | "word" | "line" | "char";
export interface Read { kind: ReadKind; call: string; tokenBased: boolean }

const KIND: Record<string, ReadKind> = {
  nextInt: "integer", nextShort: "integer", nextByte: "integer", nextLong: "long",
  nextDouble: "decimal", nextFloat: "decimal", nextBoolean: "true/false",
  next: "word", nextLine: "line", readLine: "line", read: "char",
};

/** Input calls in source order, e.g. nextInt, next, nextLine. Loops make the real count unknowable, so this is a guide. */
export function readsInOrder(code: string): Read[] {
  if (!usesInput(code)) return [];
  const out: Read[] = [];
  const re = /\.\s*(nextInt|nextShort|nextByte|nextLong|nextDouble|nextFloat|nextBoolean|nextLine|next|readLine|read)\s*\(\s*\)/g;
  for (const m of stripComments(code).matchAll(re)) {
    const kind = KIND[m[1]];
    out.push({ kind, call: m[1], tokenBased: kind !== "line" && kind !== "char" });
    if (out.length >= 12) break;
  }
  return out;
}

const EXAMPLE: Record<ReadKind, string> = { integer: "5", long: "100", decimal: "3.5", "true/false": "true", word: "hello", line: "some text", char: "65" };
export const examplePlaceholder = (reads: Read[]): string =>
  reads.length ? `Example:\n${reads.map((r) => EXAMPLE[r.kind]).join("\n")}` : "Type the program's input here";

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const INTEGER = /^[+-]?\d+$/;

/** Gentle heads-ups, e.g. you typed "abc" where nextInt() will run. At most two messages. */
export function inputWarnings(code: string, stdin: string): string[] {
  const reads = readsInOrder(code);
  if (!reads.length || !stdin.trim()) return [];
  const tokens = stdin.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < Math.min(reads.length, tokens.length); i++) {
    const r = reads[i];
    if (!r.tokenBased) break;                     // after a nextLine/readLine the token position is no longer predictable
    const t = tokens[i];
    const bad =
      r.kind === "integer" || r.kind === "long" ? !INTEGER.test(t)
      : r.kind === "decimal" ? !NUMBER.test(t)
      : r.kind === "true/false" ? !/^(true|false)$/i.test(t)
      : false;
    if (bad) {
      const want = r.kind === "integer" || r.kind === "long" ? "a whole number" : r.kind === "decimal" ? "a number" : "true or false";
      out.push(`Value ${i + 1} ("${t.slice(0, 14)}") isn't ${want}, but your code calls ${r.call}() there.`);
      break;
    }
  }
  if (reads.every((r) => r.tokenBased) && tokens.length < reads.length)
    out.push(`Your code seems to read at least ${reads.length} values, and you typed ${tokens.length}.`);
  return out;
}
