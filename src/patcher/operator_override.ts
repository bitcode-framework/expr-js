// Port of expr-lang/expr patcher/operator_override.go
//
// OperatorOverloading is an ast.Visitor that replaces a binary operator with a
// function call when a suitable overload (by argument types) exists in either
// the env functions table or the env nature.
//
// DIVERGENCE (documented inline): Go uses reflect.Type for argument matching.
// This port uses the checker Type descriptor (../checker/nature/type.ts). The
// identity comparison `l == argType` becomes typeIdentical (reference- or
// name-based). reflect's `l.Implements(iface)` becomes Type.AssignableTo for
// interface kinds. Where Go has nil reflect.Type, the node layer yields anyType
// instead, so nil checks are retained but rarely trigger.
import {
  type Node,
  BinaryNode,
  CallNode,
  IdentifierNode,
  Patch,
} from "../ast/node.js";
import type { NodeRef } from "../ast/visitor.js";
import { Nature, Cache } from "../checker/nature/nature.js";
import { Type as NatureType } from "../checker/nature/type.js";
import { Kind } from "../checker/nature/kind.js";
import type { Func } from "../builtin/function.js";
import type { FunctionsTable } from "../conf/config.js";

export class OperatorOverloading {
  // Operator token to overload.
  Operator: string;
  // List of function names to replace operator with.
  Overloads: string[];
  // Env type.
  Env: Nature | null;
  // Env functions.
  Functions: FunctionsTable | null;
  // Flag to indicate if any changes were made to the tree.
  private applied: boolean;
  NtCache: Cache | null;

  constructor(init: Partial<OperatorOverloading> = {}) {
    this.Operator = init.Operator ?? "";
    this.Overloads = init.Overloads ?? [];
    this.Env = init.Env ?? null;
    this.Functions = init.Functions ?? null;
    this.applied = false;
    this.NtCache = init.NtCache ?? null;
  }

  Visit(node: NodeRef): void {
    const binaryNode = node.node;
    if (!(binaryNode instanceof BinaryNode)) {
      return;
    }

    if (binaryNode.Operator !== this.Operator) {
      return;
    }

    const leftType = binaryNode.Left.Type();
    const rightType = binaryNode.Right.Type();

    const [ret, fn, ok] = this.FindSuitableOperatorOverload(leftType, rightType);
    if (ok) {
      const newNode = new CallNode(new IdentifierNode(fn), [
        binaryNode.Left,
        binaryNode.Right,
      ]);
      if (ret !== null) {
        newNode.SetType(ret);
      }
      Patch(node, newNode);
      this.applied = true;
    }
  }

  // Tracking must be reset before every walk over the AST tree.
  Reset(): void {
    this.applied = false;
  }

  ShouldRepeat(): boolean {
    return this.applied;
  }

  FindSuitableOperatorOverload(
    l: NatureType | null,
    r: NatureType | null,
  ): [NatureType | null, string, boolean] {
    let result = this.findSuitableOperatorOverloadInFunctions(l, r);
    if (!result[2]) {
      result = this.findSuitableOperatorOverloadInTypes(l, r);
    }
    return result;
  }

  private findSuitableOperatorOverloadInTypes(
    l: NatureType | null,
    r: NatureType | null,
  ): [NatureType | null, string, boolean] {
    if (this.Env === null) {
      return [null, "", false];
    }
    for (const fn of this.Overloads) {
      const [fnType, ok] = this.Env.Get(this.NtCache ?? undefined, fn);
      if (!ok) {
        continue;
      }
      let firstInIndex = 0;
      if (fnType.Method) {
        firstInIndex = 1; // As first argument to method is receiver.
      }
      if (fnType.Type === null) {
        continue;
      }
      const [ret, done] = checkTypeSuits(fnType.Type, l, r, firstInIndex);
      if (done) {
        return [ret, fn, true];
      }
    }
    return [null, "", false];
  }

  private findSuitableOperatorOverloadInFunctions(
    l: NatureType | null,
    r: NatureType | null,
  ): [NatureType | null, string, boolean] {
    if (this.Functions === null) {
      return [null, "", false];
    }
    for (const fn of this.Overloads) {
      const fnType = this.Functions.get(fn);
      if (fnType === undefined) {
        continue;
      }
      const firstInIndex = 0;
      for (const overload of fnType.Types ?? []) {
        const [ret, done] = checkTypeSuits(overload, l, r, firstInIndex);
        if (done) {
          return [ret, fn, true];
        }
      }
    }
    return [null, "", false];
  }

  Check(): void {
    for (const fn of this.Overloads) {
      const envGet =
        this.Env !== null
          ? this.Env.Get(this.NtCache ?? undefined, fn)
          : ([new Nature(), false] as [Nature, boolean]);
      const fnType = envGet[0];
      const foundType = envGet[1];
      const fnFunc = this.Functions !== null ? this.Functions.get(fn) : undefined;
      const foundFunc = fnFunc !== undefined;
      if (
        !foundFunc &&
        (!foundType || fnType.Type === null || fnType.Type.Kind() !== Kind.Func)
      ) {
        throw new Error(
          `function ${fn} for ${this.Operator} operator does not exist in the environment`,
        );
      }

      if (foundType) {
        checkType(fnType, fn, this.Operator);
      }

      if (foundFunc && fnFunc !== undefined) {
        checkFunc(fnFunc, fn, this.Operator);
      }
    }
  }
}

// typeIdentical mirrors Go's reflect.Type identity comparison (`l == argType`).
// DIVERGENCE: TS type descriptors are not interned, so identity is reference
// equality OR equal named descriptors.
function typeIdentical(a: NatureType, b: NatureType): boolean {
  if (a === b) {
    return true;
  }
  if (a.name && b.name) {
    return a.name === b.name;
  }
  return false;
}

function checkTypeSuits(
  t: NatureType,
  l: NatureType | null,
  r: NatureType | null,
  firstInIndex: number,
): [NatureType | null, boolean] {
  const firstArgType = t.In(firstInIndex);
  const secondArgType = t.In(firstInIndex + 1);

  const firstArgumentFit =
    (l !== null && typeIdentical(l, firstArgType)) ||
    (firstArgType.Kind() === Kind.Interface &&
      (l === null || l.AssignableTo(firstArgType)));
  const secondArgumentFit =
    (r !== null && typeIdentical(r, secondArgType)) ||
    (secondArgType.Kind() === Kind.Interface &&
      (r === null || r.AssignableTo(secondArgType)));
  if (firstArgumentFit && secondArgumentFit) {
    return [t.Out(0), true];
  }
  return [null, false];
}

function checkType(fnType: Nature, fn: string, operator: string): void {
  let requiredNumIn = 2;
  if (fnType.Method) {
    requiredNumIn = 3; // As first argument of method is receiver.
  }
  if (
    fnType.Type === null ||
    fnType.Type.NumIn() !== requiredNumIn ||
    fnType.Type.NumOut() !== 1
  ) {
    throw new Error(
      `function ${fn} for ${operator} operator does not have a correct signature`,
    );
  }
}

function checkFunc(fn: Func, name: string, operator: string): void {
  if (!fn.Types || fn.Types.length === 0) {
    throw new Error(`function "${name}" for "${operator}" operator misses types`);
  }
  for (const t of fn.Types) {
    if (t.NumIn() !== 2 || t.NumOut() !== 1) {
      throw new Error(
        `function "${name}" for "${operator}" operator does not have a correct signature`,
      );
    }
  }
}
