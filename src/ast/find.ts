// Port of expr-lang/expr ast/find.go
import { Node } from "./node.js";
import { Walk, Visitor, NodeRef } from "./visitor.js";

export function Find(node: Node, fn: (node: Node) => boolean): Node | null {
  const v = new finder(fn);
  const ref: NodeRef = { node };
  Walk(ref, v);
  return v.node;
}

class finder implements Visitor {
  node: Node | null = null;
  fn: (node: Node) => boolean;
  constructor(fn: (node: Node) => boolean) {
    this.fn = fn;
  }
  Visit(node: NodeRef): void {
    if (this.fn(node.node)) {
      this.node = node.node;
    }
  }
}
