// Port of expr-lang/expr patcher/with_timezone.go
//
// WithTimezone passes a Location to the date() and now() builtin functions by
// prepending a constant Location argument.
//
// Go uses *time.Location (time.LoadLocation). The TS port uses GoLocation from
// vm/runtime/gotime.ts, which stores the IANA timezone name and is recognized
// by the date()/now() builtins via duck-typing (isGoLocation check).
import {
  BuiltinNode,
  ConstantNode,
  Patch,
  type Node,
} from "../ast/node.js";
import type { NodeRef } from "../ast/visitor.js";

export class WithTimezone {
  // Location is an opaque timezone marker (GoLocation). DIVERGENCE: Go uses
  // *time.Location; here it is the timezone name string or a GoLocationValue.
  Location: any;

  constructor(init: Partial<WithTimezone> = {}) {
    this.Location = init.Location ?? null;
  }

  Visit(node: NodeRef): void {
    const btin = node.node;
    if (btin instanceof BuiltinNode) {
      switch (btin.Name) {
        case "date":
        case "now": {
          const loc = new ConstantNode(this.Location);
          const args: Node[] = [loc, ...btin.Arguments];
          Patch(node, new BuiltinNode(btin.Name, args));
          break;
        }
      }
    }
  }
}
