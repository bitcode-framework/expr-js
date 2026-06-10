// Port of expr-lang/expr test/issues/688/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";

// type Foo interface { Add(a int, b *int) int }
// type Env struct { Foo Foo `expr:"foo"`; Any(x any) any }

// TestNoInterfaceMethodWithNil — PORTED_WITH_ADAPTER
// Go: foo.Add(1, nil) where Foo.Add takes (int, *int). nil *int pointer.
// JS: no pointers; pass null as second arg. Foo.Add ignores the pointer param.
test("TestNoInterfaceMethodWithNil", () => {
  const env: Record<string, any> = {
    foo: {
      Add(a: any, b: any): bigint {
        return 0n;
      },
    },
  };
  const program = Compile(`foo.Add(1, nil)`, Env(env));
  const out = Run(program, env);
  // Go returns 0; JS returns 0n (bigint from int return type)
  assert.equal(Number(out), 0);
});

// TestNoInterfaceMethodWithNil_with_env — PORTED_WITH_ADAPTER
// Go: same with typed struct env. JS: env object with foo property.
test("TestNoInterfaceMethodWithNil_with_env", () => {
  const env: Record<string, any> = {
    foo: {
      Add(a: any, b: any): bigint {
        return 0n;
      },
    },
    Any(x: any): any {
      return x;
    },
  };
  const program = Compile(`foo.Add(1, nil)`, Env(env));
  const out = Run(program, env);
  assert.equal(Number(out), 0);
});

// TestNoInterfaceMethodWithNil_with_any — PORTED_WITH_ADAPTER
// The Any(x) env method (returns its arg) is portable as a JS object method.
test("TestNoInterfaceMethodWithNil_with_any", () => {
  const env = {
    Any(x: any): any {
      return x;
    },
  };
  const program = Compile("Any(nil)", Env(env));
  const out = Run(program, env);
  assert.equal(out, null);
});

// PORTED: 0, PORTED_WITH_ADAPTER: 3, FORCED_NA: 0
