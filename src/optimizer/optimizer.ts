// Port of expr-lang/expr optimizer/optimizer.go
import {
  Node,
  BoolNode,
  IntegerNode,
  FloatNode,
  StringNode,
  ConstantNode,
  BinaryNode,
  Patch,
} from "../ast/node.js";
import { Walk, NodeRef } from "../ast/visitor.js";
import { Config } from "../conf/config.js";
import {
  boolType,
  intType as integerType,
  floatType,
  stringType,
} from "../checker/nature/type.js";
import { NatureOf } from "../checker/nature/nature.js";

import { inArray } from "./in_array.js";
import { fold } from "./fold.js";
import { constExpr } from "./const_expr.js";
import { inRange } from "./in_range.js";
import { filterMap } from "./filter_map.js";
import { filterLen } from "./filter_len.js";
import { filterLast } from "./filter_last.js";
import { filterFirst } from "./filter_first.js";
import { predicateCombination } from "./predicate_combination.js";
import { sumRange } from "./sum_range.js";
import { sumArray } from "./sum_array.js";
import { sumMap } from "./sum_map.js";
import { countAny } from "./count_any.js";
import { countThreshold } from "./count_threshold.js";

// Optimize mirrors Go's Optimize(node *Node, config *conf.Config) error.
// DIVERGENCE: Go returns an error; this port throws the FileError instead.
// `node` is a mutable NodeRef ({ node: Node }) because Go passes *Node and
// uses ast.Patch to replace the pointed-to node.
export function Optimize(node: NodeRef, config: Config | null): void {
  Walk(node, new inArray());
  for (let limit = 1000; limit >= 0; limit--) {
    const f = new fold();
    Walk(node, f);
    if (f.err !== null) {
      throw f.err;
    }
    if (!f.applied) {
      break;
    }
  }
  if (config !== null && config.ConstFns.size > 0) {
    for (let limit = 100; limit >= 0; limit--) {
      const c = new constExpr(config.ConstFns);
      Walk(node, c);
      if (c.err !== null) {
        throw c.err;
      }
      if (!c.applied) {
        break;
      }
    }
  }
  Walk(node, new inRange());
  Walk(node, new filterMap());
  Walk(node, new filterLen());
  Walk(node, new filterLast());
  Walk(node, new filterFirst());
  Walk(node, new predicateCombination());
  Walk(node, new sumRange());
  Walk(node, new sumArray());
  Walk(node, new sumMap());
  Walk(node, new countAny());
  Walk(node, new countThreshold());
}

// patchWithType sets a reflect-derived type on newNode and patches it in.
// DIVERGENCE: Go uses reflect.TypeOf for the concrete kinds; this port uses
// the checker's Type constants and NatureOf for ConstantNode values.
export function patchWithType(node: NodeRef, newNode: Node): void {
  if (newNode instanceof BoolNode) {
    newNode.SetType(boolType);
  } else if (newNode instanceof IntegerNode) {
    newNode.SetType(integerType);
  } else if (newNode instanceof FloatNode) {
    newNode.SetType(floatType);
  } else if (newNode instanceof StringNode) {
    newNode.SetType(stringType);
  } else if (newNode instanceof ConstantNode) {
    const t = NatureOf(newNode.Value).Type;
    if (t !== null) {
      newNode.SetType(t);
    }
  } else if (newNode instanceof BinaryNode) {
    newNode.SetType(newNode.Type());
  } else {
    throw new Error(`unknown type ${(newNode as object)?.constructor?.name}`);
  }
  Patch(node, newNode);
}

export function patchCopyType(node: NodeRef, newNode: Node): void {
  const t = node.node.Type();
  newNode.SetType(t);
  Patch(node, newNode);
}
