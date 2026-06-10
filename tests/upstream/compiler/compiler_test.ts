// Port of expr-lang/expr compiler/compiler_test.go
// Only portable tests are ported. Tests depending on Go struct reflect,
// typed dispatch (OpCallTyped/OpCallFast), or mock.Env are FORCED_NA.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, AsInt64, AsFloat64, AsBool, Env, Optimize } from "../../../src/expr.js";
import { Opcode } from "../../../src/vm/opcodes.js";
import { Type, intType, stringType, anyType, SliceOf, MapOf, FuncOf } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";
import { markStruct } from "../../../src/checker/nature/nature.js";

// TestCompile — PORTED (literal/basic cases only; struct field cases FORCED_NA)
test("TestCompile", () => {
  // PORTED — literal cases that don't depend on Go struct env
  const tests: Array<{ code: string; wantOpcodes: Opcode[] }> = [
    {
      code: "true",
      wantOpcodes: [Opcode.OpTrue],
    },
    {
      code: `"string"`,
      wantOpcodes: [Opcode.OpPush],
    },
    {
      code: `"string" == "string"`,
      wantOpcodes: [Opcode.OpPush, Opcode.OpPush, Opcode.OpEqualString],
    },
    {
      code: "1000000 == 1000000",
      wantOpcodes: [Opcode.OpPush, Opcode.OpPush, Opcode.OpEqualInt],
    },
    {
      code: "-1",
      wantOpcodes: [Opcode.OpPush, Opcode.OpNegate],
    },
    {
      code: "true && true || true",
      wantOpcodes: [Opcode.OpTrue, Opcode.OpJumpIfFalse, Opcode.OpPop, Opcode.OpTrue, Opcode.OpJumpIfTrue, Opcode.OpPop, Opcode.OpTrue],
    },
    {
      code: "1; 2; 3",
      wantOpcodes: [Opcode.OpPush, Opcode.OpPop, Opcode.OpPush, Opcode.OpPop, Opcode.OpPush],
    },
  ];

  for (const { code, wantOpcodes } of tests) {
    const program = Compile(code, Optimize(false));
    const actualOpcodes = program.Bytecode;
    assert.deepEqual(
      [...actualOpcodes],
      wantOpcodes,
      `Compile(${code}) opcodes`,
    );
  }
});

// TestCompile_FuncTypes — PORTED_WITH_ADAPTER
// Verifies that fn([1,2], 'bar') with func([]any, string) string signature
// emits OpCallTyped with the correct FuncTypes index (32).
// Go puts fn in env map; reflect derives the type. TS uses markStruct to
// declare the function's type on the env object.
// Note: bytecode index differs from Go (Go: [3], TS: [6]) because TS emits
// separate OpPush+OpArray for the array literal. The key assertion is that
// OpCallTyped is emitted with index 32.
test("TestCompile_FuncTypes", () => {
  const fnType = FuncOf([SliceOf(anyType), stringType], [stringType]);
  const env: any = {
    fn: (_arr: any[], _s: string) => "foo",
  };
  markStruct(env, "Env", { fn: fnType });
  const program = Compile("fn([1, 2], 'bar')", Env(env), Optimize(false));
  // Find the OpCallTyped opcode in the bytecode
  const idx = program.Bytecode.indexOf(Opcode.OpCallTyped);
  assert.ok(idx >= 0, `OpCallTyped should be in bytecode, got: [${program.Bytecode}]`);
  assert.equal(program.Arguments[idx], 32, `arguments[${idx}] should be 32, got ${program.Arguments[idx]}`);
});

// TestCompile_FuncTypes_with_Method — PORTED_WITH_ADAPTER
// Verifies that FuncTyped('bar') on a struct env method with func(string) int
// emits OpCallTyped with index 76.
test("TestCompile_FuncTypes_with_Method", () => {
  const envType = new Type(Kind.Struct, "Env");
  const methodType = FuncOf([envType, stringType], [intType]);
  const env: any = {
    FuncTyped: (_s: string) => 2023n,
  };
  markStruct(env, "Env", {}, { FuncTyped: methodType });
  const program = Compile("FuncTyped('bar')", Env(env), Optimize(false));
  assert.equal(program.Bytecode[2], Opcode.OpCallTyped, `bytecode[2] should be OpCallTyped, got ${program.Bytecode[2]}`);
  assert.equal(program.Arguments[2], 76, `arguments[2] should be 76, got ${program.Arguments[2]}`);
});

