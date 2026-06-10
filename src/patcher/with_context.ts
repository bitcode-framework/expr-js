// Port of expr-lang/expr patcher/with_context.go
//
// WithContext adds WithContext.Name argument to all function calls whose first
// (or second) parameter is a context.Context.
//
// DIVERGENCE (documented inline): Go has context.Context and identifies it by
// reflect type string "context.Context". JavaScript has no context.Context; this
// port models it faithfully as a parameter whose checker Type descriptor name is
// "context.Context" (see how an env/function would declare such a parameter).
// The injected argument is an IdentifierNode referencing Name, which is expected
// to resolve as an env key lookup at runtime — the closest JS analogue to passing
// a context value.
import {
  type Node,
  CallNode,
  IdentifierNode,
  Patch,
} from "../ast/node.js";
import type { NodeRef } from "../ast/visitor.js";
import { Nature, Cache } from "../checker/nature/nature.js";
import { Type as NatureType } from "../checker/nature/type.js";
import { Kind } from "../checker/nature/kind.js";
import type { FunctionsTable } from "../conf/config.js";

const contextContextName = "context.Context";

export class WithContext {
  Name: string;
  // Optional: used to look up function types when callee type is unknown.
  Functions: FunctionsTable | null;
  // Optional: used to look up method types when callee type is unknown.
  Env: Nature | null;
  // Optional: cache for nature lookups.
  NtCache: Cache | null;

  constructor(init: Partial<WithContext> = {}) {
    this.Name = init.Name ?? "";
    this.Functions = init.Functions ?? null;
    this.Env = init.Env ?? null;
    this.NtCache = init.NtCache ?? null;
  }

  // Visit adds WithContext.Name argument to all function calls with a
  // context.Context argument.
  Visit(node: NodeRef): void {
    const call = node.node;
    if (!(call instanceof CallNode)) {
      return;
    }

    let fn: NatureType | null = call.Callee.Type();
    if (fn === null) {
      return;
    }
    // If callee type is interface{} (unknown), look up the function type from
    // the Functions table or Env. This handles cases where the checker returns
    // early without visiting nested call arguments (e.g., Date2() in
    // Now2().After(Date2())) because the outer call's type is unknown due to
    // missing context arguments.
    if (fn.Kind() === Kind.Interface) {
      if (call.Callee instanceof IdentifierNode) {
        const ident = call.Callee;
        if (this.Functions !== null) {
          const f = this.Functions.get(ident.Value);
          if (f !== undefined) {
            fn = f.Type();
          }
        }
        if (fn !== null && fn.Kind() === Kind.Interface && this.Env !== null) {
          const [m, ok] = this.Env.MethodByName(
            this.NtCache ?? undefined,
            ident.Value,
          );
          if (ok) {
            fn = m.Type;
          }
        }
      }
    }
    if (fn === null || fn.Kind() !== Kind.Func) {
      return;
    }
    switch (fn.NumIn()) {
      case 0:
        return;
      case 1:
        if (fn.In(0).String() !== contextContextName) {
          return;
        }
        break;
      default:
        if (
          fn.In(0).String() !== contextContextName &&
          fn.In(1).String() !== contextContextName
        ) {
          return;
        }
        break;
    }
    const args: Node[] = [new IdentifierNode(this.Name), ...call.Arguments];
    Patch(node, new CallNode(call.Callee, args));
  }
}
