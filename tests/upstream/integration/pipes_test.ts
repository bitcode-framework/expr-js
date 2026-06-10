// Port of expr-lang/expr test/pipes/pipes_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";

// sprintf adapter mirrors Go's fmt.Sprintf for the %s/%d cases used here.
function sprintf(format: string, ...args: any[]): string {
  let i = 0;
  return format.replace(/%[sd]/g, (m) => {
    const a = args[i++];
    if (m === "%d") return String(typeof a === "bigint" ? a : Math.trunc(Number(a)));
    return String(a);
  });
}

// TestPipes — PORTED_WITH_ADAPTER (sprintf is a JS adapter for Go fmt.Sprintf)
test("TestPipes", () => {
  // PORTED_WITH_ADAPTER
  const env = { sprintf };

  const tests: Array<[string, any]> = [
    ["-1 | abs()", 1n],
    ['"%s bar %d" | sprintf("foo", -42 | abs())', "foo bar 42"],
    ['[] | first() ?? "foo"', "foo"],
    ['"a" | upper() + "B" | lower()', "ab"],
  ];

  for (const [input, want] of tests) {
    const program = Compile(input, Env(env));
    const out = Run(program, env);
    assert.deepEqual(out, want, input);
  }
});

// TestPipes_map_filter — PORTED
test("TestPipes_map_filter", () => {
  // PORTED
  const program = Compile("1..9 | map(# + 1) | filter(# % 2 == 0)");
  const out = Run(program, null);
  assert.deepEqual([...(out as any[])].map(Number), [2, 4, 6, 8, 10]);
});

// PORTED: 1, PORTED_WITH_ADAPTER: 1, FORCED_NA: 0
