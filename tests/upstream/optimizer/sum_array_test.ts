// Port of expr-lang/expr optimizer/sum_array_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { IdentifierNode, BinaryNode } from "../../../src/ast/node.js";
import { Dump } from "../../../src/ast/dump.js";
import { Optimize } from "../../../src/optimizer/optimizer.js";
import { Parse } from "../../../src/parser/parser.js";

// BenchmarkSumArray — FORCED_NA (benchmark, out of scope)

// TestOptimize_sum_array — PORTED
test("TestOptimize_sum_array", () => {
  // PORTED
  const tree = Parse("sum([a, b])");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BinaryNode(
    "+",
    new IdentifierNode("a"),
    new IdentifierNode("b"),
  );

  assert.equal(Dump(ref.node), Dump(expected));
});

// TestOptimize_sum_array_3 — PORTED
test("TestOptimize_sum_array_3", () => {
  // PORTED
  const tree = Parse("sum([a, b, c])");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  const expected = new BinaryNode(
    "+",
    new IdentifierNode("a"),
    new BinaryNode("+", new IdentifierNode("b"), new IdentifierNode("c")),
  );

  assert.equal(Dump(ref.node), Dump(expected));
});

// PORTED: 2, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0 (1 benchmark excluded)
