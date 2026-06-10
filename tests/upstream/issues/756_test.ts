// Port of expr-lang/expr test/issues/756/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env, WithContextOption } from "../../../src/expr.js";

// type X struct{}; func (x *X) HelloCtx(ctx context.Context, text string) error
// Go uses WithContext to inject _goctx_ as the first argument of HelloCtx.

// TestIssue756 — PORTED_WITH_ADAPTER
// rpc.HelloCtx is modeled as a JS object method that accepts (ctx, text).
// WithContext("_goctx_") injects the context argument, matching Go.
test("TestIssue756", () => {
  // PORTED_WITH_ADAPTER
  const env = {
    _goctx_: { todo: true }, // stand-in for context.TODO()
    _g_: {
      rpc: {
        HelloCtx(_ctx: any, _text: string): null {
          return null;
        },
      },
    },
    text: "еуче",
  };
  const program = Compile(
    "let v = _g_.rpc.HelloCtx(text); v",
    Env(env),
    WithContextOption("_goctx_"),
  );
  const out = Run(program, env);
  assert.equal(out, null);
});

// PORTED: 0, PORTED_WITH_ADAPTER: 1, FORCED_NA: 0
