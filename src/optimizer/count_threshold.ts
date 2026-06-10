// Port of expr-lang/expr optimizer/count_threshold.go
import { BinaryNode, BuiltinNode, IntegerNode } from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";

// countThreshold optimizes count comparisons by setting a threshold for early
// termination. The threshold allows the count loop to exit early once enough
// matches are found.
// Patterns:
//   - count(arr, pred) > N  -> threshold = N + 1 (exit proves > N is true)
//   - count(arr, pred) >= N -> threshold = N (exit proves >= N is true)
//   - count(arr, pred) < N  -> threshold = N (exit proves < N is false)
//   - count(arr, pred) <= N -> threshold = N + 1 (exit proves <= N is false)
//
// DIVERGENCE: Go uses int for Threshold; IntegerNode.Value is bigint here so
// arithmetic is done with bigint, then stored as a JS number (BuiltinNode
// .Threshold is number | null) to match the node shape.
export class countThreshold implements Visitor {
  Visit(node: NodeRef): void {
    const binary = node.node;
    if (!(binary instanceof BinaryNode)) {
      return;
    }
    const count = binary.Left;
    if (
      !(count instanceof BuiltinNode) ||
      count.Name !== "count" ||
      count.Arguments.length !== 2
    ) {
      return;
    }
    const integer = binary.Right;
    if (!(integer instanceof IntegerNode) || integer.Value < 0n) {
      return;
    }

    let threshold: bigint;
    switch (binary.Operator) {
      case ">":
        threshold = integer.Value + 1n;
        break;
      case ">=":
        threshold = integer.Value;
        break;
      case "<":
        threshold = integer.Value;
        break;
      case "<=":
        threshold = integer.Value + 1n;
        break;
      default:
        return;
    }

    // Skip if threshold is 0 or 1 (handled by count_any optimizer)
    if (threshold <= 1n) {
      return;
    }

    // Set threshold on the count node for early termination.
    // The original comparison remains unchanged.
    count.Threshold = Number(threshold);
  }
}
