// Port of expr-lang/expr test/issues/739/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Eval } from "../../../src/expr.js";

// TestIssue739 — PORTED_WITH_ADAPTER
// Go: fromJSON(aJSONString) where aJSONString is *string (pointer).
// JS: no pointers; pass a regular string. fromJSON returns an object with "Num" key.
test("TestIssue739", () => {
  const env: Record<string, any> = { aJSONString: '{"Num": 1}' };
  const result = Eval("fromJSON(aJSONString)", env);
  assert.ok(result !== null && typeof result === "object");
  assert.ok("Num" in (result as Record<string, any>), `expected result to contain "Num", got ${JSON.stringify(result)}`);
});

// PORTED: 0, PORTED_WITH_ADAPTER: 1, FORCED_DIVERGENCE: 0
