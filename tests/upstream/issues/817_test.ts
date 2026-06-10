// Port of expr-lang/expr test/issues/817/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Eval } from "../../../src/expr.js";

// sprintf adapter for %v: Go renders nil as "<nil>".
function sprintf(format: string, ...args: any[]): string {
  let i = 0;
  return format.replace(/%v/g, () => {
    const a = args[i++];
    if (a === null || a === undefined) return "<nil>";
    if (typeof a === "bigint") return a.toString();
    return String(a);
  });
}

// TestIssue817_1 — PORTED_WITH_ADAPTER
// Go fmt.Sprintf("result: %v %v", 1, nil) → "result: 1 <nil>".
test("TestIssue817_1", () => {
  const out = Eval('sprintf("result: %v %v", 1, nil)', { sprintf });
  assert.equal(out, "result: 1 <nil>");
});

// TestIssue817_2 — PORTED_WITH_ADAPTER
// Go: thing(nil) where thing formats with %T.
// Go fmt.Sprintf("result: (%T) %v", nil, nil) → "result: (<nil>) <nil>".
// JS adapter: thing function mimics the Go formatting behavior.
test("TestIssue817_2", () => {
  const thing = (...args: any[]): string => {
    const a = args[0];
    const typeStr = (a === null || a === undefined) ? "<nil>" : typeof a;
    const valStr = (a === null || a === undefined) ? "<nil>" : String(a);
    return `result: (${typeStr}) ${valStr}`;
  };
  const out = Eval('thing(nil)', { thing });
  assert.equal(out, "result: (<nil>) <nil>");
});

// PORTED: 0, PORTED_WITH_ADAPTER: 2, FORCED_DIVERGENCE: 0
