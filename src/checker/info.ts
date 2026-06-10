// Port of expr-lang/expr checker/info.go
//
// DIVERGENCE (documented here and in PARITY.md):
//   - TypedFuncIndex and IsFastFunc depend on Go's vm.FuncTypes specialization
//     tables. The TypeScript port does NOT specialize typed function calls; all
//     calls go through generic OpCall/OpCallN in the VM. Therefore:
//       * TypedFuncIndex ALWAYS returns [0, false]
//       * IsFastFunc     ALWAYS returns false
//     This is intentional and matches the runtime model of the TS port.
//   - MethodIndex for a MemberNode uses Go's reflect method index (m.Index).
//     The TS Type descriptor has no per-type method index, so the MemberNode
//     branch reports index 0 (the method existence flag is still accurate).
//   - The Go `m.TypeData != nil` guard (which signals the Nature carries
//     func/method type-data) is approximated by `m.Type !== null`.

import {
  Node,
  IdentifierNode,
  MemberNode,
  StringNode,
} from "../ast/node.js";
import { Cache, Nature } from "./nature/nature.js";
import { Type } from "./nature/type.js";
import { Kind } from "./nature/kind.js";
import { FUNC_TYPES } from "./func_types.generated.js";
export { FUNC_TYPES_ARITY } from "./func_types.generated.js";

export function FieldIndex(
  c: Cache,
  env: Nature,
  node: Node,
): [boolean, number[] | null, string] {
  if (node instanceof IdentifierNode) {
    const [idx, ok] = env.FieldIndex(c, node.Value);
    if (ok) {
      return [true, idx, node.Value];
    }
  } else if (node instanceof MemberNode) {
    const base = node.Node.Nature().Deref(c);
    if (base.Kind === Kind.Struct) {
      if (node.Property instanceof StringNode) {
        const prop = node.Property;
        const [idx, ok] = base.FieldIndex(c, prop.Value);
        if (ok) {
          return [true, idx, prop.Value];
        }
      }
    }
  }
  return [false, null, ""];
}

export function MethodIndex(
  c: Cache,
  env: Nature,
  node: Node,
): [boolean, number, string] {
  if (node instanceof IdentifierNode) {
    if (env.Kind === Kind.Struct) {
      const [m, ok] = env.Get(c, node.Value);
      // Go checks `ok && m.TypeData != nil`; TS proxies TypeData with Type!=null.
      if (ok && m.Type !== null) {
        return [m.Method, m.MethodIndex, node.Value];
      }
    }
  } else if (node instanceof MemberNode) {
    if (node.Property instanceof StringNode) {
      const name = node.Property;
      const base = node.Node.Type();
      if (base !== null && base.Kind() !== Kind.Interface) {
        if (base.methods.has(name.Value)) {
          // DIVERGENCE: TS Type has no per-method reflect index; report 0.
          return [true, 0, name.Value];
        }
      }
    }
  }
  return [false, 0, ""];
}

// TypedFuncIndex: mirrors Go's checker/info.go TypedFuncIndex.
// Compares the function's Type descriptor against a pre-built table of common
// function signatures (mirroring Go's vm.FuncTypes generated table).
// Returns [index, true] if a match is found, [0, false] otherwise.
export function TypedFuncIndex(fn: Type | null, method: boolean): [number, boolean] {
  if (fn === null) return [0, false];
  if (fn.Kind() !== Kind.Func) return [0, false];
  // Variadic functions are excluded (mirrors Go).
  if (fn.IsVariadic()) return [0, false];
  // Named functions (custom type name, not generic "func") are excluded.
  if (fn.name !== "" && fn.name !== "func") return [0, false];

  const fnNumIn = fn.NumIn();
  const fnInOffset = method ? 1 : 0;
  const effectiveNumIn = fnNumIn - fnInOffset;

  for (let i = 1; i < FUNC_TYPES.length; i++) {
    const entry = FUNC_TYPES[i]!;
    if (entry.out.length !== fn.NumOut()) continue;
    let outMatch = true;
    for (let j = 0; j < entry.out.length; j++) {
      if (!typesEqual(entry.out[j]!, fn.Out(j))) { outMatch = false; break; }
    }
    if (!outMatch) continue;
    if (entry.in.length !== effectiveNumIn) continue;
    let inMatch = true;
    for (let j = 0; j < entry.in.length; j++) {
      if (!typesEqual(entry.in[j]!, fn.In(j + fnInOffset))) { inMatch = false; break; }
    }
    if (!inMatch) continue;
    return [i, true];
  }
  return [0, false];
}

// IsFastFunc: mirrors Go's checker/info.go IsFastFunc.
// Returns true for variadic func(...any) any signatures.
export function IsFastFunc(fn: Type | null, method: boolean): boolean {
  if (fn === null) return false;
  if (fn.Kind() !== Kind.Func) return false;
  const numIn = method ? 2 : 1;
  if (
    fn.IsVariadic() &&
    fn.NumIn() === numIn &&
    fn.NumOut() === 1 &&
    fn.Out(0).Kind() === Kind.Interface
  ) {
    const lastIn = fn.In(fn.NumIn() - 1);
    if (
      lastIn.Kind() === Kind.Slice &&
      lastIn.Elem().Kind() === Kind.Interface
    ) {
      return true;
    }
  }
  return false;
}

// FUNC_TYPES is generated from Go's vm/func_types[generated].go.

// typesEqual: structural type comparison mirroring Go's reflect.Type equality.
// For TS singletons, identity check works. For created descriptors, compare
// Kind + name + structural properties.
function normalizeTypeName(name: string): string {
  return name.replace(/interface\s*\{\}/g, "interface{}");
}

function typesEqual(a: Type, b: Type): boolean {
  if (a === b) return true;
  if (a.Kind() !== b.Kind()) return false;
  if (a.name && b.name) return normalizeTypeName(a.name) === normalizeTypeName(b.name);
  // Fallback: both unnamed, same kind → equal (matches Go for unnamed types).
  return !a.name && !b.name;
}
