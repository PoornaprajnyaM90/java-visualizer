import { readFileSync } from "node:fs";
import AjvModule from "ajv/dist/2020.js";
import { config } from "../config.js";

// ajv ships CommonJS; under NodeNext the class sits on `.default`
const Ajv2020 = ((AjvModule as unknown as { default?: typeof AjvModule }).default ?? AjvModule) as unknown as new (
  opts: object,
) => { compile: (s: object) => { (d: unknown): boolean; errors?: unknown } };

const validateFn = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(config.schemaPath, "utf8")));

export function validateTrace(trace: unknown): { ok: true } | { ok: false; errors: unknown } {
  return validateFn(trace) ? { ok: true } : { ok: false, errors: validateFn.errors };
}
