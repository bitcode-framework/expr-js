// Port of expr-lang/expr optimizer/in_array.go
import {
  Node,
  BinaryNode,
  ArrayNode,
  IntegerNode,
  StringNode,
  ConstantNode,
} from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { Kind } from "../checker/nature/kind.js";
import { MapOf, intType, anyType } from "../checker/nature/type.js";
import { patchCopyType } from "./optimizer.js";

export class inArray implements Visitor {
  Visit(node: NodeRef): void {
    const n = node.node;
    if (!(n instanceof BinaryNode)) {
      return;
    }
    if (n.Operator !== "in") {
      return;
    }
    const array = n.Right;
    if (!(array instanceof ArrayNode)) {
      return;
    }
    if (array.Nodes.length === 0) {
      return;
    }

    // Go uses a goto string label to fall through when the int-set
    // optimization is not applicable. We replicate that control flow with a
    // helper that builds the string-set instead.
    const buildStringSet = (): void => {
      for (const a of array.Nodes) {
        if (!(a instanceof StringNode)) {
          return;
        }
      }
      // map[string]struct{} -> JS Set<string>
      const value = new Set<string>();
      for (const a of array.Nodes) {
        value.add((a as StringNode).Value);
      }
      const m = new ConstantNode(value);
      m.SetType(MapOf(intType, anyType));
      patchCopyType(node, new BinaryNode(n.Operator, n.Left, m));
    };

    const t = n.Left.Type();
    // This optimization can be only performed if left side is int type,
    // as runtime.in func uses reflect.Map.MapIndex and keys of map must,
    // be same as checked value type.
    if (t === null || t.Kind() !== Kind.Int) {
      buildStringSet();
      return;
    }

    for (const a of array.Nodes) {
      if (!(a instanceof IntegerNode)) {
        buildStringSet();
        return;
      }
    }
    {
      // map[int]struct{} -> JS Set<bigint> (IntegerNode value is bigint).
      const value = new Set<bigint>();
      for (const a of array.Nodes) {
        value.add((a as IntegerNode).Value);
      }
      const m = new ConstantNode(value);
      m.SetType(MapOf(intType, anyType));
      patchCopyType(node, new BinaryNode(n.Operator, n.Left, m));
    }

    // After the int branch, Go falls through to the `string:` label and then
    // re-checks. Since all nodes were IntegerNodes, the string check fails on
    // the first element and returns, leaving the int-set patch in place. We
    // do not call buildStringSet() here, matching the effective behavior.
  }
}

// Suppress unused import when Node is only referenced by other modules.
export type _NodeAlias = Node;
