// Port of expr-lang/expr optimizer/in_range.go
import { BinaryNode, IntegerNode } from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { Kind } from "../checker/nature/kind.js";
import { patchCopyType } from "./optimizer.js";

export class inRange implements Visitor {
  Visit(node: NodeRef): void {
    const n = node.node;
    if (!(n instanceof BinaryNode)) {
      return;
    }
    if (n.Operator !== "in") {
      return;
    }
    const t = n.Left.Type();
    if (t === null) {
      return;
    }
    if (t.Kind() !== Kind.Int) {
      return;
    }
    const rangeOp = n.Right;
    if (!(rangeOp instanceof BinaryNode) || rangeOp.Operator !== "..") {
      return;
    }
    const from = rangeOp.Left;
    if (!(from instanceof IntegerNode)) {
      return;
    }
    const to = rangeOp.Right;
    if (!(to instanceof IntegerNode)) {
      return;
    }
    patchCopyType(
      node,
      new BinaryNode(
        "and",
        new BinaryNode(">=", n.Left, from),
        new BinaryNode("<=", n.Left, to),
      ),
    );
  }
}
