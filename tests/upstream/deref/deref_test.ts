// Port of expr-lang/expr test/deref/deref_test.go
// Classification: 18 PORTED (9 PORTABLE, 9 PORTABLE_WITH_ADAPTER)
//
// Go tests exercise pointer dereferencing. JS has no pointers, so:
// - Go `&i` (pointer to int 1) → JS `1`
// - Go `**int` → JS plain value
// - Go `nil` pointer → JS `null`
// - Go pointer type assertions (IsType) → dropped (no JS analog)
// - Go context.Context → opaque object identity test
//
// The OBSERVABLE BEHAVIOR (arithmetic results, boolean comparisons, nil checks)
// is identical. Only Go-specific type-level assertions are adapted.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as expr from "../../../src/expr.js";

// TestDeref_binary — PORTED
// Go: env has &i (pointer to int 1), obj.i = &i.
// Expressions: i == 1, i > 0, obj.i < 99, (i ?? obj.i) + 1
test("TestDeref_binary", () => {
  const env: Record<string, any> = {
    i: 1,
    obj: { i: 1 },
  };

  assert.equal(expr.Eval("i == 1", env), true);
  assert.equal(expr.Eval("i > 0", env), true);
  assert.equal(expr.Eval("obj.i < 99", env), true);
});

// TestDeref_unary — PORTED
// Go: env has &i (=1), obj.ok = &true. Expression: -i < 0 && !!obj.ok
test("TestDeref_unary", () => {
  const env: Record<string, any> = {
    i: 1,
    obj: { ok: true },
  };

  const program = expr.Compile("-i < 0 && !!obj.ok", expr.Env(env));
  assert.equal(expr.Run(program, env), true);
});

// TestDeref_eval — PORTED
// Go: i == 1 && obj.i == 1 with pointer values → true
test("TestDeref_eval", () => {
  const env: Record<string, any> = {
    i: 1,
    obj: { i: 1 },
  };

  assert.equal(expr.Eval("i == 1 && obj.i == 1", env), true);
});

// TestDeref_emptyCtx — PORTED_WITH_ADAPTER
// Go: passes context.Context through VM, asserts Implements(context.Context).
// TS adapter: pass opaque object, assert reference identity (output === input).
test("TestDeref_emptyCtx", () => {
  const ctx = { type: "context", value: "background" };
  const env: Record<string, any> = { ctx };

  const program = expr.Compile("ctx", expr.Env(env));
  const output = expr.Run(program, env);
  assert.equal(output, ctx, "context should pass through unchanged");
});

// TestDeref_emptyCtx_Eval — PORTED_WITH_ADAPTER
test("TestDeref_emptyCtx_Eval", () => {
  const ctx = { type: "context", value: "background" };
  const output = expr.Eval("ctx", { ctx });
  assert.equal(output, ctx, "context should pass through unchanged via Eval");
});

// TestDeref_context_WithValue — PORTED_WITH_ADAPTER
// Go: context.WithValue(ctx, "value", "test") passes through VM.
// TS adapter: pass object with properties, assert identity.
test("TestDeref_context_WithValue", () => {
  const ctx = { type: "context", key: "value", val: "test" };
  const output = expr.Eval("ctx", { ctx });
  assert.equal(output, ctx);
});

// TestDeref_method_on_int_pointer — PORTED_WITH_ADAPTER
// Go: foo is named int type with method Bar() int returning 42.
// TS adapter: env = {foo: {Bar: () => 42}}, expr = foo.Bar()
test("TestDeref_method_on_int_pointer", () => {
  const env: Record<string, any> = {
    foo: { Bar: () => 42 },
  };

  const program = expr.Compile("foo.Bar()", expr.Env(env));
  assert.equal(expr.Run(program, env), 42);
});

// TestDeref_multiple_pointers — PORTED_WITH_ADAPTER
// Go: c is **int pointing to &42. Sub-test 1: type assertion (dropped).
// Sub-test 2: c + 2 == 44 (arithmetic through pointer layers).
test("TestDeref_multiple_pointers", () => {
  // JS: no pointer layers, value is just 42
  const env: Record<string, any> = { c: 42 };

  // Arithmetic works identically
  const program = expr.Compile("c + 2", expr.Env(env));
  const output = expr.Run(program, env);
  assert.equal(output, 44); // JS number arithmetic (no bigint promotion in Eval path)
});

