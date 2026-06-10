// Port of expr-lang/expr optimizer/const_expr.go
import {
  Node,
  CallNode,
  IdentifierNode,
  NilNode,
  IntegerNode,
  FloatNode,
  BoolNode,
  StringNode,
  ConstantNode,
} from "../ast/node.js";
import { Visitor, NodeRef } from "../ast/visitor.js";
import { FileError } from "../file/error.js";
import { patchWithType } from "./optimizer.js";

// constExpr evaluates calls to const functions at compile time.
// DIVERGENCE: Go uses reflect.Value.Call and an errorType check on the second
// return value. JS functions return a single value; if a const fn throws, we
// capture it as a FileError (mirroring Go's recover()). If a const fn returns a
// 2-tuple [value, error] we honor it to match Go's (value, error) convention.
export class constExpr implements Visitor {
  applied = false;
  err: FileError | null = null;
  fns: Map<string, any>;

  constructor(fns: Map<string, any>) {
    this.fns = fns;
  }

  Visit(node: NodeRef): void {
    try {
      this.visitImpl(node);
    } catch (r) {
      let msg = `${(r as any)?.message ?? r}`;
      // Make message more actual, it's a runtime error, but at compile step.
      msg = msg.replace("runtime error:", "compile error:");
      this.err = new FileError({
        location: node.node.Location(),
        message: msg,
      });
    }
  }

  private visitImpl(node: NodeRef): void {
    const call = node.node;
    if (!(call instanceof CallNode)) {
      return;
    }
    const name = call.Callee;
    if (!(name instanceof IdentifierNode)) {
      return;
    }
    const fn = this.fns.get(name.Value);
    if (fn === undefined) {
      return;
    }

    const args: any[] = new Array(call.Arguments.length);
    for (let i = 0; i < call.Arguments.length; i++) {
      const arg = call.Arguments[i]!;
      let param: any;
      if (arg instanceof NilNode) {
        param = null;
      } else if (arg instanceof IntegerNode) {
        param = arg.Value;
      } else if (arg instanceof FloatNode) {
        param = arg.Value;
      } else if (arg instanceof BoolNode) {
        param = arg.Value;
      } else if (arg instanceof StringNode) {
        param = arg.Value;
      } else if (arg instanceof ConstantNode) {
        param = arg.Value;
      } else {
        return; // Const expr optimization not applicable.
      }
      args[i] = param;
    }

    const out = fn(...args);
    let value = out;
    // Honor Go's (value, error) two-return convention when a fn returns a
    // tuple whose second element is an Error.
    if (Array.isArray(out) && out.length === 2 && out[1] instanceof Error) {
      if (out[1] !== null) {
        this.err = out[1] as FileError;
        return;
      }
      value = out[0];
    }
    const constNode = new ConstantNode(value);
    patchWithType(node, constNode);
    this.applied = true;
  }
}

export type _NodeAlias = Node;