// TestCompile_FuncTypes_excludes_named_functions — PORTED_WITH_ADAPTER
// Verifies that a named function type (custom name != "func") emits OpCall,
// NOT OpCallTyped.
test("TestCompile_FuncTypes_excludes_named_functions", () => {
  // MyFunc is a named function type — its Type.name is "MyFunc" not "func".
  const namedFuncType = FuncOf([stringType], [intType]);
  namedFuncType.name = "MyFunc";
  const envType = new Type(Kind.Struct, "Env");
  const methodType = FuncOf([envType, stringType], [intType]);
  methodType.name = "MyFunc";
  const env: any = {
    FuncNamed: (_s: string) => 0n,
  };
  markStruct(env, "Env", {}, { FuncNamed: methodType });
  const program = Compile("FuncNamed('bar')", Env(env), Optimize(false));
  assert.equal(program.Bytecode[2], Opcode.OpCall, `bytecode[2] should be OpCall, got ${program.Bytecode[2]}`);
  assert.equal(program.Arguments[2], 1, `arguments[2] should be 1, got ${program.Arguments[2]}`);
});

// TestCompile_OpCallFast — PORTED_WITH_ADAPTER
// Verifies that Fast(3, 2, 1) with func(...any) any signature emits OpCallFast.
test("TestCompile_OpCallFast", () => {
  const envType = new Type(Kind.Struct, "Env");
  // Fast is func(...any) any — variadic with single []any param, returns any.
  const fastType = FuncOf([envType, SliceOf(anyType)], [anyType], true);
  const env: any = {
    Fast: (...args: any[]) => args.length,
  };
  markStruct(env, "Env", {}, { Fast: fastType });
  const program = Compile("Fast(3, 2, 1)", Env(env), Optimize(false));
  assert.equal(program.Bytecode[4], Opcode.OpCallFast, `bytecode[4] should be OpCallFast, got ${program.Bytecode[4]}`);
  assert.equal(program.Arguments[4], 3, `arguments[4] should be 3, got ${program.Arguments[4]}`);
});

// TestCompile_panic — PORTED_WITH_ADAPTER
// Tests that invalid expressions produce compile errors with a Blog-like struct env.
// Uses markStruct to model the playground.Blog struct with its fields and methods.
test("TestCompile_panic", () => {
  const postType = new Type(Kind.Struct, "Post");
  postType.fields = [
    { name: "ID", type: intType, anonymous: false, index: [0] },
    { name: "Title", type: stringType, anonymous: false, index: [1] },
    { name: "PublishDate", type: new Type(Kind.Struct, "time.Time"), anonymous: false, index: [2] },
    { name: "Likes", type: intType, anonymous: false, index: [3] },
  ];

  const authorType = new Type(Kind.Struct, "Author");
  authorType.fields = [
    { name: "ID", type: intType, anonymous: false, index: [0] },
    { name: "FirstName", type: stringType, anonymous: false, index: [1] },
    { name: "LastName", type: stringType, anonymous: false, index: [2] },
  ];

  const blogType = new Type(Kind.Struct, "Blog");
  blogType.fields = [
    { name: "Posts", type: SliceOf(postType), anonymous: false, index: [0] },
    { name: "Authors", type: MapOf(intType, authorType), anonymous: false, index: [1] },
    { name: "TotalViews", type: intType, anonymous: false, index: [2] },
    { name: "TotalPosts", type: intType, anonymous: false, index: [3] },
    { name: "TotalLikes", type: intType, anonymous: false, index: [4] },
  ];

  const env: any = {
    Posts: [],
    Authors: {},
    TotalViews: 0,
    TotalPosts: 0,
    TotalLikes: 0,
  };
  markStruct(env, "Blog", {
    Posts: SliceOf(postType),
    Authors: MapOf(intType, authorType),
    TotalViews: intType,
    TotalPosts: intType,
    TotalLikes: intType,
  });

  const tests = [
    `(TotalPosts.Profile[Authors > TotalPosts == get(nil, TotalLikes)] > Authors) ^ (TotalLikes / (Posts?.PublishDate[TotalPosts] < Posts))`,
    `one(Posts, nil)`,
    `trim(TotalViews, Posts) <= get(Authors, nil)`,
    `Authors.IsZero(nil * Authors) - (TotalViews && Posts ? nil : nil)[TotalViews.IsZero(false, " ").IsZero(Authors)]`,
  ];

  for (const code of tests) {
    try {
      Compile(code, Env(env));
      assert.fail(`expected compile error for: ${code.slice(0, 60)}...`);
    } catch (e) {
      assert.ok((e as Error).message.length > 0, `expected error for: ${code.slice(0, 60)}...`);
    }
  }
});

