// Port of expr-lang/expr optimizer/fold.go
import {
  Node,
  UnaryNode,
  BinaryNode,
  ArrayNode,
  BuiltinNode,
  IntegerNode,
  FloatNode,
  StringNode,
  BoolNode,
  ConstantNode,
  PredicateNode,
} from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { FileError } from "../file/error.js";
import { patchWithType, patchCopyType } from "./optimizer.js";

// fold performs constant folding.
//
// NUMERIC MODEL: IntegerNode.Value is bigint (Go int/int64); FloatNode.Value is
// number (Go float64). Arithmetic mirrors fold.go's explicit type-pair logic:
//   int  op int  -> bigint result (IntegerNode), or float for "/" and "**"/"^"
//   any  op float-> number result (FloatNode), float64(int) == Number(bigint)
// DIVERGENCE: The task suggested importing runtime.Add/Subtract/etc. We instead
// reproduce fold.go's exact per-type-pair native arithmetic, which is
// semantically identical to the runtime ops for these constant node kinds and
// keeps a 1:1 structural mapping with the Go source. Integer division and
// power follow Go: int/int and int**int both yield float64 (FloatNode).
export class fold implements Visitor {
  applied = false;
  err: FileError | null = null;

  Visit(node: NodeRef): void {
    const n = node.node;
    if (n instanceof UnaryNode) {
      this.visitUnary(node, n);
    } else if (n instanceof BinaryNode) {
      this.visitBinary(node, n);
    } else if (n instanceof ArrayNode) {
      this.visitArray(node, n);
    } else if (n instanceof BuiltinNode) {
      this.visitBuiltin(node, n);
    }
  }

  private patch(node: NodeRef, newNode: Node): void {
    this.applied = true;
    patchWithType(node, newNode);
  }

  private patchCopy(node: NodeRef, newNode: Node): void {
    this.applied = true;
    patchCopyType(node, newNode);
  }

  private visitUnary(node: NodeRef, n: UnaryNode): void {
    switch (n.Operator) {
      case "-": {
        const i = n.Node;
        if (i instanceof IntegerNode) {
          this.patch(node, new IntegerNode(-i.Value));
        }
        if (i instanceof FloatNode) {
          this.patch(node, new FloatNode(-i.Value));
        }
        break;
      }
      case "+": {
        const i = n.Node;
        if (i instanceof IntegerNode) {
          this.patch(node, new IntegerNode(i.Value));
        }
        if (i instanceof FloatNode) {
          this.patch(node, new FloatNode(i.Value));
        }
        break;
      }
      case "!":
      case "not": {
        const a = toBool(n.Node);
        if (a !== null) {
          this.patch(node, new BoolNode(!a.Value));
        }
        break;
      }
    }
  }

  private visitBinary(node: NodeRef, n: BinaryNode): void {
    switch (n.Operator) {
      case "+": {
        this.foldAdd(node, n);
        break;
      }
      case "-": {
        this.foldArith(node, n, (a, b) => a - b, (a, b) => a - b);
        break;
      }
      case "*": {
        this.foldArith(node, n, (a, b) => a * b, (a, b) => a * b);
        break;
      }
      case "/": {
        // Go: every numeric pair folds to FloatNode (float64 division).
        this.foldDivide(node, n);
        break;
      }
      case "%": {
        const a = n.Left;
        const b = n.Right;
        if (a instanceof IntegerNode && b instanceof IntegerNode) {
          if (b.Value === 0n) {
            this.err = new FileError({
              location: node.node.Location(),
              message: "integer divide by zero",
            });
            return;
          }
          // Go uses Go's % (truncated remainder); bigint % matches.
          this.patch(node, new IntegerNode(a.Value % b.Value));
        }
        break;
      }
      case "**":
      case "^": {
        // Go: math.Pow over float64 for all numeric pairs -> FloatNode.
        this.foldPow(node, n);
        break;
      }
      case "and":
      case "&&": {
        const a = toBool(n.Left);
        const b = toBool(n.Right);
        if (a !== null && a.Value) {
          // true and x
          this.patchCopy(node, n.Right);
        } else if (b !== null && b.Value) {
          // x and true
          this.patchCopy(node, n.Left);
        } else if ((a !== null && !a.Value) || (b !== null && !b.Value)) {
          // "x and false" or "false and x"
          this.patch(node, new BoolNode(false));
        }
        break;
      }
      case "or":
      case "||": {
        const a = toBool(n.Left);
        const b = toBool(n.Right);
        if (a !== null && !a.Value) {
          // false or x
          this.patchCopy(node, n.Right);
        } else if (b !== null && !b.Value) {
          // x or false
          this.patchCopy(node, n.Left);
        } else if ((a !== null && a.Value) || (b !== null && b.Value)) {
          // "x or true" or "true or x"
          this.patch(node, new BoolNode(true));
        }
        break;
      }
      case "==": {
        this.foldEqual(node, n);
        break;
      }
    }
  }

