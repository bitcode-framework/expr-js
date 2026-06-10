// Port of expr-lang/expr test/issues/830/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, AllowUndefinedVariables, AsBool } from "../../../src/expr.js";

// TestIssue830 — PORTED
// Go: AllowUndefinedVariables() + AsBool() with undefined var → false (not nil).
test("TestIssue830", () => {
  const program = Compile("varNotExist", AllowUndefinedVariables(), AsBool());
  const out = Run(program, {});
  assert.equal(out, false);
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_DIVERGENCE: 0
