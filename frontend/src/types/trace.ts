export type Value =
  | { kind: "prim"; type: string; value: number | boolean | string }
  | { kind: "ref"; id: string }
  | { kind: "null" };

export interface Named { name: string; value: Value }
export interface Frame { method: string; line: number; locals: Named[]; returnValue?: Value }

export interface HeapObject {
  kind: "array" | "object" | "string" | "list" | "map" | "boxed";
  className: string;
  elements?: Value[];
  fields?: Named[];
  entries?: { key: Value; value: Value }[];
  display?: string;
  truncated?: boolean;
}
export type Heap = Record<string, HeapObject>;

export interface StaticGroup { className: string; fields: Named[] }

export interface Step {
  index: number;
  event: "line" | "call" | "return" | "exception" | "end";
  line: number;
  stack: Frame[];
  statics?: StaticGroup[];
  heap: Heap;
  stdout: string;
  stderr: string;
  exception?: string;
}

export interface Trace {
  version: 1;
  status: "ok" | "compile_error" | "runtime_error" | "timeout" | "step_limit";
  compileError?: { line: number; message: string };
  truncated?: boolean;
  message?: string;
  steps: Step[];
}

export interface LineDoc { line: number; explanation: string; concept?: string }
export type Level = "beginner" | "intermediate";
