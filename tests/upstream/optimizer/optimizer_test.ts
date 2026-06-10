// Port of expr-lang/expr optimizer/optimizer_test.go
// Classification: 13 PORTED (0 FORCED_NA)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as expr from "../../../src/expr.js";
import {
  BinaryNode,
  IdentifierNode,
  IntegerNode,
  ConstantNode,
  BuiltinNode,
  PredicateNode,
  MemberNode,
  StringNode,
  PointerNode,
} from "../../../src/ast/node.js";
import { Dump } from "../../../src/ast/dump.js";
import { Optimize } from "../../../src/optimizer/optimizer.js";
import { Parse } from "../../../src/parser/parser.js";
import { New as ConfNew } from "../../../src/conf/config.js";
import { Check } from "../../../src/checker/checker.js";

// Helper: compare output. Go int → TS bigint OR number depending on builtin path.
// We compare the numeric value, not the exact type, since both are semantically correct.
function assertEqualValue(actual: any, expected: any): void {
  if (typeof expected === "number" && typeof actual === "bigint") {
    assert.equal(actual, BigInt(expected), `expected ${expected} (as bigint), got ${actual}`);
  } else if (typeof expected === "number" && typeof actual === "number") {
    assert.equal(actual, expected, `expected ${expected}, got ${actual}`);
  } else if (typeof expected === "boolean") {
    assert.equal(actual, expected, `expected ${expected}, got ${actual}`);
  } else {
    // Loose numeric comparison for bigint vs number
    assert.equal(Number(actual), Number(expected), `expected ${expected}, got ${actual}`);
  }
}

// ---------- TestOptimize (43 sub-cases, behavioral correctness) ----------
// Go: compiles optimized + unoptimized, asserts both produce same result.
test("TestOptimize", () => {
  const env: Record<string, any> = { a: 1, b: 2, c: 3 };

  const cases: [string, any][] = [
    [`1 + 2`, 3],
    [`sum([])`, 0],
    [`sum([a])`, 1],
    [`sum([a, b])`, 3],
    [`sum([a, b, c])`, 6],
    [`sum([a, b, c, 4])`, 10],
    [`sum(1..10, # * 1000)`, 55000],
    [`sum(map(1..10, # * 1000), # / 1000)`, 55],  // float64 in Go
    [`all(1..3, {# > 0}) && all(1..3, {# < 4})`, true],
    [`all(1..3, {# > 2}) && all(1..3, {# < 4})`, false],
    [`all(1..3, {# > 0}) && all(1..3, {# < 2})`, false],
    [`all(1..3, {# > 2}) && all(1..3, {# < 2})`, false],
    [`all(1..3, {# > 0}) || all(1..3, {# < 4})`, true],
    [`all(1..3, {# > 0}) || all(1..3, {# != 2})`, true],
    [`all(1..3, {# != 3}) || all(1..3, {# < 4})`, true],
    [`all(1..3, {# != 3}) || all(1..3, {# != 2})`, false],
    [`none(1..3, {# == 0})`, true],
    [`none(1..3, {# == 0}) && none(1..3, {# == 4})`, true],
    [`none(1..3, {# == 0}) && none(1..3, {# == 3})`, false],
    [`none(1..3, {# == 1}) && none(1..3, {# == 4})`, false],
    [`none(1..3, {# == 1}) && none(1..3, {# == 3})`, false],
    [`none(1..3, {# == 0}) || none(1..3, {# == 4})`, true],
    [`none(1..3, {# == 0}) || none(1..3, {# == 3})`, true],
    [`none(1..3, {# == 1}) || none(1..3, {# == 4})`, true],
    [`none(1..3, {# == 1}) || none(1..3, {# == 3})`, false],
    [`any([1, 1, 0, 1], {# == 0})`, true],
    [`any(1..3, {# == 1}) && any(1..3, {# == 2})`, true],
    [`any(1..3, {# == 0}) && any(1..3, {# == 2})`, false],
    [`any(1..3, {# == 1}) && any(1..3, {# == 4})`, false],
    [`any(1..3, {# == 0}) && any(1..3, {# == 4})`, false],
    [`any(1..3, {# == 1}) || any(1..3, {# == 2})`, true],
    [`any(1..3, {# == 0}) || any(1..3, {# == 2})`, true],
    [`any(1..3, {# == 1}) || any(1..3, {# == 4})`, true],
    [`any(1..3, {# == 0}) || any(1..3, {# == 4})`, false],
    [`one([1, 1, 0, 1], {# == 0}) and not one([1, 0, 0, 1], {# == 0})`, true],
    [`one(1..3, {# == 1}) and one(1..3, {# == 2})`, true],
    [`one(1..3, {# == 1 || # == 2}) and one(1..3, {# == 2})`, false],
    [`one(1..3, {# == 1}) and one(1..3, {# == 2 || # == 3})`, false],
    [`one(1..3, {# == 1 || # == 2}) and one(1..3, {# == 2 || # == 3})`, false],
    [`one(1..3, {# == 1}) or one(1..3, {# == 2})`, true],
    [`one(1..3, {# == 1 || # == 2}) or one(1..3, {# == 2})`, true],
    [`one(1..3, {# == 1}) or one(1..3, {# == 2 || # == 3})`, true],
    [`one(1..3, {# == 1 || # == 2}) or one(1..3, {# == 2 || # == 3})`, false],
  ];

  for (const [input, want] of cases) {
    // Optimized
    const program = expr.Compile(input, expr.Env(env));
    const output = expr.Run(program, env);
    assertEqualValue(output, want);

    // Unoptimized
    const unoptimized = expr.Compile(input, expr.Env(env), expr.Optimize(false));
    const unoptimizedOutput = expr.Run(unoptimized, env);
    assertEqualValue(unoptimizedOutput, want);
  }
});

