// go-parity runner: expr corpus (TestExpr table, replayed against mock env).
// Go is the source of truth (fixtures in parity/fixtures/expr_mock.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Compile, Run } from "../../../src/expr.js";
import { Env } from "../../../src/expr.js";
import { mockEnv } from "../mock-env.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "..", "..", "parity", "fixtures", "expr_mock.json");

interface Tagged {
  k: string;
  v?: any;
}
interface Row {
  expr: string;
  expected: Tagged;
  error: boolean;
  bucket: string;
  reason?: string;
}

function normalize(v: any): any {
  if (v === null || v === undefined) return { k: "nil" };
  if (typeof v === "boolean") return { k: "bool", v };
  if (typeof v === "bigint") return { k: "int", v: v.toString() };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { k: "int-or-float", v } : { k: "float", v };
  }
  if (typeof v === "string") return { k: "string", v };
  // GoTime: compare by epoch ms.
  if (v && typeof v === "object" && typeof v.ms === "number" && "Year" in v && "Month" in v && "Format" in v) {
    return { k: "time", v: v.ms };
  }
  // GoDuration: compare by nanosecond value (the engine's representation).
  if (v && typeof v === "object" && typeof v.value === "bigint" && "Nanoseconds" in v) {
    return { k: "duration", v: v.value.toString() };
  }
  // GoLocation: compare by name.
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

function approxEqual(a: number, b: number): boolean {
  return a === b || Math.abs(a - b) < 1e-9;
}

function equalTagged(got: any, exp: Tagged): boolean {
  if (exp.k === "nil") return got.k === "nil";
  if (exp.k === "bool") return got.k === "bool" && got.v === exp.v;
  if (exp.k === "int") {
    if (got.k === "int") return got.v === String(exp.v);
    if (got.k === "int-or-float") return Number(exp.v) === got.v;
    return false;
  }
  if (exp.k === "int-or-float") {
    if (got.k === "int-or-float") return got.v === exp.v;
    if (got.k === "int") return Number(got.v) === exp.v;
    if (got.k === "float") return approxEqual(got.v, exp.v);
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
  if (exp.k === "time") {
    if (got.k === "time") return got.v === exp.v;
    // Allow int-or-float match (epoch ms)
    if (got.k === "int-or-float") return got.v === exp.v;
    return false;
  }
  if (exp.k === "array") {
    if (got.k !== "array") return false;
    const ev = exp.v as Tagged[];
    if (got.v.length !== ev.length) return false;
    return ev.every((e, i) => equalTagged(got.v[i], e));
  }
  if (exp.k === "map") {
    if (got.k !== "map") return false;
    const ev = exp.v as Record<string, Tagged>;
    const ekeys = Object.keys(ev);
    if (ekeys.length !== Object.keys(got.v).length) return false;
    return ekeys.every((k) => k in got.v && equalTagged(got.v[k], ev[k]!));
  }
  if (exp.k === "other") return String(got.v) === String(exp.v);
  return false;
}

const rows: Row[] = JSON.parse(readFileSync(fixture, "utf8"));

for (const row of rows) {
  if (row.bucket === "NOT_APPLICABLE") {
    test(`[expr][N/A] ${row.expr} — ${row.reason}`, { skip: true }, () => {});
    continue;
  }
  test(`[expr][${row.bucket}] ${row.expr}`, () => {
    const env = mockEnv();
    if (row.error) {
      assert.throws(() => {
        const p = Compile(row.expr, Env(env));
        Run(p, env);
      });
      return;
    }
    const program = Compile(row.expr, Env(env));
    const out = Run(program, env);
    const got = normalize(out);
    assert.ok(
      equalTagged(got, row.expected),
      `${row.expr}\n  got=${JSON.stringify(got)}\n  exp=${JSON.stringify(row.expected)}`,
    );
  });
}