  // foldAdd handles "+" for int/float pairs and string concatenation.
  private foldAdd(node: NodeRef, n: BinaryNode): void {
    {
      const a = toInteger(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new IntegerNode(a.Value + b.Value));
      }
    }
    {
      const a = toInteger(n.Left);
      const b = toFloat(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(Number(a.Value) + b.Value));
      }
    }
    {
      const a = toFloat(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(a.Value + Number(b.Value)));
      }
    }
    {
      const a = toFloat(n.Left);
      const b = toFloat(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(a.Value + b.Value));
      }
    }
    {
      const a = toStr(n.Left);
      const b = toStr(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new StringNode(a.Value + b.Value));
      }
    }
  }

  // foldArith handles "-" and "*": int/int -> Integer, mixed/float -> Float.
  private foldArith(
    node: NodeRef,
    n: BinaryNode,
    iop: (a: bigint, b: bigint) => bigint,
    fop: (a: number, b: number) => number,
  ): void {
    {
      const a = toInteger(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new IntegerNode(iop(a.Value, b.Value)));
      }
    }
    {
      const a = toInteger(n.Left);
      const b = toFloat(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(fop(Number(a.Value), b.Value)));
      }
    }
    {
      const a = toFloat(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(fop(a.Value, Number(b.Value))));
      }
    }
    {
      const a = toFloat(n.Left);
      const b = toFloat(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(fop(a.Value, b.Value)));
      }
    }
  }

  // foldDivide handles "/": Go folds every numeric pair to float64.
  private foldDivide(node: NodeRef, n: BinaryNode): void {
    {
      const a = toInteger(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(Number(a.Value) / Number(b.Value)));
      }
    }
    {
      const a = toInteger(n.Left);
      const b = toFloat(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(Number(a.Value) / b.Value));
      }
    }
    {
      const a = toFloat(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(a.Value / Number(b.Value)));
      }
    }
    {
      const a = toFloat(n.Left);
      const b = toFloat(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(a.Value / b.Value));
      }
    }
  }

  // foldPow handles "**"/"^": math.Pow over float64 -> FloatNode.
  private foldPow(node: NodeRef, n: BinaryNode): void {
    {
      const a = toInteger(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(Math.pow(Number(a.Value), Number(b.Value))));
      }
    }
    {
      const a = toInteger(n.Left);
      const b = toFloat(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(Math.pow(Number(a.Value), b.Value)));
      }
    }
    {
      const a = toFloat(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(Math.pow(a.Value, Number(b.Value))));
      }
    }
    {
      const a = toFloat(n.Left);
      const b = toFloat(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new FloatNode(Math.pow(a.Value, b.Value)));
      }
    }
  }

  // foldEqual handles "==" for int, string and bool pairs.
  private foldEqual(node: NodeRef, n: BinaryNode): void {
    {
      const a = toInteger(n.Left);
      const b = toInteger(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new BoolNode(a.Value === b.Value));
      }
    }
    {
      const a = toStr(n.Left);
      const b = toStr(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new BoolNode(a.Value === b.Value));
      }
    }
    {
      const a = toBool(n.Left);
      const b = toBool(n.Right);
      if (a !== null && b !== null) {
        this.patch(node, new BoolNode(a.Value === b.Value));
      }
    }
  }

  private visitArray(node: NodeRef, n: ArrayNode): void {
    if (n.Nodes.length > 0) {
      for (const a of n.Nodes) {
        if (
          a instanceof IntegerNode ||
          a instanceof FloatNode ||
          a instanceof StringNode ||
          a instanceof BoolNode
        ) {
          continue;
        }
        return;
      }
      const value: any[] = new Array(n.Nodes.length);
      for (let i = 0; i < n.Nodes.length; i++) {
        const b = n.Nodes[i]!;
        if (b instanceof IntegerNode) {
          value[i] = b.Value;
        } else if (b instanceof FloatNode) {
          value[i] = b.Value;
        } else if (b instanceof StringNode) {
          value[i] = b.Value;
        } else if (b instanceof BoolNode) {
          value[i] = b.Value;
        }
      }
      this.patch(node, new ConstantNode(value));
    }
  }

  private visitBuiltin(node: NodeRef, n: BuiltinNode): void {
    // TODO: Move this to a separate visitor filter_filter.go
    switch (n.Name) {
      case "filter": {
        if (n.Arguments.length !== 2) {
          return;
        }
        const base = n.Arguments[0]!;
        if (base instanceof BuiltinNode && base.Name === "filter") {
          const basepred = base.Arguments[1] as PredicateNode;
          const npred = n.Arguments[1] as PredicateNode;
          this.patchCopy(
            node,
            new BuiltinNode("filter", [
              base.Arguments[0]!,
              new PredicateNode(
                new BinaryNode("&&", basepred.Node, npred.Node),
              ),
            ]),
          );
        }
        break;
      }
    }
  }
}

function toStr(n: Node): StringNode | null {
  return n instanceof StringNode ? n : null;
}

function toInteger(n: Node): IntegerNode | null {
  return n instanceof IntegerNode ? n : null;
}

function toFloat(n: Node): FloatNode | null {
  return n instanceof FloatNode ? n : null;
}

function toBool(n: Node): BoolNode | null {
  return n instanceof BoolNode ? n : null;
}
