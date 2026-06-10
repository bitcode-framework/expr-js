// Port of expr-lang/expr optimizer/count_any.go
import { BinaryNode, BuiltinNode, IntegerNode } from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { patchCopyType } from "./optimizer.js";

// countAny optimizes count comparisons to use any for early termination.
// Patterns:
//   - count(arr, pred) > 0  -> any(arr, pred)
//   - count(arr, pred) >= 1 -> any(arr, pred)
export class countAny implements Visitor {
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
    if (!(integer instanceof IntegerNode)) {
      return;
    }
    if (
      (binary.Operator === ">" && integer.Value === 0n) ||
      (binary.Operator === ">=" && integer.Value === 1n)
    ) {
      patchCopyType(node, new BuiltinNode("any", count.Arguments));
    }
  }
}
