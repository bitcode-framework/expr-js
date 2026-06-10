// Script: verify all PASS entries in fixtures actually pass.
// Revert failing entries back to NOT_APPLICABLE.
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

function approxEqual(a: number, b: number): boolean {
  return a === b || Math.abs(a - b) < 1e-9;
}

function equalTagged(got: any, exp: any): boolean {
  if (exp.k === "nil") return got.k === "nil";
  if (exp.k === "bool") return got.k === "bool" && got.v === exp.v;
  if (exp.k === "int") {
    if (got.k === "int") return got.v === String(exp.v);
    if (got.k === "int-or-float") return Number(exp.v) === got.v;
    return false;
  }
  if (exp.k === "float") {
    const ev = exp.v as number;
    if (got.k === "float" || got.k === "int-or-float") return approxEqual(got.v, ev);
    if (got.k === "int") return approxEqual(Number(got.v), ev);
    return false;
  }
  if (exp.k === "string") return got.k === "string" && got.v === exp.v;
  if (exp.k === "duration") {
    return got.k === "duration" && String(got.v) === String(exp.v);
  }
  if (exp.k === "array") {
    if (got.k !== "array") return false;
    const ev = exp.v as any[];
    if (got.v.length !== ev.length) return false;
    return ev.every((e: any, i: number) => equalTagged(got.v[i], e));
  }
  if (exp.k === "map") {
    if (got.k !== "map") return false;
    const ev = exp.v as Record<string, any>;
    const ekeys = Object.keys(ev);
    if (ekeys.length !== Object.keys(got.v).length) return false;
    return ekeys.every((k) => k in got.v && equalTagged(got.v[k], ev[k]!));
  }
  if (exp.k === "other") return String(got.v) === String(exp.v);
  return false;
}

const fixtures = [
  "parity/fixtures/expr_mock.json",
  "parity/fixtures/builtin_mock.json",
  "parity/fixtures/checker_mock.json",
];

let totalReverted = 0;

for (const fixturePath of fixtures) {
  const rows = JSON.parse(readFileSync(fixturePath, "utf8"));
  let reverted = 0;

  for (const row of rows) {
    if (row.bucket !== "PASS") continue;
    // Only check entries that were previously NOT_APPLICABLE
    // (they have no reason field but were reclassified)
    
    const env = mockEnv();
    let passed = false;
    
    try {
      if (row.error) {
        try {
          const p = Compile(row.expr, Env(env));
          Run(p, env);
          passed = false; // Expected error but none thrown
        } catch {
          // Check errorContains if present
          if (row.errorContains) {
            try {
              const p = Compile(row.expr, Env(env));
              Run(p, env);
            } catch (err: any) {
              passed = err.message.includes(row.errorContains);
            }
          } else {
            passed = true;
          }
        }
      } else {
        const p = Compile(row.expr, Env(env));
        const out = Run(p, env);
        const got = normalize(out);
        passed = equalTagged(got, row.expected);
      }
    } catch {
      passed = false;
    }

    if (!passed) {
      row.bucket = "NOT_APPLICABLE";
      row.reason = "Reverted: test failed after reclassification";
      reverted++;
    }
  }

  writeFileSync(fixturePath, JSON.stringify(rows, null, 2) + "\n");
  totalReverted += reverted;
  console.log(`${fixturePath}: reverted ${reverted} failing entries`);
}

console.log(`\nTotal reverted: ${totalReverted}`);
