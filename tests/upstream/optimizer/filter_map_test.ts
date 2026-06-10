// Port of expr-lang/expr optimizer/filter_map_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { IdentifierNode, IntegerNode, BoolNode, StringNode, MemberNode, PointerNode, BinaryNode, ArrayNode, BuiltinNode, PredicateNode } from "../../../src/ast/node.js";
import { Dump } from "../../../src/ast/dump.js";
import { Optimize } from "../../../src/optimizer/optimizer.js";
import { Parse } from "../../../src/parser/parser.js";

// TestOptimize_filter_map — PORTED
test("TestOptimize_filter_map", () => {
  // PORTED
  const tree = Parse('map(filter(users, .Name == "Bob"), .Age)');
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("filter", [
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

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_filter_map_with_index_pointer — PORTED
test("TestOptimize_filter_map_with_index_pointer", () => {
  // PORTED
  const tree = Parse("map(filter(users, true), #index)");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const inner = new BuiltinNode("filter", [
    new IdentifierNode("users"),
    new PredicateNode(new BoolNode(true)),
  ]);
  const expected = new BuiltinNode("map", [
    inner,
    new PredicateNode(new PointerNode("index")),
  ]);

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_filter_map_with_index_pointer_with_index_pointer_in_first_argument — PORTED
test("TestOptimize_filter_map_with_index_pointer_with_index_pointer_in_first_argument", () => {
  // PORTED
  const tree = Parse("1..2 | map(map(filter([#index], true), 42))");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const innerFilter = new BuiltinNode("filter", [
    new ArrayNode([new PointerNode("index")]),
    new PredicateNode(new BoolNode(true)),
  ]);
  innerFilter.Map = new IntegerNode(42n);

  const expected = new BuiltinNode("map", [
    new BinaryNode("..", new IntegerNode(1n), new IntegerNode(2n)),
    new PredicateNode(innerFilter),
  ]);

  assert.equal(Dump(ref.node), Dump(expected));
});

// PORTED: 3, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
