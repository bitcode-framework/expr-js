// Port of expr-lang/expr optimizer/sum_map_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { IdentifierNode, MemberNode, PointerNode, StringNode, BuiltinNode, PredicateNode } from "../../../src/ast/node.js";
import { Dump } from "../../../src/ast/dump.js";
import { Optimize } from "../../../src/optimizer/optimizer.js";
import { Parse } from "../../../src/parser/parser.js";

// TestOptimize_sum_map — PORTED
test("TestOptimize_sum_map", () => {
  // PORTED
  const tree = Parse("sum(map(users, {.Age}))");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BuiltinNode("sum", [
    new IdentifierNode("users"),
    new PredicateNode(
      new MemberNode(new PointerNode(), new StringNode("Age")),
    ),
  ]);

  assert.equal(Dump(ref.node), Dump(expected));
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
