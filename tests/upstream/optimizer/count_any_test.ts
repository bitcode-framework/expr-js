// Port of expr-lang/expr optimizer/count_any_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { IdentifierNode, MemberNode, PointerNode, StringNode, BuiltinNode, BinaryNode, PredicateNode } from "../../../src/ast/node.js";
import { Dump } from "../../../src/ast/dump.js";
import { Optimize } from "../../../src/optimizer/optimizer.js";
import { Parse } from "../../../src/parser/parser.js";
import { Compile, Run } from "../../../src/expr.js";

// TestOptimize_count_any — PORTED
test("TestOptimize_count_any", () => {
  // PORTED
  const tree = Parse("count(items, .active) > 0");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("any", [
    new IdentifierNode("items"),
    new PredicateNode(new MemberNode(new PointerNode(), new StringNode("active"))),
  ]);
  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_count_any_gte_one — PORTED
test("TestOptimize_count_any_gte_one", () => {
  // PORTED
  const tree = Parse("count(items, .valid) >= 1");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("any", [
    new IdentifierNode("items"),
    new PredicateNode(new MemberNode(new PointerNode(), new StringNode("valid"))),
  ]);
  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_count_any_correctness — PORTED
test("TestOptimize_count_any_correctness", () => {
  // PORTED
  const tests: Array<[string, boolean]> = [
    ["count(1..100, # == 1) > 0", true],
    ["count(1..100, # == 50) > 0", true],
    ["count(1..100, # == 100) > 0", true],
    ["count(1..100, # == 0) > 0", false],
    ["count(1..100, # % 10 == 0) >= 1", true],
    ["count(1..100, # > 100) >= 1", false],
  ];
  for (const [expr, want] of tests) {
    const output = Run(Compile(expr), null);
    assert.equal(output, want, expr);
  }
});

// TestOptimize_count_no_optimization — PORTED
test("TestOptimize_count_no_optimization", () => {
  // PORTED
  const tests = [
    "count(items, .active) > 1",
    "count(items, .active) >= 2",
    "count(items, .active) == 0",
    "count(items, .active) == 1",
    "count(items, .active) < 1",
    "count(items, .active) <= 0",
    "count(items, .active) != 0",
  ];
  for (const code of tests) {
    const tree = Parse(code);
    const ref = { node: tree.Node };
    Optimize(ref, null);
    assert.ok(ref.node instanceof BinaryNode, `expected BinaryNode for ${code}`);
  }
});

// PORTED: 4, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0 (5 benchmarks excluded)
