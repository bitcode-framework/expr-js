// Port of expr-lang/expr patcher/value/value.go
//
// Provides a Patcher (ValueGetter) that lets custom types expose themselves as
// standard values in expressions, via "valuer" interfaces (AsInt, AsString...).
//
// DIVERGENCE (FORCED_DIVERGENCE): Go detects valuer interfaces at compile time
// via reflect (`nodeType.Implements(t)`) and dispatches at runtime via a type
// switch. JavaScript has no interfaces or reflect. This port:
//   - compile time: the patcher cannot know a node's Go interface set (no
//     static type info for arbitrary JS values), so the AST patch is applied
//     conservatively only when the checker Nature is a struct/identifier whose
//     value is unknown. In practice the runtime getValue() below handles the
//     conversion regardless, so behavior is preserved for evaluation.
//   - runtime: getValue() duck-types the value, checking for AsAny/AsInt/...
//     methods in the same priority order as the Go type switch.
import { Option } from "../../expr.js";
import { Config } from "../../conf/config.js";
import {
  Node,
  IdentifierNode,
  MemberNode,
  CallNode,
  Patch,
} from "../../ast/node.js";
import type { NodeRef, Visitor } from "../../ast/visitor.js";
import { Func } from "../../builtin/function.js";
import { VALUER_METHODS } from "./valuer_methods.generated.js";

// getValue duck-types the first param against the valuer methods, mirroring the
// Go type switch order. Returns the converted value, or the value unchanged.
export function getValue(...params: any[]): any {
  const v = params[0];
  if (v !== null && v !== undefined) {
    for (const m of VALUER_METHODS) {
      if (typeof v[m] === "function") {
        return v[m]();
      }
    }
  }
  return params[0];
}

// patcher rewrites Identifier/Member nodes whose value implements a valuer
// interface into a $patcher_value_getter(...) call.
//
// The TS port detects valuer types by checking if the node's Nature type has
// any valuer methods (AsInt, AsAny, AsString, etc.) registered in its methods
// map. This works when the env is marked with markStruct() and valuer-typed
// fields have their method sets declared.
class ValuePatcher implements Visitor {
  Visit(nodeRef: NodeRef): void {
    const node = nodeRef.node;
    if (!(node instanceof IdentifierNode) && !(node instanceof MemberNode)) {
      return;
    }
    // Don't re-wrap nodes that are already $patcher_value_getter calls.
    if (node instanceof CallNode) {
      return;
    }
    const t = node.Type();
    if (t === null) {
      return;
    }
    // Check if the type has any valuer methods.
    if (hasValuerMethods(t)) {
      Patch(nodeRef, wrapWithGetter(node));
    }
  }
}

// hasValuerMethods returns true if the type has at least one valuer method
// (AsAny, AsInt, AsString, etc.) in its methods map.
function hasValuerMethods(t: import("../../checker/nature/type.js").Type): boolean {
  for (const m of VALUER_METHODS) {
    if (t.methods.has(m)) {
      return true;
    }
  }
  return false;
}

// markGetterApplied is kept to mirror Go's wrapping helper for tests that build
// the call manually.
export function wrapWithGetter(node: Node): CallNode {
  const callee = new IdentifierNode("$patcher_value_getter");
  const call = new CallNode(callee, [node]);
  return call;
}

void Patch;
void IdentifierNode;
void MemberNode;

// getValueFunc registers $patcher_value_getter as a custom function.
function getValueFunc(c: Config): void {
  c.Functions.set(
    "$patcher_value_getter",
    new Func({ Name: "$patcher_value_getter", Func: getValue }),
  );
}

// ValueGetter is an Option that installs the patcher + getter function.
export const ValueGetter: Option = (c: Config) => {
  c.Visitors.push(new ValuePatcher());
  getValueFunc(c);
};
