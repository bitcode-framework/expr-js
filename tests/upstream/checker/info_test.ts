// Port of expr-lang/expr checker/info_test.go
// Classification: 2 PORTED
//
// TestTypedFuncIndex: Go asserts (1, true) because Go has typed-func dispatch
// tables (vm.FuncTypes). TS does NOT have typed-func dispatch — all calls go
// through generic OpCall/OpCallN. So TS TypedFuncIndex always returns [0, false].
// This is a documented design decision, NOT a bug. The test is ported with the
// TS-correct assertion [0, false] to verify the TS behavior is consistent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TypedFuncIndex, IsFastFunc } from "../../../src/checker/info.js";
import { Type } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";

// TestTypedFuncIndex — PORTED (TS adaptation: always returns [0, false])
// Go: fn := func() time.Duration {}; index, ok := TypedFuncIndex(reflect.TypeOf(fn), false)
// Go asserts (1, true) because Go has vm.FuncTables.
// TS asserts (0, false) because TS has no typed-func dispatch tables.
test("TestTypedFuncIndex", () => {
  // Create a function type descriptor (TS equivalent of reflect.TypeOf(fn))
  const fnType = new Type(Kind.Func, "func() time.Duration");

  const [index, ok] = TypedFuncIndex(fnType, false);

  // TS always returns [0, false] — no typed-func dispatch tables.
  // This is a documented design decision (see info.ts header comment).
  assert.equal(index, 0);
  assert.equal(ok, false);
});

// TestTypedFuncIndex_excludes_named_functions — PORTED
// Go: var fn mock.MyFunc; _, ok := TypedFuncIndex(reflect.TypeOf(fn), false)
// Go asserts ok == false (named functions excluded from typed dispatch).
// TS also returns false — consistent behavior.
test("TestTypedFuncIndex_excludes_named_functions", () => {
  // Simulate a named function type (like mock.MyFunc)
  const namedFnType = new Type(Kind.Func, "mock.MyFunc");

  const [_index, ok] = TypedFuncIndex(namedFnType, false);

  assert.equal(ok, false);
});

// Additional: verify IsFastFunc always returns false (TS design)
test("IsFastFunc_always_false", () => {
  const fnType = new Type(Kind.Func, "func(...any) any");
  assert.equal(IsFastFunc(fnType, false), false);
  assert.equal(IsFastFunc(fnType, true), false);
  assert.equal(IsFastFunc(null, false), false);
});

// PORTED: 2, FORCED_NA: 0
