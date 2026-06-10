// Port of expr-lang/expr optimizer/sum_map.go
import { Node, BuiltinNode } from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { patchCopyType } from "./optimizer.js";

export class sumMap implements Visitor {
  Visit(node: NodeRef): void {
    const sumBuiltin = node.node;
    if (
      sumBuiltin instanceof BuiltinNode &&
      sumBuiltin.Name === "sum" &&
      sumBuiltin.Arguments.length === 1
    ) {
      const mapBuiltin = sumBuiltin.Arguments[0]!;
      if (
        mapBuiltin instanceof BuiltinNode &&
        mapBuiltin.Name === "map" &&
        mapBuiltin.Arguments.length === 2
      ) {
        const args: Node[] = [mapBuiltin.Arguments[0]!, mapBuiltin.Arguments[1]!];
        patchCopyType(node, new BuiltinNode("sum", args));
      }
    }
  }
}
