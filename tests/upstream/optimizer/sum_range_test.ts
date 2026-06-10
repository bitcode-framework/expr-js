// Port of expr-lang/expr optimizer/sum_range_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { IntegerNode, BuiltinNode } from "../../../src/ast/node.js";
import { Dump } from "../../../src/ast/dump.js";
import { Optimize } from "../../../src/optimizer/optimizer.js";
import { Parse } from "../../../src/parser/parser.js";
import { Compile, Run } from "../../../src/expr.js";

// TestOptimize_sum_range — PORTED
test("TestOptimize_sum_range", () => {
  // PORTED
  const tree = Parse("sum(1..100)");
  const ref = { node: tree.Node };
  Optimize(ref, null);
  assert.equal(Dump(ref.node), Dump(new IntegerNode(5050n)));
});

// TestOptimize_sum_range_different_values — PORTED
test("TestOptimize_sum_range_different_values", () => {
  // PORTED
  const tests: Array<[string, number]> = [
    ["sum(1..10)", 55],
    ["sum(1..100)", 5050],
    ["sum(5..10)", 45],
    ["sum(0..100)", 5050],
    ["sum(1..1)", 1],
    ["sum(0..0)", 0],
    ["sum(10..20)", 165],
  ];
  for (const [expr, want] of tests) {
    const output = Run(Compile(expr), null);
    assert.equal(Number(output), want, expr);
  }
});

// TestOptimize_sum_range_with_predicate — PORTED
test("TestOptimize_sum_range_with_predicate", () => {
  // PORTED
  const tests: Array<[string, number]> = [
    ["sum(1..10, #)", 55],
    ["sum(1..100, #)", 5050],
    ["sum(1..10, # * 2)", 110],
    ["sum(1..100, # * 2)", 10100],
    ["sum(1..10, # * 0)", 0],
    ["sum(1..10, # * 1)", 55],
    ["sum(1..10, 2 * #)", 110],
    ["sum(1..100, 3 * #)", 15150],
    ["sum(1..10, # + 1)", 65],
    ["sum(1..100, # + 1)", 5150],
    ["sum(1..10, # + 0)", 55],
    ["sum(1..10, # + 10)", 155],
    ["sum(1..10, 1 + #)", 65],
    ["sum(1..100, 5 + #)", 5550],
    ["sum(1..10, # - 1)", 45],
    ["sum(1..100, # - 1)", 4950],
    ["sum(1..10, # - 0)", 55],
    ["sum(1..10, 10 - #)", 45],
    ["sum(1..10, 0 - #)", -55],
  ];
  for (const [expr, want] of tests) {
    const output = Run(Compile(expr), null);
    assert.equal(Number(output), want, expr);
  }
});

// TestOptimize_sum_range_with_predicate_ast — PORTED
test("TestOptimize_sum_range_with_predicate_ast", () => {
  // PORTED
  const tree = Parse("sum(1..10, # * 2)");
  const ref = { node: tree.Node };
  Optimize(ref, null);
  assert.equal(Dump(ref.node), Dump(new IntegerNode(110n)));
});

// TestOptimize_reduce_range_sum — PORTED
test("TestOptimize_reduce_range_sum", () => {
  // PORTED
  const tree = Parse("reduce(1..100, # + #acc)");
  const ref = { node: tree.Node };
  Optimize(ref, null);
  assert.equal(Dump(ref.node), Dump(new IntegerNode(5050n)));
});

// TestOptimize_reduce_range_sum_different_values — PORTED
test("TestOptimize_reduce_range_sum_different_values", () => {
  // PORTED
  const tests: Array<[string, number]> = [
    ["reduce(1..10, # + #acc)", 55],
    ["reduce(1..100, # + #acc)", 5050],
    ["reduce(5..10, # + #acc)", 45],
    ["reduce(0..100, # + #acc)", 5050],
    ["reduce(1..1, # + #acc)", 1],
    ["reduce(10..20, # + #acc)", 165],
  ];
  for (const [expr, want] of tests) {
    const output = Run(Compile(expr), null);
    assert.equal(Number(output), want, expr);
  }
});

// TestOptimize_reduce_range_sum_reverse_order — PORTED
test("TestOptimize_reduce_range_sum_reverse_order", () => {
  // PORTED
  const tree = Parse("reduce(1..100, #acc + #)");
  const ref = { node: tree.Node };
  Optimize(ref, null);
  assert.equal(Dump(ref.node), Dump(new IntegerNode(5050n)));
});

// TestOptimize_reduce_range_sum_with_initial_value — PORTED
test("TestOptimize_reduce_range_sum_with_initial_value", () => {
  // PORTED
  const tree = Parse("reduce(1..100, # + #acc, 10)");
  const ref = { node: tree.Node };
  Optimize(ref, null);
  assert.equal(Dump(ref.node), Dump(new IntegerNode(5060n)));
});

// TestOptimize_reduce_range_sum_with_initial_value_different_values — PORTED
test("TestOptimize_reduce_range_sum_with_initial_value_different_values", () => {
  // PORTED
  const tests: Array<[string, number]> = [
    ["reduce(1..10, # + #acc, 0)", 55],
    ["reduce(1..10, # + #acc, 10)", 65],
    ["reduce(1..100, # + #acc, 0)", 5050],
    ["reduce(1..100, # + #acc, 100)", 5150],
    ["reduce(5..10, # + #acc, 5)", 50],
  ];
  for (const [expr, want] of tests) {
    const output = Run(Compile(expr), null);
    assert.equal(Number(output), want, expr);
  }
});

// TestOptimize_sum_range_reversed — PORTED
test("TestOptimize_sum_range_reversed", () => {
  // PORTED
  const tests: Array<[string, number]> = [
    ["sum(10..1)", 0],
    ["sum(5..3)", 0],
    ["sum(100..1)", 0],
  ];
  for (const [expr, want] of tests) {
    const output = Run(Compile(expr), null);
    assert.equal(Number(output), want, expr);
  }
});

// TestOptimize_sum_range_reversed_not_optimized — PORTED
test("TestOptimize_sum_range_reversed_not_optimized", () => {
  // PORTED
  const tree = Parse("sum(10..1)");
  const ref = { node: tree.Node };
  Optimize(ref, null);
  assert.ok(ref.node instanceof BuiltinNode, "reversed range should not be optimized");
});

// TestOptimize_reduce_range_reversed_errors — PORTED
test("TestOptimize_reduce_range_reversed_errors", () => {
  // PORTED
  const program = Compile("reduce(10..1, # + #acc)");
  assert.throws(() => {
    Run(program, null);
  }, "reduce on empty range should error");
});

// PORTED: 12, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0 (3 benchmarks excluded)
