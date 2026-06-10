// Port of expr-lang/expr test/issues/857/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Env } from "../../../src/expr.js";

// TestIssue857 — PORTED
// Go: pipe chain with keys(), filter(), # placeholder accessing nested map properties.
// Compile-only test (no run result checked).
test("TestIssue857", () => {
  const foo: Record<string, any> = {
    entry: { alpha: "x", beta: 1 },
  };
  const bar: Record<string, any> = {
    entry: { alpha: "x", beta: 1 },
  };
  const env: Record<string, any> = { foo, bar };

  const code = `
    foo
    | keys()
    | filter(# in bar)
    | filter(foo[#].alpha == bar[#].alpha)
    | filter(foo[#].beta == bar[#].beta)
  `;

  // Compile should succeed (Go test only checks compilation)
  const program = Compile(code, Env(env));
  assert.ok(program !== null);
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_DIVERGENCE: 0
