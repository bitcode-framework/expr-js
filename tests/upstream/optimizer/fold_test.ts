// Port of expr-lang/expr optimizer/fold_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { ConstantNode, IntegerNode, FloatNode, BoolNode, MemberNode, BinaryNode, BuiltinNode, PredicateNode } from "../../../src/ast/node.js";
import { Dump } from "../../../src/ast/dump.js";
import { Optimize } from "../../../src/optimizer/optimizer.js";
import { Parse } from "../../../src/parser/parser.js";
import { Kind } from "../../../src/checker/nature/kind.js";

// TestOptimize_constant_folding — PORTED
test("TestOptimize_constant_folding", () => {
  // PORTED
  const tree = Parse("[1,2,3][5*5-25]");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new MemberNode(
    new ConstantNode([1n, 2n, 3n]),
    new IntegerNode(0n),
  );

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_constant_folding_with_floats — PORTED
test("TestOptimize_constant_folding_with_floats", () => {
  // PORTED
  const tree = Parse("1 + 2.0 * ((1.0 * 2) / 2) - 0");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new FloatNode(3.0);
  assert.equal(Dump(ref.node), Dump(expected));
  assert.equal(ref.node.Type().Kind(), Kind.Float64);
});

// TestOptimize_constant_folding_with_bools — PORTED
test("TestOptimize_constant_folding_with_bools", () => {
  // PORTED
  const tree = Parse("(true and false) or (true or false) or (false and false) or (true and (true == false))");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BoolNode(true);
  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_constant_folding_filter_filter — PORTED
test("TestOptimize_constant_folding_filter_filter", () => {
  // PORTED
  const tree = Parse("filter(filter(1..2, true), true)");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("filter", [
    new BinaryNode("..", new IntegerNode(1n), new IntegerNode(2n)),
    new PredicateNode(new BoolNode(true)),
  ]);

  assert.equal(Dump(ref.node), Dump(expected));
});

// PORTED: 4, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