// TestOptimize_in_array — PORTED (adapter: TS uses Set<bigint> not Go map[int]struct{})
test("TestOptimize_in_array", () => {
  const config = ConfNew({ v: 0 });

  const tree = Parse(`v in [1,2,3]`);
  Check(tree, config);

  const ref = { node: tree.Node };
  Optimize(ref, null);

  // Verify structure: BinaryNode("in", IdentifierNode("v"), ConstantNode(Set<bigint>))
  const n = ref.node;
  assert.ok(n instanceof BinaryNode, "expected BinaryNode");
  assert.equal((n as BinaryNode).Operator, "in");
  assert.ok((n as BinaryNode).Left instanceof IdentifierNode, "expected IdentifierNode left");
  assert.equal(((n as BinaryNode).Left as IdentifierNode).Value, "v");
  const right = (n as BinaryNode).Right;
  assert.ok(right instanceof ConstantNode, "expected ConstantNode right");
  const set = (right as ConstantNode).Value;
  assert.ok(set instanceof Set, "expected Set value");
  assert.equal(set.size, 3);
  assert.ok(set.has(1n));
  assert.ok(set.has(2n));
  assert.ok(set.has(3n));
});

// TestOptimize_in_range — PORTED
test("TestOptimize_in_range", () => {
  const tree = Parse(`age in 18..31`);
  const config = ConfNew({ age: 30 });
  Check(tree, config);

  const ref = { node: tree.Node };
  Optimize(ref, null);

  const left = new IdentifierNode("age");
  const expected = new BinaryNode(
    "and",
    new BinaryNode(">=", left, new IntegerNode(18n)),
    new BinaryNode("<=", left, new IntegerNode(31n)),
  );

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_in_range_with_floats — PORTED
test("TestOptimize_in_range_with_floats", () => {
  const out = expr.Eval(`f in 1..3`, { f: 1.5 });
  assert.equal(out, false);
});

// TestOptimize_const_expr — PORTED
test("TestOptimize_const_expr", () => {
  const tree = Parse(`toUpper("hello")`);

  const env: Record<string, any> = {
    toUpper: (s: string) => s.toUpperCase(),
  };

  const config = ConfNew(env);
  config.ConstExpr("toUpper");

  const ref = { node: tree.Node };
  Optimize(ref, config);

  const expected = new ConstantNode("HELLO");
  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_filter_len — PORTED
test("TestOptimize_filter_len", () => {
  const tree = Parse(`len(filter(users, .Name == "Bob"))`);
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("count", [
    new IdentifierNode("users"),
    new PredicateNode(
      new BinaryNode(
        "==",
        new MemberNode(new PointerNode(), new StringNode("Name")),
        new StringNode("Bob"),
      ),
    ),
  ]);

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_filter_0 — PORTED
test("TestOptimize_filter_0", () => {
  const tree = Parse(`filter(users, .Name == "Bob")[0]`);
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("find", [
    new IdentifierNode("users"),
    new PredicateNode(
      new BinaryNode(
        "==",
        new MemberNode(new PointerNode(), new StringNode("Name")),
        new StringNode("Bob"),
      ),
    ),
  ]);
  expected.Throws = true;

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_filter_first — PORTED
test("TestOptimize_filter_first", () => {
  const tree = Parse(`first(filter(users, .Name == "Bob"))`);
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("find", [
    new IdentifierNode("users"),
    new PredicateNode(
      new BinaryNode(
        "==",
        new MemberNode(new PointerNode(), new StringNode("Name")),
        new StringNode("Bob"),
      ),
    ),
  ]);
  expected.Throws = false;

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_filter_minus_1 — PORTED
test("TestOptimize_filter_minus_1", () => {
  const tree = Parse(`filter(users, .Name == "Bob")[-1]`);
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("findLast", [
    new IdentifierNode("users"),
    new PredicateNode(
      new BinaryNode(
        "==",
        new MemberNode(new PointerNode(), new StringNode("Name")),
        new StringNode("Bob"),
      ),
    ),
  ]);
  expected.Throws = true;

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_filter_last — PORTED
test("TestOptimize_filter_last", () => {
  const tree = Parse(`last(filter(users, .Name == "Bob"))`);
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("findLast", [
    new IdentifierNode("users"),
    new PredicateNode(
      new BinaryNode(
        "==",
        new MemberNode(new PointerNode(), new StringNode("Name")),
        new StringNode("Bob"),
      ),
    ),
  ]);
  expected.Throws = false;

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_filter_map_first — PORTED
test("TestOptimize_filter_map_first", () => {
  const tree = Parse(`first(map(filter(users, .Name == "Bob"), .Age))`);
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("find", [
    new IdentifierNode("users"),
    new PredicateNode(
      new BinaryNode(
        "==",
        new MemberNode(new PointerNode(), new StringNode("Name")),
        new StringNode("Bob"),
      ),
    ),
  ]);
  expected.Map = new MemberNode(new PointerNode(), new StringNode("Age"));
  expected.Throws = false;

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_predicate_combination — PORTED (6 sub-cases)
test("TestOptimize_predicate_combination", () => {
  const cases: [string, string, string][] = [
    ["and", "all", "and"],
    ["&&", "all", "&&"],
    ["or", "any", "or"],
    ["||", "any", "||"],
    ["and", "none", "or"],
    ["&&", "none", "||"],
  ];

  for (const [op, fn, wantOp] of cases) {
    const rule = `${fn}(users, .Age > 18 and .Name != "Bob") ${op} ${fn}(users, .Age < 30)`;

    const tree = Parse(rule);
    const ref = { node: tree.Node };
    Optimize(ref, null);

    const expected = new BuiltinNode(fn, [
      new IdentifierNode("users"),
      new PredicateNode(
        new BinaryNode(
          wantOp,
          new BinaryNode(
            "and",
            new BinaryNode(
              ">",
              new MemberNode(new PointerNode(), new StringNode("Age")),
              new IntegerNode(18n),
            ),
            new BinaryNode(
              "!=",
              new MemberNode(new PointerNode(), new StringNode("Name")),
              new StringNode("Bob"),
            ),
          ),
          new BinaryNode(
            "<",
            new MemberNode(new PointerNode(), new StringNode("Age")),
            new IntegerNode(30n),
          ),
        ),
      ),
    ]);

    assert.equal(Dump(ref.node), Dump(expected), `failed for rule: ${rule}`);
  }
});

// TestOptimize_predicate_combination_nested — PORTED
test("TestOptimize_predicate_combination_nested", () => {
  const tree = Parse(
    `all(users, {all(.Friends, {.Age == 18 })}) && all(users, {all(.Friends, {.Name != "Bob" })})`,
  );
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("all", [
    new IdentifierNode("users"),
    new PredicateNode(
      new BuiltinNode("all", [
        new MemberNode(new PointerNode(), new StringNode("Friends")),
        new PredicateNode(
          new BinaryNode(
            "&&",
            new BinaryNode(
              "==",
              new MemberNode(new PointerNode(), new StringNode("Age")),
              new IntegerNode(18n),
            ),
            new BinaryNode(
              "!=",
              new MemberNode(new PointerNode(), new StringNode("Name")),
              new StringNode("Bob"),
            ),
          ),
        ),
      ]),
    ),
  ]);

  assert.equal(Dump(ref.node), Dump(expected));
});

// PORTED: 13, FORCED_NA: 0
