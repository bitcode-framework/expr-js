// Port of expr-lang/expr vm/runtime/helpers_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Equal } from "../../../src/vm/runtime/helpers.js";

// tests mirrors Go's table. Go fixed-width ints (int8/16/32/64) collapse to
// bigint in TS; the int/float/string/bool/array/map cases are PORTED.
const tests: Array<{ name: string; a: any; b: any; want: boolean }> = [
  { name: "int == int", a: 42n, b: 42n, want: true },
  { name: "int != int", a: 42n, b: 33n, want: false },
  // int == int8/int16/int32/int64 collapse to bigint==bigint in TS
  { name: "int == int8", a: 42n, b: 42n, want: true },
  { name: "int == int16", a: 42n, b: 42n, want: true },
  { name: "int == int32", a: 42n, b: 42n, want: true },
  { name: "int == int64", a: 42n, b: 42n, want: true },
  { name: "float == float", a: 42.0, b: 42.0, want: true },
  { name: "float != float", a: 42.0, b: 33.0, want: false },
  { name: "float == int", a: 42.0, b: 42n, want: true },
  { name: "float != int", a: 42.0, b: 33n, want: false },
  { name: "string == string", a: "foo", b: "foo", want: true },
  { name: "string != string", a: "foo", b: "bar", want: false },
  { name: "bool == bool", a: true, b: true, want: true },
  { name: "bool != bool", a: true, b: false, want: false },
  { name: "[]any == []int", a: [1n, 2n, 3n], b: [1n, 2n, 3n], want: true },
  { name: "[]any != []int", a: [1n, 2n, 3n], b: [1n, 2n, 99n], want: false },
  { name: "deep []any == []any", a: [[1n], 2n, ["3"]], b: [[1n], 2n, ["3"]], want: true },
  { name: "deep []any != []any", a: [[1n], 2n, ["3", "42"]], b: [[1n], 2n, ["3"]], want: false },
  { name: "map == map", a: { a: 1n }, b: { a: 1n }, want: true },
  { name: "map != map", a: { a: 1n }, b: { a: 1n, b: 2n }, want: false },
];

// TestEqual — PORTED
test("TestEqual", () => {
  // PORTED
  for (const tt of tests) {
    let got = Equal(tt.a, tt.b);
    assert.equal(got, tt.want, `Equal(${tt.name}) = ${got}; want ${tt.want}`);
    got = Equal(tt.b, tt.a);
    assert.equal(got, tt.want, `Equal(${tt.name}) reverse = ${got}; want ${tt.want}`);
  }
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
