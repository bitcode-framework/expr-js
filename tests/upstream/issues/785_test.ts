// Port of expr-lang/expr test/issues/785/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";

// TestIssue785 — PORTED
// Go: chained get() with nil propagation through pipe operator.
// Both cases: nil propagates through 5 chained get() calls.
test("TestIssue785 — empty map chained get", () => {
  const env: Record<string, any> = { empty_map: {} };
  const code = `get(empty_map, "non_existing_key") | get("some_key") | get("another_key") | get("yet_another_key") | get("last_key")`;
  const program = Compile(code, Env(env));
  const out = Run(program, env);
  assert.equal(out, null);
});

test("TestIssue785 — literal empty object chained get", () => {
  const env: Record<string, any> = { empty_map: {} };
  const code = `{} | get("non_existing_key") | get("some_key") | get("another_key") | get("yet_another_key") | get("last_key")`;
  const program = Compile(code, Env(env));
  const out = Run(program, env);
  assert.equal(out, null);
});

// PORTED: 2, PORTED_WITH_ADAPTER: 0, FORCED_DIVERGENCE: 0
