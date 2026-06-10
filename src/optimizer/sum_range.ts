// Port of expr-lang/expr optimizer/sum_range.go
import {
  Node,
  BuiltinNode,
  BinaryNode,
  IntegerNode,
  PredicateNode,
  PointerNode,
} from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { patchWithType } from "./optimizer.js";

// DIVERGENCE: Go uses int arithmetic; IntegerNode.Value is bigint here, so all
// range arithmetic is done with bigint to preserve int64 semantics.
export class sumRange implements Visitor {
  Visit(node: NodeRef): void {
    // Pattern 1: sum(m..n) or sum(m..n, predicate) where m and n are constant
    // integers.
    const sumBuiltin = node.node;
    if (
      sumBuiltin instanceof BuiltinNode &&
      sumBuiltin.Name === "sum" &&
      (sumBuiltin.Arguments.length === 1 || sumBuiltin.Arguments.length === 2)
    ) {
      const rangeOp = sumBuiltin.Arguments[0]!;
      if (rangeOp instanceof BinaryNode && rangeOp.Operator === "..") {
        const from = rangeOp.Left;
        const to = rangeOp.Right;
        if (from instanceof IntegerNode && to instanceof IntegerNode) {
          const m = from.Value;
          const n = to.Value;
          if (n >= m) {
            const count = n - m + 1n;
            // Use the arithmetic series formula: (n - m + 1) * (m + n) / 2
            const sum = (count * (m + n)) / 2n;

            if (sumBuiltin.Arguments.length === 1) {
              // sum(m..n)
              patchWithType(node, new IntegerNode(sum));
            } else if (sumBuiltin.Arguments.length === 2) {
              // sum(m..n, predicate)
              const [result, ok] = applySumPredicate(
                sum,
                count,
                sumBuiltin.Arguments[1]!,
              );
              if (ok) {
                patchWithType(node, new IntegerNode(result));
              }
            }
          }
        }
      }
    }

    // Pattern 2: reduce(m..n, # + #acc) where m and n are constant integers.
    const reduceBuiltin = node.node;
    if (
      reduceBuiltin instanceof BuiltinNode &&
      reduceBuiltin.Name === "reduce" &&
      (reduceBuiltin.Arguments.length === 2 ||
        reduceBuiltin.Arguments.length === 3)
    ) {
      const rangeOp = reduceBuiltin.Arguments[0]!;
      if (rangeOp instanceof BinaryNode && rangeOp.Operator === "..") {
        const from = rangeOp.Left;
        const to = rangeOp.Right;
        if (from instanceof IntegerNode && to instanceof IntegerNode) {
          if (isPointerPlusAcc(reduceBuiltin.Arguments[1]!)) {
            const m = from.Value;
            const n = to.Value;
            if (n >= m) {
              // Use the arithmetic series formula: (n - m + 1) * (m + n) / 2
              const sum = ((n - m + 1n) * (m + n)) / 2n;

              // Check for optional initialValue (3rd argument).
              if (reduceBuiltin.Arguments.length === 3) {
                const initialValue = reduceBuiltin.Arguments[2]!;
                if (initialValue instanceof IntegerNode) {
                  const result = initialValue.Value + sum;
                  patchWithType(node, new IntegerNode(result));
                }
              } else {
                patchWithType(node, new IntegerNode(sum));
              }
            }
          }
        }
      }
    }
  }
}

// isPointerPlusAcc checks if the node represents `# + #acc` pattern.
function isPointerPlusAcc(node: Node): boolean {
  if (!(node instanceof PredicateNode)) {
    return false;
  }
  const binary = node.Node;
  if (!(binary instanceof BinaryNode)) {
    return false;
  }
  if (binary.Operator !== "+") {
    return false;
  }

  // Check for # + #acc (pointer + accumulator).
  const left = binary.Left;
  const right = binary.Right;
  const leftIsPointer = left instanceof PointerNode;
  const rightIsPointer = right instanceof PointerNode;

  if (leftIsPointer && rightIsPointer) {
    // # + #acc: Left is pointer (Name=""), Right is acc (Name="acc")
    if (left.Name === "" && right.Name === "acc") {
      return true;
    }
    // #acc + #: Left is acc (Name="acc"), Right is pointer (Name="")
    if (left.Name === "acc" && right.Name === "") {
      return true;
    }
  }

  return false;
}

// applySumPredicate tries to compute the result of sum(m..n, predicate) at
// compile time. Returns [result, true] if optimization is possible,
// [0n, false] otherwise.
// Supported predicates:
//   - # (identity): result = sum
//   - # * k (multiply by constant): result = k * sum
//   - k * # (multiply by constant): result = k * sum
//   - # + k (add constant): result = sum + count * k
//   - k + # (add constant): result = sum + count * k
//   - # - k (subtract constant): result = sum - count * k
function applySumPredicate(
  sum: bigint,
  count: bigint,
  predicateArg: Node,
): [bigint, boolean] {
  if (!(predicateArg instanceof PredicateNode)) {
    return [0n, false];
  }

  // Case 1: # (identity) - just return the sum.
  const pNode = predicateArg.Node;
  if (pNode instanceof PointerNode && pNode.Name === "") {
    return [sum, true];
  }

  // Case 2: Binary operations with pointer and constant.
  if (!(pNode instanceof BinaryNode)) {
    return [0n, false];
  }
  const binary = pNode;

  const [pointer, constant, pointerOnLeft] =
    extractPointerAndConstantWithPosition(binary);
  if (pointer === null || constant === null) {
    return [0n, false];
  }

  switch (binary.Operator) {
    case "*":
      // # * k or k * # => k * sum
      return [constant.Value * sum, true];
    case "+":
      // # + k or k + # => sum + count * k
      return [sum + count * constant.Value, true];
    case "-":
      if (pointerOnLeft) {
        // # - k => sum - count * k
        return [sum - count * constant.Value, true];
      }
      // k - # => count * k - sum
      return [count * constant.Value - sum, true];
  }

  return [0n, false];
}

// extractPointerAndConstantWithPosition extracts pointer (#) and integer
// constant from a binary node. Returns [pointer, constant, pointerOnLeft] or
// [null, null, false] if not matching the expected pattern.
function extractPointerAndConstantWithPosition(
  binary: BinaryNode,
): [PointerNode | null, IntegerNode | null, boolean] {
  // Try left=pointer, right=constant.
  const left = binary.Left;
  if (left instanceof PointerNode && left.Name === "") {
    const right = binary.Right;
    if (right instanceof IntegerNode) {
      return [left, right, true];
    }
  }

  // Try left=constant, right=pointer.
  const lc = binary.Left;
  if (lc instanceof IntegerNode) {
    const right = binary.Right;
    if (right instanceof PointerNode && right.Name === "") {
      return [right, lc, false];
    }
  }

  return [null, null, false];
}
