// Port of expr-lang/expr optimizer/filter_len.go
import { BuiltinNode } from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { patchCopyType } from "./optimizer.js";

export class filterLen implements Visitor {
  Visit(node: NodeRef): void {
    const ln = node.node;
    if (
      ln instanceof BuiltinNode &&
      ln.Name === "len" &&
      ln.Arguments.length === 1
    ) {
      const filter = ln.Arguments[0]!;
      if (
        filter instanceof BuiltinNode &&
        filter.Name === "filter" &&
        filter.Arguments.length === 2
      ) {
        patchCopyType(node, new BuiltinNode("count", filter.Arguments));
      }
    }
  }
}
