// Port of expr-lang/expr test/issues/723/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";

// TestIssue723 — PORTED_WITH_ADAPTER
// Go: get(empty_map, "non_existing_key") on map[string]string returns nil.
// JS: get(empty_map, "non_existing_key") on {} returns null (undefined → null).
test("TestIssue723", () => {
  const env: Record<string, any> = { empty_map: {} };
  const program = Compile(`get(empty_map, "non_existing_key")`, Env(env));
  const out = Run(program, env);
  assert.equal(out, null);
});

// PORTED: 0, PORTED_WITH_ADAPTER: 1, FORCED_DIVERGENCE: 0
