// Port of expr-lang/expr internal/deref/deref.go
//
// DIVERGENCE (FORCED_DIVERGENCE): Go dereferences pointers and interfaces via
// reflect. JavaScript has no pointers, and "interface" values are just plain
// values. So:
//   - Interface(p): returns p unchanged (nothing to dereference in JS).
//   - Value(v): identity (no reflect.Value in the runtime; VM uses raw values).
//   - Type(t)/TypeKind(t,k): operate on the TypeDescriptor, unwrapping Kind.Ptr
//     so checker logic that expects deref behaves identically.
import { Type } from "../../checker/nature/type.js";
import { Kind } from "../../checker/nature/kind.js";

// Interface dereferences a pointer/interface value. In JS there are no
// pointers, so the value is returned as-is (nil stays nil).
export function Interface(p: any): any {
  if (p === null || p === undefined) {
    return null;
  }
  return p;
}

// DerefType unwraps Kind.Ptr layers from a TypeDescriptor (mirrors deref.Type).
export function DerefType(t: Type | null): Type | null {
  if (t === null) {
    return null;
  }
  let cur = t;
  while (cur.Kind() === Kind.Ptr) {
    cur = cur.Elem();
  }
  return cur;
}

// Value dereferences a reflect.Value in Go. The TS VM operates on raw values,
// so this is identity. Kept for source parity / call-site mirroring.
export function Value(v: any): any {
  return v;
}

// TypeKind unwraps Kind.Ptr layers, mirroring deref.TypeKind. Returns the
// unwrapped type, its kind, and whether anything changed.
export function TypeKind(
  t: Type | null,
  k: Kind,
): [Type | null, Kind, boolean] {
  let changed = false;
  let curT = t;
  let curK = k;
  while (curK === Kind.Ptr && curT !== null) {
    changed = true;
    curT = curT.Elem();
    curK = curT.Kind();
  }
  return [curT, curK, changed];
}

// Type is an alias matching the Go function name deref.Type.
export { DerefType as Type };
