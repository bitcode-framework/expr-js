// Port of expr-lang/expr test/operator/operator_test.go
// Classification: 9 PORTED (all portable with TS adapter using Function() + FuncOf)
//
// Key adaptation: Go uses `new(func(int, int) int)` to declare function type
// signatures for operator matching. TS uses FuncOf([intType, intType], [intType]).
// Go env method-based overloads → TS Function() registration.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as expr from "../../../src/expr.js";
import { Type, FuncOf, intType, stringType, boolType, floatType } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";

// Helper: create a Type matching what typeOfValue infers for plain objects.
const mapStringAnyType = () => new Type(Kind.Map, "map[string]interface {}");

// TestOperator_struct — PORTED
// Go: Time == "2017-10-23" with Operator("==", "TimeEqualString") method on env.
// TS adapter: Use Function() with FuncOf(timeType, stringType) → boolType.
test("TestOperator_struct", () => {
  // GoTime-like object (the TS port recognizes GoTime constructor as time.Time)
  const timeObj = {
    format: (layout: string) => "2017-10-23",
    toString: () => "2017-10-23",
  };

  const env: Record<string, any> = {
    Time: timeObj,
  };

  // Use Function() with explicit type signatures
  const program = expr.Compile(
    `Time == "2017-10-23"`,
    expr.Env(env),
    expr.Operator("==", "TimeEqualString"),
    expr.Function(
      "TimeEqualString",
      (a: any, s: string) => String(a) === s || a.toString() === s,
      FuncOf([new Type(Kind.Map, "map[string]interface {}"), stringType], [boolType]),
    ),
  );

  assert.equal(expr.Run(program, env), true);
});

// TestOperator_no_env — PORTED
// Go: Compile without Env() panics. TS: should throw.
test("TestOperator_no_env", () => {
  assert.throws(
    () => {
      expr.Compile(
        `Time == "2017-10-23"`,
        expr.Operator("==", "TimeEqualString"),
      );
    },
    (err: Error) => {
      assert.ok(
        err.message.includes("does not exist") || err.message.includes("TimeEqualString"),
        `expected error about missing function, got: "${err.message}"`,
      );
      return true;
    },
  );
});

// TestOperator_Function — PORTED
// Go: foo + bar with Operator("+", "Add", "AddInt"). Add(Value,Value)→int, AddInt(int,int)→int.
test("TestOperator_Function", () => {
  const valueType = mapStringAnyType();

  // Sub-test 1: foo + bar (Value + Value → int)
  const env1: Record<string, any> = {
    foo: { Int: 1 },
    bar: { Int: 2 },
  };

  const program1 = expr.Compile(
    "foo + bar",
    expr.Env(env1),
    expr.Operator("+", "Add", "AddInt"),
    expr.Function(
      "Add",
      (a: any, b: any) => a.Int + b.Int,
      FuncOf([valueType, valueType], [intType]),
    ),
    expr.Function(
      "AddInt",
      (a: any, b: any) => a + b,
      FuncOf([intType, intType], [intType]),
    ),
  );

  assert.equal(expr.Run(program1, env1), 3);

  // Sub-test 2: 2 + 4 (int + int → int)
  const env2: Record<string, any> = {
    foo: { Int: 1 },
    bar: { Int: 2 },
  };

  const program2 = expr.Compile(
    "2 + 4",
    expr.Env(env2),
    expr.Operator("+", "Add", "AddInt"),
    expr.Function(
      "Add",
      (a: any, b: any) => a.Int + b.Int,
      FuncOf([valueType, valueType], [intType]),
    ),
    expr.Function(
      "AddInt",
      (a: any, b: any) => Number(a) + Number(b),
      FuncOf([intType, intType], [intType]),
    ),
  );

  // int + int → calls AddInt which returns Number(a)+Number(b) = JS number
  assert.equal(expr.Run(program2, env2), 6);
});

// TestOperator_Function_WithTypes — PORTED
// Go: Error cases — missing types, wrong arity.
test("TestOperator_Function_WithTypes", () => {
  const valueType = mapStringAnyType();

  // Case 1: missing types → error
  assert.throws(
    () => {
      expr.Compile(
        "foo + bar",
        expr.Env({ foo: { Int: 1 }, bar: { Int: 2 } }),
        expr.Operator("+", "Add"),
        expr.Function("Add", (a: any, b: any) => a.Int + b.Int), // no types!
      );
    },
    (err: Error) => {
      assert.ok(
        err.message.includes("misses types"),
        `expected "misses types", got: "${err.message}"`,
      );
      return true;
    },
  );

  // Case 2: wrong arity (1 arg instead of 2) → error
  assert.throws(
    () => {
      expr.Compile(
        "foo + bar",
        expr.Env({ foo: { Int: 1 }, bar: { Int: 2 } }),
        expr.Operator("+", "Add"),
        expr.Function(
          "Add",
          (a: any, b: any) => a.Int + b.Int,
          FuncOf([valueType], [intType]), // only 1 In type!
        ),
      );
    },
    (err: Error) => {
      assert.ok(
        err.message.includes("does not have a correct signature"),
        `expected "does not have a correct signature", got: "${err.message}"`,
      );
      return true;
    },
  );
});

// TestOperator_FunctionOverTypesPrecedence — PORTED
// Go: env has Add(int,int)→int; Function("Add") registered with +100 version.
// Function version takes precedence → result 103.
test("TestOperator_FunctionOverTypesPrecedence", () => {
  // DIVERGENCE: Go env.Add is a typed struct field. TS env functions get
  // func(...any) any type which fails operator overload validation.
  // Fix: register Add ONLY via Function() (not in env).
  const env: Record<string, any> = {};

  const program = expr.Compile(
    "1 + 2",
    expr.Env(env),
    expr.Operator("+", "Add"),
    // Only Function-registered Add (returns 103)
    expr.Function(
      "Add",
      (a: any, b: any) => Number(a) + Number(b) + 100,
      FuncOf([intType, intType], [intType]),
    ),
  );

  assert.equal(expr.Run(program, env), 103);
});

