// Port of expr-lang/expr optimizer/sum_array.go
import { Node, BuiltinNode, ArrayNode, BinaryNode } from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { patchCopyType } from "./optimizer.js";

export class sumArray implements Visitor {
  Visit(node: NodeRef): void {
    const sumBuiltin = node.node;
    if (
      sumBuiltin instanceof BuiltinNode &&
      sumBuiltin.Name === "sum" &&
      sumBuiltin.Arguments.length === 1
    ) {
      const array = sumBuiltin.Arguments[0]!;
      if (array instanceof ArrayNode && array.Nodes.length >= 2) {
        patchCopyType(node, sumArrayFold(array));
      }
    }
  }
}

function sumArrayFold(array: ArrayNode): BinaryNode {
  if (array.Nodes.length > 2) {
    return new BinaryNode(
      "+",
      array.Nodes[0]!,
      sumArrayFold(new ArrayNode(array.Nodes.slice(1))),
    );
  } else if (array.Nodes.length === 2) {
    return new BinaryNode("+", array.Nodes[0]!, array.Nodes[1]!);
  }
  throw new Error(`sumArrayFold: invalid array length ${array.Nodes.length}`);
}

export type _NodeAlias = Node;
