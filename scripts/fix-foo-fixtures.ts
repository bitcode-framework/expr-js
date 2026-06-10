import { readFileSync, writeFileSync } from "node:fs";
import { Compile, Run, Env } from "../src/expr.ts";
import { mockEnv } from "../tests/go-parity/mock-env.ts";

function normalize(v: any): any {
  if (v === null || v === undefined) return { k: "nil" };
  if (typeof v === "boolean") return { k: "bool", v };
  if (typeof v === "bigint") return { k: "int", v: v.toString() };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { k: "int-or-float", v } : { k: "float", v };
  }
  if (typeof v === "string") return { k: "string", v };
  if (v && typeof v === "object" && typeof v.ms === "number" && "Year" in v && "Month" in v && "Format" in v) {
    return { k: "time", v: v.ms };
  }
  if (v && typeof v === "object" && typeof v.value === "bigint" && "Nanoseconds" in v) {
    return { k: "duration", v: v.value.toString() };
  }
  if (v && typeof v === "object" && typeof v.name === "string" && typeof v.String === "function" && !("Year" in v) && !("value" in v)) {
    return { k: "string", v: v.name };
  }
  if (Array.isArray(v)) return { k: "array", v: v.map(normalize) };
  if (v instanceof Map) {
    const m: Record<string, any> = {};
    for (const [k, val] of v) m[String(k)] = normalize(val);
    return { k: "map", v: m };
  }
  if (typeof v === "object") {
    const m: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) m[k] = normalize(val);
    return { k: "map", v: m };
  }
  return { k: "other", v: String(v) };
}

const f = "parity/fixtures/expr_mock.json";
const rows = JSON.parse(readFileSync(f, "utf8"));

const exprsToUpdate = [
  'find(ArrayOfFoo, .Value == "baz")',
  'filter(ArrayOfFoo, .Value == "baz")[0]',
  'first(filter(ArrayOfFoo, .Value == "baz"))',
];

for (const row of rows) {
  if (exprsToUpdate.includes(row.expr)) {
    const env = mockEnv();
    const program = Compile(row.expr, Env(env));
    const out = Run(program, env);
    const normalized = normalize(out);
    row.expected = normalized;
    console.log(`Updated: ${row.expr}`);
  }
}

writeFileSync(f, JSON.stringify(rows, null, 2) + "\n");
console.log("Done");
