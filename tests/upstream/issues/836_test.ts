// Port of expr-lang/expr test/issues/836/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";
import { Type, intType, stringType, boolType, SliceOf } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";
import { markStruct } from "../../../src/checker/nature/nature.js";

// TestIssue836 — PORTED_WITH_ADAPTER
// Go tests pointer auto-dereference in 6 sub-tests. JS has no pointers, but
// all 6 sub-tests only test auto-deref (not pointer identity). We simulate by
// passing the dereferenced values directly. The Go pointer type is invisible
// to the expression — it only sees the dereferenced value.
test("TestIssue836: map access with pointer key", () => {
  // Go: ptrStr = &"foo"; {"foo":"bar"}[ptrStr] → auto-deref → "bar"
  // TS: ptrStr = "foo" (deref'd); {"foo":"bar"}["foo"] → "bar"
  const env: any = { ptrStr: "foo" };
  const program = Compile(`{"foo": "bar"}[ptrStr]`, Env(env));
  const output = Run(program, env);
  assert.equal(output, "bar");
});

test("TestIssue836: conditional with pointer condition", () => {
  // Go: ptrBool = &true; ptrBool ? 1 : 0 → auto-deref → 1
  // TS: ptrBool = true; true ? 1 : 0 → 1
  const env: any = { ptrBool: true };
  const program = Compile(`ptrBool ? 1 : 0`, Env(env));
  const output = Run(program, env);
  assert.equal(Number(output), 1);
});

test("TestIssue836: get() with pointer key", () => {
  // Go: ptrStr = &"foo"; get({"foo":"bar"}, ptrStr) → auto-deref → "bar"
  const env: any = { ptrStr: "foo" };
  const program = Compile(`get({"foo": "bar"}, ptrStr)`, Env(env));
  const output = Run(program, env);
  assert.equal(output, "bar");
});

test("TestIssue836: struct field pointer check in ternary (nil)", () => {
  // Go: v.Enabled is *bool = nil; v.Enabled == nil → true → "default"
  // TS: v.Enabled = null; null == null → true → "default"
  const inputStructType = new Type(Kind.Struct, "InputStruct");
  const boolPtrType = new Type(Kind.Ptr, "*bool");
  boolPtrType.elem = boolType;
  inputStructType.fields = [
    { name: "Enabled", type: boolPtrType, anonymous: false, index: [0] },
  ];
  const v: any = { Enabled: null };
  markStruct(v, "InputStruct", { Enabled: boolPtrType });
  const env: any = { v };
  const code = `v.Enabled == nil ? 'default' : ( v.Enabled ? 'enabled' : 'disabled' )`;
  const program = Compile(code, Env(env));
  const output = Run(program, env);
  assert.equal(output, "default");
});

test("TestIssue836: struct field pointer check in ternary (enabled)", () => {
  // Go: v.Enabled = &true; v.Enabled == nil → false; v.Enabled → true → "enabled"
  // TS: v.Enabled = true; true == null → false; true → truthy → "enabled"
  const boolPtrType = new Type(Kind.Ptr, "*bool");
  boolPtrType.elem = boolType;
  const v: any = { Enabled: true };
  markStruct(v, "InputStruct", { Enabled: boolPtrType });
  const env: any = { v };
  const code = `v.Enabled == nil ? 'default' : ( v.Enabled ? 'enabled' : 'disabled' )`;
  const program = Compile(code, Env(env));
  const output = Run(program, env);
  assert.equal(output, "enabled");
});

test("TestIssue836: slice with pointer indices", () => {
  // Go: ptrInt = &1; arr[ptrInt:ptrInt] → auto-deref → arr[1:1] → []
  // TS: ptrInt = 1; arr[1:1] → []
  const env: any = { ptrInt: 1, arr: [1, 2, 3] };
  const program = Compile(`arr[ptrInt:ptrInt]`, Env(env));
  const output = Run(program, env);
  assert.deepEqual(output, []);
});

// PORTED_WITH_ADAPTER: 6, FORCED_DIVERGENCE: 0
void Compile; void Run; void Env;
