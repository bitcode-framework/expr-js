// Unit tests for expr-js core invariants and documented divergence gotchas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Eval } from "../../src/expr.js";
import { Parse } from "../../src/parser/parser.js";

test("integer division yields float (1/2 = 0.5)", () => {
  assert.equal(Eval("1 / 2", null), 0.5);
});

test("integer ops preserve integer (bigint)", () => {
  assert.equal(Eval("2 + 3", null), 5n);
  assert.equal(Eval("10 - 4", null), 6n);
  assert.equal(Eval("3 * 4", null), 12n);
});

test("modulo is integer-only and truncates toward zero", () => {
  assert.equal(Eval("10 % 3", null), 1n);
  assert.equal(Eval("-10 % 3", null), -1n);
});

test("exponent yields float64", () => {
  assert.equal(Eval("2 ** 10", null), 1024);
  assert.equal(Eval("2 ** 0.5", null), Math.SQRT2);
});

test("mixed int/float comparison", () => {
  assert.equal(Eval("1 == 1.0", null), true);
  assert.equal(Eval("1 < 2.0", null), true);
});

test("** is right-associative", () => {
  // 2 ** 3 ** 2 = 2 ** 9 = 512 (not (2**3)**2 = 64)
  assert.equal(Eval("2 ** 3 ** 2", null), 512);
});

test("string concatenation", () => {
  assert.equal(Eval("'foo' + 'bar'", null), "foobar");
});

test("len counts UTF-8 runes", () => {
  assert.equal(Eval("len('hello')", null), 5n);
});

test("env variables", () => {
  assert.equal(Eval("x + y", { x: 5n, y: 3n }), 8n);
});

test("member access on object", () => {
  assert.equal(Eval("user.name", { user: { name: "alice" } }), "alice");
});

test("array indexing including negative", () => {
  assert.equal(Eval("[10, 20, 30][1]", null), 20n);
  assert.equal(Eval("[10, 20, 30][-1]", null), 30n);
});

test("filter and map predicates", () => {
  assert.deepEqual(Eval("filter([1,2,3,4], # > 2)", null), [3n, 4n]);
  assert.deepEqual(Eval("map([1,2,3], # * 2)", null), [2n, 4n, 6n]);
});

test("ternary conditional", () => {
  assert.equal(Eval("1 > 2 ? 'a' : 'b'", null), "b");
});

test("let variable declaration", () => {
  assert.equal(Eval("let x = 5; x + 1", null), 6n);
});

test("pipe operator", () => {
  assert.deepEqual(Eval("[1,2,3] | filter(# > 1) | map(# * 10)", null), [20n, 30n]);
});

test("Compile then Run reuses program", () => {
  const program = Compile("a * b");
  assert.equal(Run(program, { a: 6n, b: 7n }), 42n);
  assert.equal(Run(program, { a: 2n, b: 3n }), 6n);
});

test("Parse returns a tree with a Node", () => {
  const tree = Parse("1 + 2");
  assert.ok(tree.Node);
  assert.equal(tree.Node.String(), "1 + 2");
});

test("range operator produces int array", () => {
  assert.deepEqual(Eval("1 .. 3", null), [1n, 2n, 3n]);
});

test("in operator", () => {
  assert.equal(Eval("2 in [1, 2, 3]", null), true);
  assert.equal(Eval("5 in [1, 2, 3]", null), false);
});

test("string predicates", () => {
  assert.equal(Eval("'foobar' contains 'oba'", null), true);
  assert.equal(Eval("'foobar' startsWith 'foo'", null), true);
  assert.equal(Eval("'foobar' endsWith 'bar'", null), true);
});

test("reduce with accumulator", () => {
  assert.equal(Eval("reduce([1,2,3,4], #acc + #, 0)", null), 10n);
});

test("nil coalescing", () => {
  assert.equal(Eval("nil ?? 5", null), 5n);
  assert.equal(Eval("3 ?? 5", null), 3n);
});

test("camelCase aliases exist and work", async () => {
  const mod = await import("../../src/index.js");
  assert.equal(typeof mod.compile, "function");
  assert.equal(typeof mod.run, "function");
  assert.equal(typeof mod.evaluate, "function");
  assert.equal(typeof mod.parse, "function");
  assert.equal(mod.evaluate("1 + 1", null), 2n);
});

test("Eval rejects misuse with Option as env", () => {
  // Passing a function (Option) as env should throw.
  assert.throws(() => Eval("1", () => {}));
});
