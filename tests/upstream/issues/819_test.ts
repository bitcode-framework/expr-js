// Port of expr-lang/expr test/issues/819/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run } from "../../../src/expr.js";

// TestIssue819 case 1 — PORTED
// Go: let a = [1]; let b = type(a[0]) == 'array' ? a : [a]; b[0][0] → 1
test("TestIssue819 — case 1", () => {
  const program = Compile(`
    let a = [1];
    let b = type(a[0]) == 'array' ? a : [a];
    b[0][0]
  `);
  const out = Run(program, null);
  assert.equal(out, 1n);
});

// TestIssue819 case 2 — PORTED
// Go: let range = [1,1000]; let arr = false ? range : [range]; map(arr, {len(#)}) → [2]
test("TestIssue819 — case 2", () => {
  const program = Compile(`
    let range = [1,1000];
    let arr = false ? range : [range];
    map(arr, {len(#)})
  `);
  const out = Run(program, null) as any[];
  assert.ok(Array.isArray(out));
  assert.equal(out.length, 1);
  assert.equal(Number(out[0]), 2);
});

// PORTED: 2, PORTED_WITH_ADAPTER: 0, FORCED_DIVERGENCE: 0
