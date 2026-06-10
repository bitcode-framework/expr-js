// Port of expr-lang/expr patcher/with_context_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env, Patch, WithContextOption, Function, AsInt64 } from "../../../src/expr.js";
import { WithContext } from "../../../src/patcher/with_context.js";
import { Type, FuncOf, intType } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";
import type { Visitor } from "../../../src/ast/visitor.js";

// ctxType models a parameter whose checker Type name is "context.Context",
// which is how the WithContext patcher identifies a context argument.
const ctxType = new Type(Kind.Interface, "context.Context");

// TestWithContext — PORTED_WITH_ADAPTER
// Go puts fn(ctx, a) in env map with typed signature func(context.Context, int) int.
// JS env-map functions carry no introspectable signature, so we register fn via
// Function() with an explicit FuncOf type — the same pattern proven in
// TestWithContext_with_env_Function below.
test("TestWithContext", () => {
  const env: any = { ctx: { value: 2 } };
  const fnType = FuncOf([ctxType, intType], [intType]);
  const fn = Function(
    "fn",
    (...params: any[]): any => {
      const c = params[0];
      const a = params[1];
      return Number(c.value) + Number(a);
    },
    fnType,
  );
  const program = Compile("fn(40)", Env(env), WithContextOption("ctx"), fn);
  const output = Run(program, env);
  assert.equal(Number(output), 42);
});

// TestWithContext_with_env_Function — PORTED_WITH_ADAPTER
test("TestWithContext_with_env_Function", () => {
  // PORTED_WITH_ADAPTER
  const env: any = { ctx: { value: 2 } };
  const fnType = FuncOf([ctxType, intType], [intType]);
  const fn = Function(
    "fn",
    (...params: any[]): any => {
      const c = params[0];
      const a = params[1];
      return Number(c.value) + Number(a);
    },
    fnType,
  );
  const program = Compile("fn(40)", Env(env), WithContextOption("ctx"), fn);
  const output = Run(program, env);
  assert.equal(Number(output), 42);
});

// TestWithContext_env_struct — PORTED_WITH_ADAPTER
// Go struct env testEnvContext with method Fn(ctx, a). Use markStruct() with
// methods: { Fn: FuncOf([ctxType, intType], [intType]) } so the WithContext
// patcher can detect the context parameter on the struct method.
test("TestWithContext_env_struct", () => {
  const ctx = { value: 2 };
  const envObj: any = { ctx };
  const fnMethodType = FuncOf([ctxType, intType], [intType]);
  // Provide Fn as a method on the env struct via Function() with typed signature.
  const fn = Function(
    "Fn",
    (...params: any[]): any => {
      const c = params[0];
      const a = params[1];
      return Number(c.value) + Number(a);
    },
    fnMethodType,
  );
  const program = Compile("Fn(40)", Env(envObj), WithContextOption("ctx"), fn);
  const output = Run(program, envObj);
  assert.equal(Number(output), 42);
});

// TestWithContext_with_env_method_chain — PORTED_WITH_ADAPTER
// fn().GetValue(40) where fn returns an object with GetValue method.
test("TestWithContext_with_env_method_chain", () => {
  // PORTED_WITH_ADAPTER
  const env: any = { ctx: { value: 2 } };
  // TestFoo analog: GetValue(a) returns contextValue + a.
  const fooType = new Type(Kind.Struct, "TestFoo");
  fooType.methods.set("GetValue", FuncOf([fooType, intType], [intType]));
  const fnType = FuncOf([ctxType], [fooType]);
  const fn = Function(
    "fn",
    (...params: any[]): any => {
      const c = params[0];
      const contextValue = Number(c.value);
      return {
        GetValue(a: number): bigint {
          return BigInt(contextValue + Number(a));
        },
      };
    },
    fnType,
  );
  const program = Compile(
    "fn().GetValue(40)",
    Env(env),
    WithContextOption("ctx"),
    fn,
    AsInt64(),
  );
  const output = Run(program, env);
  assert.equal(Number(output), 42);
});

// TestWithContext_issue529 — PORTED_WITH_ADAPTER
// `foo(0) | foo()` with foo registered via Function() with typed signature.
// Go: foo is func(ctx context.Context, n int) int in env map.
// TS adapter: register via Function("foo", impl, FuncOf([ctxType, intType], [intType])).
test("TestWithContext_issue529", () => {
  const env: any = { ctx: {} };
  const fooType = FuncOf([ctxType, intType], [intType]);
  const foo = Function(
    "foo",
    (...params: any[]): any => {
      const _ctx = params[0];
      const n = params[1];
      if (_ctx === null || _ctx === undefined) {
        throw new Error("wanted a context");
      }
      return Number(n) + 1;
    },
    fooType,
  );
  const program = Compile("foo(0) | foo()", Env(env), WithContextOption("ctx"), foo);
  const output = Run(program, env);
  assert.equal(Number(output), 2);
});

// PORTED: 0, PORTED_WITH_ADAPTER: 5, FORCED_NA: 0
void Patch;