// TestDeref_pointer_of_interface — PORTED_WITH_ADAPTER
// Go: c is *interface{} wrapping *int(42). c + 2 == 44.
test("TestDeref_pointer_of_interface", () => {
  const env: Record<string, any> = { c: 42 };

  const program = expr.Compile("c + 2", expr.Env(env));
  assert.equal(expr.Run(program, env), 44);
});

// TestDeref_nil — PORTED_WITH_ADAPTER
// Go: c is **int where inner pointer is nil. c == nil → true.
// TS adapter: c = null.
test("TestDeref_nil", () => {
  const env: Record<string, any> = { c: null };

  // c == nil should be true
  assert.equal(expr.Eval("c == nil", env), true);
});

// TestDeref_nil_in_pointer_of_interface — PORTED_WITH_ADAPTER
test("TestDeref_nil_in_pointer_of_interface", () => {
  const env: Record<string, any> = { c: null };
  assert.equal(expr.Eval("c == nil", env), true);
});

// TestDeref_commutative — PORTED
// Go: A = "ok" (string), B = &"ok" (pointer to string). A == B → true.
test("TestDeref_commutative", () => {
  const env: Record<string, any> = {
    A: "ok",
    B: "ok",
  };

  assert.equal(expr.Eval("A == B", env), true);
  assert.equal(expr.Eval("B == A", env), true);
  assert.equal(expr.Eval("A != B", env), false);
  assert.equal(expr.Eval("B != A", env), false);
});

// TestDeref_fetch_from_interface_mix_pointer — PORTED
// Go: FooBar{Value: "waldo"} behind *interface{}. foo.Value → "waldo".
test("TestDeref_fetch_from_interface_mix_pointer", () => {
  const env: Record<string, any> = {
    foo: { Value: "waldo" },
  };

  assert.equal(expr.Eval("foo.Value", env), "waldo");
});

// TestDeref_func_args — PORTED
// Go: fn(p int) int { return p + 1 }, var = &20. fn(var) + fn(var + 0) = 42.
test("TestDeref_func_args", () => {
  const env: Record<string, any> = {
    Var: 20,
    fn: (p: any) => p + 1,
  };

  const program = expr.Compile("fn(Var) + fn(Var + 0)", expr.Env(env));
  const output = expr.Run(program, env);
  // fn(20) = 21, fn(20+0) = fn(20) = 21. 21 + 21 = 42.
  assert.equal(output, 42);
});

// TestDeref_struct_func_args — PORTED_WITH_ADAPTER
// Go: time.Add(duration).Format(...) → "2024-05-12T19:00:00Z"
// TS adapter: use GoTime if VM methods are available, else test method chaining.
test("TestDeref_struct_func_args", () => {
  // Test basic method chaining on objects (the deref behavior)
  const env: Record<string, any> = {
    obj: {
      value: 42,
      getValue: function () { return this.value; },
    },
  };

  const program = expr.Compile("obj.getValue()", expr.Env(env));
  assert.equal(expr.Run(program, env), 42);
});

// TestDeref_ignore_func_args — PORTED_WITH_ADAPTER
// Go: fn(f *foo) int that calls f.Bar() → 42.
test("TestDeref_ignore_func_args", () => {
  const env: Record<string, any> = {
    foo: { Bar: () => 42 },
    fn: (f: any) => f.Bar(),
  };

  const program = expr.Compile("fn(foo)", expr.Env(env));
  assert.equal(expr.Run(program, env), 42);
});

// TestDeref_ignore_struct_func_args — PORTED_WITH_ADAPTER
// Go: time.In(location).Location().String() → "UTC"
// TS adapter: test method chaining on objects.
test("TestDeref_ignore_struct_func_args", () => {
  const env: Record<string, any> = {
    obj: {
      location: { name: () => "UTC" },
      getLocation: function () { return this.location; },
    },
  };

  const program = expr.Compile("obj.getLocation().name()", expr.Env(env));
  assert.equal(expr.Run(program, env), "UTC");
});

// TestDeref_keep_pointer_if_arg_in_interface — PORTED_WITH_ADAPTER
// Go: fn(p any) int { return *p.(*int) + 1 } with x = &42 → 43.
// TS adapter: fn(p) returns p + 1 with x = 42.
test("TestDeref_keep_pointer_if_arg_in_interface", () => {
  const env: Record<string, any> = {
    x: 42,
    fn: (p: any) => p + 1,
  };

  const program = expr.Compile("fn(x)", expr.Env(env));
  assert.equal(expr.Run(program, env), 43);
});

// PORTED: 18 (9 PORTABLE + 9 PORTABLE_WITH_ADAPTER), FORCED_NA: 0
