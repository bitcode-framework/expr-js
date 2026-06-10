// TS adapter for expr-lang/expr test/mock.Env, used by the go-parity corpus.
//
// PASS_WITH_ADAPTER: upstream TestExpr binds expressions to a Go struct env
// (test/mock/mock.go). This is the JS analog. Go int fields -> bigint; float
// fields -> number; methods are plain functions (the VM binds them).
// Go-only members (pointers, fmt.Stringer, embedded method promotion) are
// omitted -> those expressions remain NOT_APPLICABLE.
//
// Fixed-width ints (Int32, Uint64) are mapped to bigint (same as Int/Int64).
// Time/Duration use GoTime/GoDuration from vm/runtime/gotime.ts.
//
// Struct parity: Foo and Bar are marked as typed structs via markStruct()
// so the checker enforces closed field/method access (like Go's reflect).
import { GoTime, GoDuration } from "../../src/vm/runtime/gotime.js";
import { markStruct } from "../../src/checker/nature/nature.js";
import {
  Type,
  intType,
  stringType,
  boolType,
  anyType,
  FuncOf,
  SliceOf,
} from "../../src/checker/nature/type.js";
import { Kind } from "../../src/checker/nature/kind.js";

export interface Bar {
  Baz: string;
}
export interface Foo {
  Value: string;
  Bar: Bar;
  Method(): Bar;
  MethodWithArgs(prefix: string): string;
}

// Struct type descriptors for checker strict-struct parity.
const barType = new Type(Kind.Struct, "mock.Bar");
barType.fields.push({ name: "Baz", type: stringType, anonymous: false, index: [] });

const fooType = new Type(Kind.Struct, "mock.Foo");
const fooMethodType = FuncOf([fooType], [barType]); // receiver + return
const fooMethodWithArgsType = FuncOf([fooType, stringType], [stringType]);
fooType.fields.push({ name: "Value", type: stringType, anonymous: false, index: [] });
fooType.fields.push({ name: "Bar", type: barType, anonymous: false, index: [] });
fooType.methods.set("Method", fooMethodType);
fooType.methods.set("MethodWithArgs", fooMethodWithArgsType);

function makeBar(): Bar {
  return markStruct(
    { Baz: "baz" } as Bar,
    "mock.Bar",
    { Baz: stringType },
  );
}

function makeFoo(value: string): Foo {
  const bar = makeBar();
  const methodBar = markStruct(
    { Baz: "baz (from Foo.Method)" } as Bar,
    "mock.Bar",
    { Baz: stringType },
  );
  const obj: Foo = {
    Value: value,
    Bar: bar,
    Method(): Bar {
      return methodBar;
    },
    MethodWithArgs(prefix: string): string {
      return prefix + value;
    },
  };
  return markStruct(
    obj,
    "mock.Foo",
    { Value: stringType, Bar: barType },
    { Method: fooMethodType, MethodWithArgs: fooMethodWithArgsType },
  );
}

// Fixed epoch for deterministic Time tests (2024-01-01T00:00:00Z).
const EPOCH_MS = 1704067200000;

export function mockEnv(): Record<string, any> {
  return {
    // scalars
    Bool: true,
    Float: 0,
    Float64: 0,
    Int64: 0n,
    Int: 0n,
    Int32: 0n,
    Uint64: 0n,
    IntPtr: 0n,
    One: 1n,
    Two: 2n,
    String: "string",
    Ambiguous: "",
    Any: null,

    // time values (Go time.Time -> GoTime, time.Duration -> GoDuration)
    Time: new GoTime(EPOCH_MS),
    TimePlusDay: new GoTime(EPOCH_MS + 86400000),
    Duration: new GoDuration(0n),

    // structs
    Foo: makeFoo("foo"),

    // arrays
    ArrayOfInt: [1n, 2n, 3n, 4n, 5n],
    ArrayOfInt32: [1n, 2n, 3n, 4n, 5n],
    NestedInt32Array: [[1n, 2n, 3n], [4n, 5n, 6n]],
    ArrayOfString: ["foo", "bar", "baz"],
    ArrayOfAny: [1n, "2", true],
    ArrayOfFoo: [makeFoo("foo"), makeFoo("bar"), makeFoo("baz")],

    // nil fields (Go: typed-nil pointers/funcs/slices; TS: null for all).
    // These are zero-value fields; Go's `nil == nil` holds for zero-value ptrs,
    // matching JS null === null.
    NilAny: null,
    NilInt: null,
    NilFn: null,
    NilStruct: null,
    NilSlice: null,

    // maps
    MapOfFoo: { foo: makeFoo("foo") },
    MapOfAny: { string: "string", int: 0n },

    // methods on the env (VM binds the receiver)
    Add(a: bigint, b: bigint): bigint {
      return a + b;
    },
    Func(): bigint {
      return 0n;
    },
    GetInt(): bigint {
      return 0n;
    },

    // variadic predicate used by some TestExpr cases
    Variadic(head: bigint, ...xs: bigint[]): boolean {
      let sum = 0n;
      for (const x of xs) sum += x;
      return head === sum;
    },
  };
}
