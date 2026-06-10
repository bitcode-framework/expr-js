// Port of expr-lang/expr test/fuzz/fuzz_env.go
// The env + custom fn used by the REPL. Go int -> bigint, float64 -> number.
import { Function as exprFunction, Option } from "../../expr.js";

// Foo mirrors the Go Foo struct with String() and Qux(s) methods.
export interface Foo {
  Bar: string;
  String(): string;
  Qux(s: string): string;
}

function makeFoo(bar: string): Foo {
  return {
    Bar: bar,
    String(): string {
      return "foo";
    },
    Qux(s: string): string {
      return bar + s;
    },
  };
}

export function NewEnv(): Record<string, any> {
  return {
    ok: true,
    f64: 0.5,
    f32: 0.5,
    i: 1n,
    i64: 1n,
    i32: 1n,
    array: [1n, 2n, 3n, 4n, 5n],
    list: [makeFoo("bar"), makeFoo("baz")],
    foo: makeFoo("bar"),
    add: (a: bigint, b: bigint): bigint => a + b,
    div: (a: bigint, b: bigint): bigint => a / b,
    half: (a: number): number => a / 2,
    score: (a: bigint, ...x: bigint[]): bigint => {
      let s = a;
      for (const n of x) s += n;
      return s;
    },
    greet: (name: string): string => "Hello, " + name,
  };
}

// Func returns the "fn" custom function option (Go: fuzz.Func()).
export function Func(): Option {
  return exprFunction("fn", (...params: any[]): any => {
    return `fn(${params})`;
  });
}
