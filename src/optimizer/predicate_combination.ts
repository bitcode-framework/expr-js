// Port of expr-lang/expr optimizer/predicate_combination.go
import {
  Node,
  BinaryNode,
  BuiltinNode,
  PredicateNode,
} from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { IsBoolean } from "../parser/operator/operator.js";
import { patchCopyType } from "./optimizer.js";

/*
predicateCombination is a visitor that combines multiple predicate calls into a
single call. For example, the following expression:

	all(x, x > 1) && all(x, x < 10) -> all(x, x > 1 && x < 10)
	any(x, x > 1) || any(x, x < 10) -> any(x, x > 1 || x < 10)
	none(x, x > 1) && none(x, x < 10) -> none(x, x > 1 || x < 10)
*/
export class predicateCombination implements Visitor {
  Visit(node: NodeRef): void {
    const op = node.node;
    if (!(op instanceof BinaryNode) || !IsBoolean(op.Operator)) {
      return;
    }
    const left = op.Left;
    if (!(left instanceof BuiltinNode)) {
      return;
    }
    const [combinedOp, ok] = combinedOperator(left.Name, op.Operator);
    if (!ok) {
      return;
    }
    const right = op.Right;
    if (!(right instanceof BuiltinNode) || right.Name !== left.Name) {
      return;
    }
    const la = left.Arguments[0]!;
    const ra = right.Arguments[0]!;
    if (
      la.Type() === ra.Type() &&
      la.String() === ra.String()
    ) {
      const leftPred = left.Arguments[1] as PredicateNode;
      const rightPred = right.Arguments[1] as PredicateNode;
      const predicate = new PredicateNode(
        new BinaryNode(combinedOp, leftPred.Node, rightPred.Node),
      );
      // Recurse into the new predicate node (Go: v.Visit(&predicate.Node)).
      const ref: NodeRef = {
        get node(): Node {
          return predicate.Node;
        },
        set node(v: Node) {
          predicate.Node = v;
        },
      };
      this.Visit(ref);
      patchCopyType(
        node,
        new BuiltinNode(left.Name, [left.Arguments[0]!, predicate]),
      );
    }
  }
}

function combinedOperator(fn: string, op: string): [string, boolean] {
  if (fn === "all" && (op === "and" || op === "&&")) {
    return [op, true];
  }
  if (fn === "any" && (op === "or" || op === "||")) {
    return [op, true];
  }
  if (fn === "none" && (op === "and" || op === "&&")) {
    switch (op) {
      case "and":
        return ["or", true];
      case "&&":
        return ["||", true];
    }
  }
  return ["", false];
}
