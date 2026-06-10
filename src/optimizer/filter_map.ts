// Port of expr-lang/expr optimizer/filter_map.go
import { Node, BuiltinNode, PredicateNode, PointerNode } from "../ast/node.js";
import { Find } from "../ast/find.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { patchCopyType } from "./optimizer.js";

export class filterMap implements Visitor {
  Visit(node: NodeRef): void {
    const mapBuiltin = node.node;
    if (
      mapBuiltin instanceof BuiltinNode &&
      mapBuiltin.Name === "map" &&
      mapBuiltin.Arguments.length === 2 &&
      Find(mapBuiltin.Arguments[1]!, isIndexPointer) === null
    ) {
      const predicate = mapBuiltin.Arguments[1]!;
      if (predicate instanceof PredicateNode) {
        const filter = mapBuiltin.Arguments[0]!;
        if (
          filter instanceof BuiltinNode &&
          filter.Name === "filter" &&
          filter.Map === null /* not already optimized */
        ) {
          const b = new BuiltinNode("filter", filter.Arguments);
          b.Map = predicate.Node;
          patchCopyType(node, b);
        }
      }
    }
  }
}

function isIndexPointer(node: Node): boolean {
  if (node instanceof PointerNode && node.Name === "index") {
    return true;
  }
  return false;
}
