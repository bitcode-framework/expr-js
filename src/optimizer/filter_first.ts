// Port of expr-lang/expr optimizer/filter_first.go
import { MemberNode, IntegerNode, BuiltinNode } from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { patchCopyType } from "./optimizer.js";

export class filterFirst implements Visitor {
  Visit(node: NodeRef): void {
    const n = node.node;
    if (
      n instanceof MemberNode &&
      n.Property !== null &&
      !n.Optional
    ) {
      const prop = n.Property;
      if (prop instanceof IntegerNode && prop.Value === 0n) {
        const filter = n.Node;
        if (
          filter instanceof BuiltinNode &&
          filter.Name === "filter" &&
          filter.Arguments.length === 2
        ) {
          const b = new BuiltinNode("find", filter.Arguments);
          b.Throws = true; // to match the behavior of filter()[0]
          b.Map = filter.Map;
          patchCopyType(node, b);
        }
      }
    }
    if (
      n instanceof BuiltinNode &&
      n.Name === "first" &&
      n.Arguments.length === 1
    ) {
      const filter = n.Arguments[0]!;
      if (
        filter instanceof BuiltinNode &&
        filter.Name === "filter" &&
        filter.Arguments.length === 2
      ) {
        const b = new BuiltinNode("find", filter.Arguments);
        b.Throws = false; // as first() will return nil if not found
        b.Map = filter.Map;
        patchCopyType(node, b);
      }
    }
  }
}
