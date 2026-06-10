// Port of expr-lang/expr checker/nature/utils.go
//
// DIVERGENCE (FORCED_DIVERGENCE): Go walks struct fields and methods via
// reflect (reflect.StructField, embedded/anonymous traversal, `expr` struct
// tags, method sets). TypeScript has no reflection. The TS port models a type
// as a TypeDescriptor (./type.ts) whose `fields: FieldDescriptor[]` already
// carries name, type, `anonymous`, and an `index` path, and whose `methods`
// Map carries the method set. This file reproduces the *observable behavior* of
// Go's struct-field resolver over that descriptor:
//   - `expr:"-"` tag excludes a field (modeled by FieldDescriptor.name === "")
//   - embedded (anonymous) struct fields are flattened, with shallower fields
//     shadowing deeper ones (Go's field-promotion rules)
//   - the returned Index path is the concatenation of embed indices
//
// Because descriptors are precomputed, the incremental/cached structData state
// machine in Go is unnecessary; the flattening is computed directly. Behavior
// (which names resolve, and to which Index path) is preserved.
import { Type, FieldDescriptor } from "./type.js";
import { Kind } from "./kind.js";
import { Nature, Cache, FromType } from "./nature.js";

// fieldName mirrors Go's fieldName(name, tag): applies the `expr` struct tag.
// In the TS descriptor the tag has already been resolved into the field name
// (or an empty name for `expr:"-"`). Kept for source-parity of the call sites.
export function fieldName(name: string, tagged: string | undefined): [string, boolean] {
  switch (tagged) {
    case "-":
      return ["", false];
    case "":
    case undefined:
      return [name, true];
    default:
      return [tagged, true];
  }
}

// structField mirrors Go's structField: a Nature plus the reflect field Index
// path used by the compiler's OpLoadField/OpFetchField.
export interface StructField {
  nature: Nature;
  Index: number[];
}

// derefStructType unwraps Kind.Ptr layers and returns the type if it is a
// struct, else null.
function derefStructType(t: Type | null): Type | null {
  let cur = t;
  while (cur !== null && cur.Kind() === Kind.Ptr) {
    cur = cur.Elem();
  }
  if (cur !== null && cur.Kind() === Kind.Struct) {
    return cur;
  }
  return null;
}

// walkFields flattens own + embedded fields with Go promotion semantics:
// breadth-first by embed depth so that shallower fields shadow deeper ones.
function walkFields(t: Type): Map<string, StructField> {
  const out = new Map<string, StructField>();
  // BFS queue of (struct type, index-prefix).
  type Item = { type: Type; prefix: number[] };
  let level: Item[] = [{ type: t, prefix: [] }];

  while (level.length > 0) {
    const next: Item[] = [];
    // Collect names found at this depth first, so same-depth own fields win
    // over deeper embedded ones (and we don't overwrite a shallower match).
    const foundThisLevel = new Map<string, StructField>();

    for (const item of level) {
      for (const f of item.type.fields) {
        const index = [...item.prefix, ...f.index];
        if (f.anonymous) {
          // Descend into embedded struct (deref pointer) at the next level.
          const embedded = derefStructType(f.type);
          if (embedded !== null) {
            next.push({ type: embedded, prefix: index });
          }
          // An embedded field is also accessible by its own (type) name only
          // if it has a non-empty resolved name; Go promotes its inner fields,
          // which we handle via the descent above.
          continue;
        }
        // `expr:"-"` is modeled as an empty field name -> excluded.
        if (f.name === "") {
          continue;
        }
        if (!out.has(f.name) && !foundThisLevel.has(f.name)) {
          foundThisLevel.set(f.name, { nature: FromType(f.type), Index: index });
        }
      }
    }

    for (const [name, sf] of foundThisLevel) {
      if (!out.has(name)) {
        out.set(name, sf);
      }
    }
    level = next;
  }

  return out;
}

// StructFields mirrors Go's StructFields(c, t): returns the flattened map of
// field name -> Nature for a (possibly pointer-to) struct type.
export function StructFields(_c: Cache | undefined, t: Type | null): Map<string, Nature> {
  const table = new Map<string, Nature>();
  const st = derefStructType(t);
  if (st === null) {
    return table;
  }
  for (const [name, sf] of walkFields(st)) {
    table.set(name, sf.nature);
  }
  return table;
}

// StructFieldByName resolves a single field (with its Index path), mirroring
// the result of Go's structData.structField used by checker.FieldIndex.
export function StructFieldByName(
  t: Type | null,
  name: string,
): StructField | null {
  const st = derefStructType(t);
  if (st === null) {
    return null;
  }
  const fields = walkFields(st);
  return fields.get(name) ?? null;
}

// MethodByName mirrors Go's methodset.method: looks up an exported method on a
// type's method set. In the descriptor, methods live in Type.methods.
export function MethodByName(t: Type | null, name: string): [Nature, boolean] {
  if (t === null) {
    return [new Nature(), false];
  }
  const m = t.methods.get(name);
  if (m) {
    const nt = FromType(m);
    if (t.Kind() !== Kind.Interface) {
      nt.Method = true;
    }
    return [nt, true];
  }
  return [new Nature(), false];
}

// MethodNames lists the exported method names of a type (method set order is
// the insertion order of the descriptor's methods Map).
export function MethodNames(t: Type | null): string[] {
  if (t === null) {
    return [];
  }
  return [...t.methods.keys()];
}

// Re-export FieldDescriptor for callers that build descriptors.
export type { FieldDescriptor };