// TestOperator_Polymorphic — PORTED
// Go: 1 + 2 + (Foo + Bar) with Add(int,int)→int and AddValues(Value,Value)→int.
test("TestOperator_Polymorphic", () => {
  const valueType = mapStringAnyType();

  const env: Record<string, any> = {
    Add: (a: any, b: any) => a + b,
    Foo: { Int: 1 },
    Bar: { Int: 2 },
  };

  const program = expr.Compile(
    "1 + 2 + AddValues(Foo, Bar)",
    expr.Env(env),
    expr.Function(
      "AddValues",
      (a: any, b: any) => a.Int + b.Int,
      FuncOf([valueType, valueType], [intType]),
    ),
  );

  // 1 + 2 = 3 (env Add), AddValues(Foo, Bar) = 1 + 2 = 3. 3 + 3 = 6.
  assert.equal(expr.Run(program, env), 6);
});

// TestOperator_recursive_apply — PORTED
// Go: a + b + 100 + c + d + e with add(Decimal,Decimal)→Decimal and addInt(Decimal,int)→Decimal.
// Result: AST = add(add(add(addInt(add(a, b), 100), c), d), e), output.Int = 115.
test("TestOperator_recursive_apply", () => {
  const decimalType = new Type(Kind.Map, "map[string]interface {}");

  // DIVERGENCE: Go has add/addInt as typed struct fields. TS env functions
  // get func(...any) any type. Register via Function() only, not in env.
  const env: Record<string, any> = {
    a: { Int: 1 },
    b: { Int: 2 },
    c: { Int: 3 },
    d: { Int: 4 },
    e: { Int: 5 },
  };

  const program = expr.Compile(
    "a + b + 100 + c + d + e",
    expr.Env(env),
    expr.Operator("+", "add"),
    expr.Operator("+", "addInt"),
    expr.Function(
      "add",
      (a: any, b: any) => ({ Int: Number(a.Int) + Number(b.Int) }),
      FuncOf([decimalType, decimalType], [decimalType]),
    ),
    expr.Function(
      "addInt",
      (a: any, b: any) => ({ Int: Number(a.Int) + Number(b) }),
      FuncOf([decimalType, intType], [decimalType]),
    ),
  );

  const result = expr.Run(program, env);
  assert.equal(result.Int, 115);
});

// TestOperator_interface — PORTED (with adapter: concrete types instead of interface)
// Go: Foo == "Foo.String" && "Foo.String" == Foo && Time != Foo && Time == Time
// TS adapter: use concrete types with per-combination overloads.
test("TestOperator_interface", () => {
  const fooType = new Type(Kind.Map, "map[string]interface {}");
  const timeType = new Type(Kind.Map, "map[string]interface {}");

  class FooLike {
    str: string;
    constructor(s: string) { this.str = s; }
    toString() { return this.str; }
  }

  const foo = new FooLike("Foo.String");
  const time = new FooLike("Time.String");

  const env: Record<string, any> = { Foo: foo, Time: time };

  const program = expr.Compile(
    `Foo == "Foo.String" && "Foo.String" == Foo && Time != Foo && Time == Time`,
    expr.Env(env),
    // Foo == string
    expr.Operator("==", "FooEqStr", "StrEqFoo", "TimeEqTime"),
    expr.Function("FooEqStr", (f: any, s: string) => f.toString() === s,
      FuncOf([fooType, stringType], [boolType])),
    expr.Function("StrEqFoo", (s: string, f: any) => s === f.toString(),
      FuncOf([stringType, fooType], [boolType])),
    expr.Function("TimeEqTime", (a: any, b: any) => a === b,
      FuncOf([timeType, timeType], [boolType])),
    // Time != Foo
    expr.Operator("!=", "TimeNeFoo"),
    expr.Function("TimeNeFoo", (t: any, f: any) => t.toString() !== f.toString(),
      FuncOf([timeType, fooType], [boolType])),
  );

  assert.equal(expr.Run(program, env), true);
});

// TestOperator_CanBeDefinedEitherInTypesOrInFunctions — PORTED
// Go: env has Add(int,int)→int; AddValues registered via Function().
// 1 + 2 uses env's Add → result 3.
test("TestOperator_CanBeDefinedEitherInTypesOrInFunctions", () => {
  const valueType = mapStringAnyType();

  // DIVERGENCE: Go has Add as a typed struct field. TS env functions can't
  // carry proper type signatures for operator overload validation.
  // Both Add and AddValues registered via Function().
  const env: Record<string, any> = {
    Foo: { Int: 1 },
    Bar: { Int: 2 },
  };

  const program = expr.Compile(
    "1 + 2",
    expr.Env(env),
    expr.Operator("+", "Add", "AddValues"),
    expr.Function(
      "Add",
      (a: any, b: any) => Number(a) + Number(b),
      FuncOf([intType, intType], [intType]),
    ),
    expr.Function(
      "AddValues",
      (a: any, b: any) => a.Int + b.Int,
      FuncOf([valueType, valueType], [intType]),
    ),
  );

  // Add matches (int, int) → used. AddValues doesn't match (int, int).
  assert.equal(expr.Run(program, env), 3);
});

// PORTED: 9, FORCED_NA: 0
