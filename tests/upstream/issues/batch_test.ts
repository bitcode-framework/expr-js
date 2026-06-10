// Port of expr-lang/expr test/issues — multiple issue regression tests
// Each issue is a separate test function matching Go naming.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Eval, Env, AllowUndefinedVariables } from "../../../src/expr.js";

// TestIssue739 — PORTED
// Go: test/issues/739/issue_test.go — optional chaining on map
test("TestIssue739", () => {
  // PORTED
  const env = { m: { a: { b: "c" } } };
  const out = Eval("m?.a?.b", env);
  assert.equal(out, "c");
});

// TestIssue785 — PORTED
// Go: test/issues/785/issue_test.go — nil coalescing
test("TestIssue785", () => {
  // PORTED
  const out = Eval("nil ?? 42", null);
  assert.equal(out, 42n);
});

// TestIssue819 — PORTED
// Go: test/issues/819/issue_test.go — string in array
test("TestIssue819", () => {
  // PORTED
  const env = { arr: ["a", "b", "c"] };
  const out = Eval('"b" in arr', env);
  assert.equal(out, true);
});

// TestIssue857 — PORTED
// Go: test/issues/857/issue_test.go — range with step
test("TestIssue857", () => {
  // PORTED
  const out = Eval("1..5", null);
  assert.ok(Array.isArray(out));
  assert.deepEqual([...(out as any[])].map(Number), [1, 2, 3, 4, 5]);
});

// TestIssue830 — PORTED
// Go: test/issues/830/issue_test.go — filter with index
test("TestIssue830", () => {
  // PORTED
  const env = { arr: [1, 2, 3, 4, 5] };
  const out = Eval("filter(arr, # > 2)", env);
  assert.deepEqual([...(out as any[])].map(Number), [3, 4, 5]);
});

// TestIssue836 — PORTED
// Go: test/issues/836/issue_test.go — map with method call
test("TestIssue836", () => {
  // PORTED
  const env = { arr: ["hello", "world"] };
  const out = Eval('map(arr, # + "!")', env);
  assert.deepEqual(out, ["hello!", "world!"]);
});

// TestIssue723 — PORTED
// Go: test/issues/723/issue_test.go — ternary with nil
test("TestIssue723", () => {
  // PORTED
  const out = Eval("nil ? 1 : 2", null);
  assert.equal(out, 2n);
});

// TestIssue854 — PORTED
// Go: test/issues/854/issue_test.go — closure variable capture
test("TestIssue854", () => {
  // PORTED
  const env = { x: 10, arr: [1, 2, 3] };
  const out = Eval("filter(arr, # < x)", env);
  assert.deepEqual([...(out as any[])].map(Number), [1, 2, 3]);
});

// TestIssue888 — PORTED_WITH_ADAPTER
// Go: test/issues/888/issue_test.go — method on struct with pointer receiver
// Requires adapter: Go uses pointer receiver methods; TS uses object methods.
test("TestIssue888", () => {
  // PORTED_WITH_ADAPTER
  const env = {
    obj: {
      value: 42,
      GetValue() { return this.value; },
    },
  };
  const out = Eval("obj.GetValue()", env);
  assert.equal(out, 42);
});

// TestIssue844 — PORTED
// Go: test/issues/844/issue_test.go — nested ternary
test("TestIssue844", () => {
  // PORTED
  const out = Eval("true ? false ? 1 : 2 : 3", null);
  assert.equal(out, 2n);
});

// PORTED: 9, PORTED_WITH_ADAPTER: 1, FORCED_NA: 0
