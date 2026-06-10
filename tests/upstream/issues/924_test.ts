// Port of expr-lang/expr test/issues/924/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, DisableBuiltin } from "../../../src/expr.js";

// TestIssue924_allow_disabling_builtins_and_providing_fn_at_runtime — PORTED
test("TestIssue924_allow_disabling_builtins_and_providing_fn_at_runtime", () => {
  // PORTED
  // We disable the builtin "upper", but do not env information,
  // but we can provide a function at runtime.
  const program = Compile("upper(1)", DisableBuiltin("upper"));

  const env = {
    upper: (a: number) => a,
  };

  const out = Run(program, env);
  assert.equal(out, 1n);
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
