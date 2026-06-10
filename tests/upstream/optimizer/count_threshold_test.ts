// Port of expr-lang/expr optimizer/count_threshold_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { BuiltinNode, BinaryNode } from "../../../src/ast/node.js";
import { Optimize } from "../../../src/optimizer/optimizer.js";
import { Parse } from "../../../src/parser/parser.js";
import { Compile, Run } from "../../../src/expr.js";

// TestOptimize_count_threshold_gt — PORTED
test("TestOptimize_count_threshold_gt", () => {
  // PORTED
  const tree = Parse("count(items, .active) > 100");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  assert.ok(ref.node instanceof BinaryNode);
  const binary = ref.node as BinaryNode;
  assert.equal(binary.Operator, ">");
  assert.ok(binary.Left instanceof BuiltinNode);
  const count = binary.Left as BuiltinNode;
  assert.equal(count.Name, "count");
  assert.notEqual(count.Threshold, null);
  assert.equal(count.Threshold, 101); // threshold = N + 1 for > operator
});

// TestOptimize_count_threshold_gte — PORTED
test("TestOptimize_count_threshold_gte", () => {
  // PORTED
  const tree = Parse("count(items, .active) >= 50");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  assert.ok(ref.node instanceof BinaryNode);
  const binary = ref.node as BinaryNode;
  assert.equal(binary.Operator, ">=");
  const count = binary.Left as BuiltinNode;
  assert.equal(count.Name, "count");
  assert.equal(count.Threshold, 50); // threshold = N for >= operator
});

// TestOptimize_count_threshold_lt — PORTED
test("TestOptimize_count_threshold_lt", () => {
  // PORTED
  const tree = Parse("count(items, .active) < 100");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  assert.ok(ref.node instanceof BinaryNode);
  const binary = ref.node as BinaryNode;
  assert.equal(binary.Operator, "<");
  const count = binary.Left as BuiltinNode;
  assert.equal(count.Name, "count");
  assert.equal(count.Threshold, 100); // threshold = N for < operator
});

// TestOptimize_count_threshold_lte — PORTED
test("TestOptimize_count_threshold_lte", () => {
  // PORTED
  const tree = Parse("count(items, .active) <= 50");
  const ref = { node: tree.Node };
  Optimize(ref, null);

  assert.ok(ref.node instanceof BinaryNode);
  const binary = ref.node as BinaryNode;
  assert.equal(binary.Operator, "<=");
  const count = binary.Left as BuiltinNode;
  assert.equal(count.Name, "count");
  assert.equal(count.Threshold, 51); // threshold = N + 1 for <= operator
});

// TestOptimize_count_threshold_correctness — PORTED
test("TestOptimize_count_threshold_correctness", () => {
  // PORTED
  const tests: Array<[string, boolean]> = [
    ["count(1..1000, # <= 100) > 50", true],
    ["count(1..1000, # <= 100) > 100", false],
    ["count(1..1000, # <= 100) > 99", true],
    ["count(1..100, # > 0) > 50", true],
    ["count(1..100, # > 0) > 100", false],
    ["count(1..1000, # <= 100) >= 100", true],
    ["count(1..1000, # <= 100) >= 101", false],
    ["count(1..100, # > 0) >= 50", true],
    ["count(1..100, # > 0) >= 100", true],
    ["count(1..1000, # <= 100) < 101", true],
    ["count(1..1000, # <= 100) < 100", false],
    ["count(1..1000, # <= 100) < 50", false],
    ["count(1..100, # > 0) < 101", true],
    ["count(1..100, # > 0) < 100", false],
    ["count(1..1000, # <= 100) <= 100", true],
    ["count(1..1000, # <= 100) <= 99", false],
    ["count(1..1000, # <= 100) <= 50", false],
    ["count(1..100, # > 0) <= 100", true],
    ["count(1..100, # > 0) <= 99", false],
  ];
  for (const [expr, want] of tests) {
    const output = Run(Compile(expr), null);
    assert.equal(output, want, expr);
  }
});

// TestOptimize_count_threshold_no_optimization — PORTED
test("TestOptimize_count_threshold_no_optimization", () => {
  // PORTED
  const tests: Array<[string, boolean]> = [
    ["count(items, .active) > 0", false],
    ["count(items, .active) >= 1", false],
    ["count(items, .active) < 1", false],
    ["count(items, .active) <= 0", false],
    ["count(items, .active) == 10", false],
  ];
  for (const [code, threshold] of tests) {
    const tree = Parse(code);
    const ref = { node: tree.Node };
    Optimize(ref, null);

    let count: BuiltinNode | null = null;
    if (ref.node instanceof BinaryNode && ref.node.Left instanceof BuiltinNode) {
      count = ref.node.Left;
    } else if (ref.node instanceof BuiltinNode) {
      count = ref.node;
    }
    if (count !== null && count.Name === "count") {
      if (threshold) {
        assert.notEqual(count.Threshold, null, "expected threshold to be set");
      } else {
        assert.equal(count.Threshold, null, "expected threshold to be nil");
      }
    }
  }
});

// PORTED: 6, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0 (8 benchmarks excluded)
