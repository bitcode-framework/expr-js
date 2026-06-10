// Parity runner: replays Go-generated fixtures against expr-js and asserts
// equivalent output. Go is the source of truth.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Eval } from "../src/expr.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "parity", "fixtures");

interface Tagged {
  k: string;
  v?: any;
}

interface Fixture {
  expr: string;
  expected: Tagged;
  type: string;
  error: boolean;
}

// Normalize an expr-js runtime value into the Go tagged-transport shape for
// structural comparison.
function normalize(v: any): any {
  if (v === null || v === undefined) return { k: "nil" };
  if (typeof v === "boolean") return { k: "bool", v };
  if (typeof v === "bigint") return { k: "int", v: v.toString() };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { k: "int-or-float", v }
      : { k: "float", v };
  }
  if (typeof v === "string") return { k: "string", v };
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

// Compare a normalized expr-js value with the Go expected tagged value.
// int vs float: Go tracks them precisely. expr-js bigint=int, number=float,
// but an integer-valued number could be either; accept int<->int-or-float.
function equalTagged(got: any, exp: Tagged): boolean {
  if (exp.k === "nil") return got.k === "nil";
  if (exp.k === "bool") return got.k === "bool" && got.v === exp.v;
  if (exp.k === "int") {
    if (got.k === "int") return got.v === String(exp.v);
    if (got.k === "int-or-float") return Number(exp.v) === got.v;
    return false;
  }
  if (exp.k === "float") {
    const ev = exp.v as number;
    if (got.k === "float") return approxEqual(got.v, ev);
    if (got.k === "int-or-float") return approxEqual(got.v, ev);
    if (got.k === "int") return approxEqual(Number(got.v), ev);
    return false;
  }
  if (exp.k === "string") return got.k === "string" && got.v === exp.v;
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
    const gkeys = Object.keys(got.v);
    if (ekeys.length !== gkeys.length) return false;
    return ekeys.every((k) => k in got.v && equalTagged(got.v[k], ev[k]!));
  }
  if (exp.k === "other") {
    return String(got.v) === String(exp.v);
  }
  return false;
}

function approxEqual(a: number, b: number): boolean {
  if (a === b) return true;
  return Math.abs(a - b) < 1e-9;
}

// Exclude env-bound corpora handled by the go-parity runners (they require
// the mock env, not the null env this no-env runner uses).
const ENV_BOUND = new Set([
  "expr_mock.json",
  "checker_mock.json",
  "builtin_mock.json",
  "time_layout.generated.json",
]);
const files = readdirSync(fixturesDir).filter(
  (f) => f.endsWith(".json") && !ENV_BOUND.has(f),
);

for (const file of files) {
  const fixtures: Fixture[] = JSON.parse(
    readFileSync(join(fixturesDir, file), "utf8"),
  );
  const group = file.replace(/\.json$/, "");
  for (const fx of fixtures) {
    test(`[${group}] ${fx.expr}`, () => {
      if (fx.error) {
        // Go errored; expr-js should also error (parity of failure).
        assert.throws(() => Eval(fx.expr, null), `expected error for ${fx.expr}`);
        return;
      }
      const out = Eval(fx.expr, null);
      const got = normalize(out);
      assert.ok(
        equalTagged(got, fx.expected),
        `expr=${fx.expr}\n  got=${JSON.stringify(got)}\n  exp=${JSON.stringify(fx.expected)}`,
      );
    });
  }
}
