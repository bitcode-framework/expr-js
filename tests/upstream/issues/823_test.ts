// Port of expr-lang/expr test/issues/823/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env, WithContextOption, Function } from "../../../src/expr.js";
import { GoTime } from "../../../src/vm/runtime/gotime.js";
import { Type, FuncOf, timeType } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";

// ctxType models a parameter whose checker Type name is "context.Context",
// which is how the WithContext patcher identifies a context argument.
const ctxType = new Type(Kind.Interface, "context.Context");
const ctxFuncType = FuncOf([ctxType], [timeType]);

// TestIssue823 — PORTED_WITH_ADAPTER
// WithContext injects ctx into nested custom function calls (now2/date2).
// Go declares typed signatures; the TS adapter uses JS functions whose first
// argument is the injected context.
test("TestIssue823", () => {
  // PORTED_WITH_ADAPTER
  let now2Called = false;
  let date2Called = false;

  const env = { ctx: { background: true } };

  const p = Compile(
    "now2().After(date2())",
    Env(env),
    WithContextOption("ctx"),
    Function("now2", (...params: any[]): any => {
      assert.equal(params.length, 1, "now2 should receive context");
      now2Called = true;
      return new GoTime(Date.now());
    }, ctxFuncType),
    Function("date2", (...params: any[]): any => {
      assert.equal(params.length, 1, "date2 should receive context");
      date2Called = true;
      return new GoTime(Date.UTC(2000, 0, 1, 0, 0, 0, 0));
    }, ctxFuncType),
  );

  const r = Run(p, env);
  assert.equal(r, true);
  assert.ok(now2Called, "now2 should have been called");
  assert.ok(date2Called, "date2 should have been called");
});

// TestIssue823_EnvMethods — PORTED_WITH_ADAPTER
// Env methods Now2(ctx)/Date2(ctx) with context injection in a method chain.
test("TestIssue823_EnvMethods", () => {
  // PORTED_WITH_ADAPTER
  const env = {
    ctx: { background: true },
    Now2(_ctx: any): GoTime {
      return new GoTime(Date.now());
    },
    Date2(_ctx: any): GoTime {
      return new GoTime(Date.UTC(2000, 0, 1, 0, 0, 0, 0));
    },
  };
  const p = Compile("Now2().After(Date2())", Env(env), WithContextOption("ctx"));
  const r = Run(p, env);
  assert.equal(r, true);
});

// PORTED: 0, PORTED_WITH_ADAPTER: 2, FORCED_NA: 0
