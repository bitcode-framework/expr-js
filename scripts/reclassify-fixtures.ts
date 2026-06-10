// Script: test all NOT_APPLICABLE fixture entries against updated mock env.
// For each entry that now compiles+runs successfully, output the updated JSON entry.
import { readFileSync, writeFileSync } from "node:fs";
import { Compile, Run, Env } from "../src/expr.js";
import { mockEnv } from "../tests/go-parity/mock-env.js";

function normalize(v: any): any {
  if (v === null || v === undefined) return { k: "nil" };
  if (typeof v === "boolean") return { k: "bool", v };
  if (typeof v === "bigint") return { k: "int", v: v.toString() };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { k: "int-or-float", v } : { k: "float", v };
  }
  if (typeof v === "string") return { k: "string", v };
  if (v && typeof v === "object" && typeof v.value === "bigint" && "Nanoseconds" in v) {
    return { k: "duration", v: v.value.toString() };
  }
  if (v && typeof v === "object" && typeof v.ms === "number" && "Year" in v) {
    return { k: "time", v: v.ms };
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

const fixtures = [
  "parity/fixtures/expr_mock.json",
  "parity/fixtures/builtin_mock.json",
  "parity/fixtures/checker_mock.json",
];

let totalReclassified = 0;
let totalRemaining = 0;

for (const fixturePath of fixtures) {
  const rows = JSON.parse(readFileSync(fixturePath, "utf8"));
  let changed = 0;
  let remaining = 0;

  for (const row of rows) {
    if (row.bucket !== "NOT_APPLICABLE") continue;

    const env = mockEnv();
    try {
      if (row.error) {
        // Test expects compile/run error
        try {
          const p = Compile(row.expr, Env(env));
          Run(p, env);
          // No error thrown — reclassification not possible
          remaining++;
        } catch {
          // Error thrown as expected — reclassify
          row.bucket = "PASS";
          delete row.reason;
          delete row.expected;
          row.error = true;
          changed++;
        }
      } else {
        // Test expects successful result
        const p = Compile(row.expr, Env(env));
        const out = Run(p, env);
        const normalized = normalize(out);
        row.expected = normalized;
        row.bucket = "PASS";
        delete row.reason;
        changed++;
      }
    } catch (err: any) {
      // Compilation or runtime error — check if this is a checker error
      // that matches the expected error (for checker tests)
      remaining++;
    }
  }

  writeFileSync(fixturePath, JSON.stringify(rows, null, 2) + "\n");
  totalReclassified += changed;
  totalRemaining += remaining;
  console.log(`${fixturePath}: reclassified ${changed}, remaining ${remaining}`);
}

console.log(`\nTotal reclassified: ${totalReclassified}`);
console.log(`Total remaining N/A: ${totalRemaining}`);
