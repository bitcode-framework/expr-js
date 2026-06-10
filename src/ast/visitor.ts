// Port of expr-lang/expr ast/visitor.go
import {
  Node,
  NilNode,
  IdentifierNode,
  IntegerNode,
  FloatNode,
  BoolNode,
  StringNode,
  BytesNode,
  ConstantNode,
  UnaryNode,
  BinaryNode,
  ChainNode,
  MemberNode,
  SliceNode,
  CallNode,
  BuiltinNode,
  PredicateNode,
  PointerNode,
  VariableDeclaratorNode,
  SequenceNode,
  ConditionalNode,
  ArrayNode,
  MapNode,
  PairNode,
} from "./node.js";

// NodeRef models Go's *Node (pointer to a Node interface value).
// Visit may replace ref.node; for child fields/elements the ref writes
// back into the parent so patches propagate, mirroring Go's &n.Field.
export interface NodeRef {
  node: Node;
}

export interface Visitor {
  Visit(node: NodeRef): void;
}

// fieldRef binds a NodeRef to a parent object's property so assignments
// to ref.node write back into the parent, replicating Go's &n.Field.
function fieldRef(obj: Record<string, any>, key: string): NodeRef {
  return {
    get node(): Node {
      return obj[key];
    },
    set node(v: Node) {
      obj[key] = v;
    },
  };
}

// indexRef binds a NodeRef to a slice element, replicating Go's &n.Arguments[i].
function indexRef(arr: Node[], i: number): NodeRef {
  return {
    get node(): Node {
      return arr[i];
    },
    set node(v: Node) {
      arr[i] = v;
    },
  };
}

export function Walk(node: NodeRef, v: Visitor): void {
  const n = node.node;
  if (n == null) {
    return;
  }
  if (n instanceof NilNode) {
    // leaf
  } else if (n instanceof IdentifierNode) {
    // leaf
  } else if (n instanceof IntegerNode) {
    // leaf
  } else if (n instanceof FloatNode) {
    // leaf
  } else if (n instanceof BoolNode) {
    // leaf
  } else if (n instanceof StringNode) {
    // leaf
  } else if (n instanceof BytesNode) {
    // leaf
  } else if (n instanceof ConstantNode) {
    // leaf
  } else if (n instanceof UnaryNode) {
    Walk(fieldRef(n, "Node"), v);
  } else if (n instanceof BinaryNode) {
    Walk(fieldRef(n, "Left"), v);
    Walk(fieldRef(n, "Right"), v);
  } else if (n instanceof ChainNode) {
    Walk(fieldRef(n, "Node"), v);
  } else if (n instanceof MemberNode) {
    Walk(fieldRef(n, "Node"), v);
    Walk(fieldRef(n, "Property"), v);
  } else if (n instanceof SliceNode) {
    Walk(fieldRef(n, "Node"), v);
    if (n.From !== null) {
      Walk(fieldRef(n, "From"), v);
    }
    if (n.To !== null) {
      Walk(fieldRef(n, "To"), v);
    }
  } else if (n instanceof CallNode) {
    Walk(fieldRef(n, "Callee"), v);
    for (let i = 0; i < n.Arguments.length; i++) {
      Walk(indexRef(n.Arguments, i), v);
    }
  } else if (n instanceof BuiltinNode) {
    for (let i = 0; i < n.Arguments.length; i++) {
      Walk(indexRef(n.Arguments, i), v);
    }
  } else if (n instanceof PredicateNode) {
    Walk(fieldRef(n, "Node"), v);
  } else if (n instanceof PointerNode) {
    // leaf
  } else if (n instanceof VariableDeclaratorNode) {
    Walk(fieldRef(n, "Value"), v);
    Walk(fieldRef(n, "Expr"), v);
  } else if (n instanceof SequenceNode) {
    for (let i = 0; i < n.Nodes.length; i++) {
      Walk(indexRef(n.Nodes, i), v);
    }
  } else if (n instanceof ConditionalNode) {
    Walk(fieldRef(n, "Cond"), v);
    Walk(fieldRef(n, "Exp1"), v);
    Walk(fieldRef(n, "Exp2"), v);
  } else if (n instanceof ArrayNode) {
    for (let i = 0; i < n.Nodes.length; i++) {
      Walk(indexRef(n.Nodes, i), v);
    }
  } else if (n instanceof MapNode) {
    for (let i = 0; i < n.Pairs.length; i++) {
      Walk(indexRef(n.Pairs, i), v);
    }
  } else if (n instanceof PairNode) {
    Walk(fieldRef(n, "Key"), v);
    Walk(fieldRef(n, "Value"), v);
  } else {
    throw new Error(`undefined node type (${(n as object)?.constructor?.name})`);
  }

  v.Visit(node);
}
