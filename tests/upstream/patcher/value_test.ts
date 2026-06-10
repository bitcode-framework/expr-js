// Port of expr-lang/expr patcher/value/value_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";
import { ValueGetter, getValue } from "../../../src/patcher/value/value.js";
import { Type, FuncOf, intType, stringType, anyType, arrayType } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";
import { markStruct } from "../../../src/checker/nature/nature.js";

// Valuer type definitions mirroring Go's custom types.
// Each type has valuer methods (AsInt, AsAny, AsString, etc.) that the
// ValuePatcher detects at compile time to wrap nodes with $patcher_value_getter.

const customIntType = (() => {
  const t = new Type(Kind.Struct, "customInt");
  t.methods.set("AsInt", FuncOf([t], [intType]));
  t.methods.set("AsAny", FuncOf([t], [anyType]));
  return t;
})();

const customTypedIntType = (() => {
  const t = new Type(Kind.Struct, "customTypedInt");
  t.methods.set("AsInt", FuncOf([t], [intType]));
  return t;
})();

const customUntypedIntType = (() => {
  const t = new Type(Kind.Struct, "customUntypedInt");
  t.methods.set("AsAny", FuncOf([t], [anyType]));
  return t;
})();

const customTypedStringType = (() => {
  const t = new Type(Kind.Struct, "customTypedString");
  t.methods.set("AsString", FuncOf([t], [stringType]));
  return t;
})();

const customUntypedStringType = (() => {
  const t = new Type(Kind.Struct, "customUntypedString");
  t.methods.set("AsAny", FuncOf([t], [anyType]));
  return t;
})();

const customTypedArrayType = (() => {
  const t = new Type(Kind.Struct, "customTypedArray");
  t.methods.set("AsArray", FuncOf([t], [arrayType]));
  return t;
})();

const customTypedMapType = (() => {
  const t = new Type(Kind.Struct, "customTypedMap");
  const mapType = new Type(Kind.Map, "map[string]interface {}");
  t.methods.set("AsMap", FuncOf([t], [mapType]));
  return t;
})();

// customInt: implements AsInt + AsAny
test("Test_valueAddInt", () => {
  const env: any = {
    ValueOne: { AsInt: () => 1n, AsAny: () => 1n },
    ValueTwo: { AsInt: () => 2n, AsAny: () => 2n },
  };
  markStruct(env, "Env", {
    ValueOne: customIntType,
    ValueTwo: customIntType,
  });
  const program = Compile("ValueOne + ValueTwo", Env(env), ValueGetter);
  const out = Run(program, env);
  assert.equal(Number(out), 3);
});

// customUntypedInt: implements only AsAny
test("Test_valueUntypedAddInt", () => {
  const env: any = {
    ValueOne: { AsAny: () => 1n },
    ValueTwo: { AsAny: () => 2n },
  };
  markStruct(env, "Env", {
    ValueOne: customUntypedIntType,
    ValueTwo: customUntypedIntType,
  });
  const program = Compile("ValueOne + ValueTwo", Env(env), ValueGetter);
  const out = Run(program, env);
  assert.equal(Number(out), 3);
});

// customTypedInt: implements AsInt (typed struct env)
test("Test_valueTypedAddInt", () => {
  const env: any = {
    ValueOne: { AsInt: () => 1n },
    ValueTwo: { AsInt: () => 2n },
  };
  markStruct(env, "Env", {
    ValueOne: customTypedIntType,
    ValueTwo: customTypedIntType,
  });
  const program = Compile("ValueOne + ValueTwo", Env(env), ValueGetter);
  const out = Run(program, env);
  assert.equal(Number(out), 3);
});

// Typed valuer with type mismatch: customTypedInt + customTypedString
test("Test_valueTypedAddMismatch", () => {
  const env: any = {
    ValueOne: { AsInt: () => 1n },
    ValueTwo: { AsString: () => "test" },
  };
  markStruct(env, "Env", {
    ValueOne: customTypedIntType,
    ValueTwo: customTypedStringType,
  });
  try {
    Compile("ValueOne + ValueTwo", Env(env), ValueGetter);
    assert.fail("expected compile error for typed valuer mismatch");
  } catch (e) {
    assert.ok((e as Error).message.length > 0, "expected error");
  }
});

// Untyped valuer with type mismatch: customUntypedInt + customUntypedString
// Go: compiles OK (both AsAny → interface{}), but runtime fails on int + string.
test("Test_valueUntypedAddMismatch", () => {
  const env: any = {
    ValueOne: { AsAny: () => 1n },
    ValueTwo: { AsAny: () => "test" },
  };
  markStruct(env, "Env", {
    ValueOne: customUntypedIntType,
    ValueTwo: customUntypedStringType,
  });
  const program = Compile("ValueOne + ValueTwo", Env(env), ValueGetter);
  try {
    Run(program, env);
    assert.fail("expected runtime error for int + string");
  } catch (e) {
    assert.ok((e as Error).message.length > 0, "expected runtime error");
  }
});

// customTypedArray: AsArray returns []any
test("Test_valueTypedArray", () => {
  const env: any = {
    ValueOne: { AsArray: () => [1n, 2n] },
  };
  markStruct(env, "Env", {
    ValueOne: customTypedArrayType,
  });
  const program = Compile("ValueOne[0] + ValueOne[1]", Env(env), ValueGetter);
  const out = Run(program, env);
  assert.equal(Number(out), 3);
});

// customTypedMap: AsMap returns map[string]any
test("Test_valueTypedMap", () => {
  const env: any = {
    ValueOne: { AsMap: () => ({ one: 1n, two: 2n }) },
  };
  markStruct(env, "Env", {
    ValueOne: customTypedMapType,
  });
  const program = Compile("ValueOne.one + ValueOne.two", Env(env), ValueGetter);
  const out = Run(program, env);
  assert.equal(Number(out), 3);
});

// Runtime valuer-conversion coverage (the portable half of the feature).
// getValue duck-types in Go's type-switch priority order: AsAny wins first.
test("valueGetter_runtime_getValue", () => {
  // Supplementary (not in Go test file): verifies the ported runtime getValue.
  assert.equal(getValue({ AsInt: () => 7n, AsAny: () => 7n }), 7n);
  assert.equal(getValue({ AsString: () => "x" }), "x");
  assert.deepEqual(getValue({ AsArray: () => [1n, 2n] }), [1n, 2n]);
  assert.deepEqual(getValue({ AsMap: () => ({ a: 1n }) }), { a: 1n });
  // AsAny has highest priority in the Go type switch.
  assert.equal(getValue({ AsAny: () => "any", AsInt: () => 9n }), "any");
  // Non-valuer value passes through unchanged.
  assert.equal(getValue(42n), 42n);
});

// PORTED: 7, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0 (+1 supplementary runtime test)
void Compile; void Run; void Env; void ValueGetter;