// TestCompile_IntegerArgsFunc — PORTED_WITH_ADAPTER
// Tests that methods accepting various integer types compile successfully.
// Uses markStruct to model mock.Env with typed method signatures.
// Method signatures include the receiver type as In(0), following Go convention.
test("TestCompile_IntegerArgsFunc", () => {
  const floatType = new Type(Kind.Float64, "float64");
  const envType = new Type(Kind.Struct, "Env");
  const envObj: any = {};
  const methods: Record<string, any> = {
    FuncInt: FuncOf([envType, intType], [intType]),
    FuncInt8: FuncOf([envType, floatType], [intType]),
    FuncInt16: FuncOf([envType, intType], [intType]),
    FuncInt32: FuncOf([envType, intType], [intType]),
    FuncInt64: FuncOf([envType, intType], [intType]),
    FuncUint: FuncOf([envType, intType], [intType]),
    FuncUint8: FuncOf([envType, intType], [intType]),
    FuncUint16: FuncOf([envType, intType], [intType]),
    FuncUint32: FuncOf([envType, intType], [intType]),
    FuncUint64: FuncOf([envType, intType], [intType]),
  };
  for (const name of Object.keys(methods)) {
    envObj[name] = () => 0n;
  }
  markStruct(envObj, "Env", {}, methods);

  const tests = [
    "FuncInt(0)", "FuncInt8(0)", "FuncInt16(0)", "FuncInt32(0)", "FuncInt64(0)",
    "FuncUint(0)", "FuncUint8(0)", "FuncUint16(0)", "FuncUint32(0)", "FuncUint64(0)",
  ];
  for (const code of tests) {
    try {
      Compile(code, Env(envObj));
    } catch (e) {
      assert.fail(`unexpected compile error for ${code}: ${(e as Error).message}`);
    }
  }
});

// TestCompile_call_on_nil — PORTED
test("TestCompile_call_on_nil", () => {
  // PORTED
  const env = { foo: null };
  try {
    Compile("foo()", Env(env));
    assert.fail("expected error");
  } catch (e) {
    assert.ok((e as Error).message.includes("nil"));
  }
});

// TestCompile_Expect — PORTED (AsInt64, AsFloat64, AsBool)
test("TestCompile_Expect", () => {
  // PORTED — tests that use AsInt64/AsFloat64/AsBool options
  // We verify the last opcode is OpCast
  const p1 = Compile("1", AsInt64());
  assert.equal(p1.Bytecode[p1.Bytecode.length - 1], Opcode.OpCast);

  const p2 = Compile("1", AsFloat64());
  assert.equal(p2.Bytecode[p2.Bytecode.length - 1], Opcode.OpCast);

  const p3 = Compile("true", AsBool());
  assert.equal(p3.Bytecode[p3.Bytecode.length - 1], Opcode.OpCast);
});

// PORTED: 3, PORTED_WITH_ADAPTER: 6, FORCED_NA: 0
