// Port of expr-lang/expr docgen/docgen.go
//
// Generates a documentation Context (variables, types) from an env.
//
// DIVERGENCE (FORCED_DIVERGENCE, documented): Go walks the env via reflect
// (NumMethod, struct fields, PkgPath, embedded promotion). TypeScript has no
// reflection; this port walks the env Nature / TypeDescriptor produced by
// conf.EnvWithCache + nature.StructFields. The emitted Context shape, the
// Builtins table, and Markdown output match Go 1:1.
import { Nature, Cache, FromType } from "../checker/nature/nature.js";
import { Type as NatureType } from "../checker/nature/type.js";
import { Kind as NatureKind } from "../checker/nature/kind.js";
import { EnvWithCache } from "../conf/env.js";
import { StructFields } from "../checker/nature/utils.js";

// Kind: array, map, struct, func, string, int, float, bool, any, operator.
export type Kind = string;
export type Identifier = string;
export type TypeName = string;

export interface DocType {
  name?: TypeName;
  kind?: Kind;
  type?: DocType;
  key?: DocType;
  fields?: Record<Identifier, DocType>;
  arguments?: DocType[];
  return?: DocType;
}

export class Context {
  Variables: Record<Identifier, DocType>;
  Types: Record<TypeName, DocType>;
  PkgPath: string;

  constructor() {
    this.Variables = {};
    this.Types = {};
    this.PkgPath = "";
  }
}

// Declaration merge (type-only, emits no runtime fields) so that the prototype
// method Markdown (attached in index.ts) and the dynamically-assigned `use`
// are visible to TypeScript without shadowing them via class-field initializers.
export interface Context {
  // Markdown is attached to Context.prototype in index.ts (Go: *Context method).
  Markdown(): string;
  // use translates a TypeDescriptor into a DocType; bound in CreateDoc.
  use(t: NatureType | null, method?: boolean): DocType;
}

export const Operators: string[] = ["matches", "contains", "startsWith", "endsWith"];

const anyT = (): DocType => ({ kind: "any" });
const arrAny = (): DocType => ({ kind: "array", type: anyT() });
const str = (name?: string): DocType =>
  name ? { name, kind: "string" } : { kind: "string" };

export const Builtins: Record<Identifier, DocType> = {
  true: { kind: "bool" },
  false: { kind: "bool" },
  len: { kind: "func", arguments: [arrAny()], return: { kind: "int" } },
  all: { kind: "func", arguments: [arrAny(), { kind: "func" }], return: { kind: "bool" } },
  none: { kind: "func", arguments: [arrAny(), { kind: "func" }], return: { kind: "bool" } },
  any: { kind: "func", arguments: [arrAny(), { kind: "func" }], return: { kind: "bool" } },
  one: { kind: "func", arguments: [arrAny(), { kind: "func" }], return: { kind: "bool" } },
  filter: { kind: "func", arguments: [arrAny(), { kind: "func" }], return: arrAny() },
  map: { kind: "func", arguments: [arrAny(), { kind: "func" }], return: arrAny() },
  count: { kind: "func", arguments: [arrAny(), { kind: "func" }], return: { kind: "int" } },

  trim: { kind: "func", arguments: [str("string"), str("cutstr")], return: str("string") },
  trimPrefix: { kind: "func", arguments: [str("string"), str("cutstr")], return: str("string") },
  trimSuffix: { kind: "func", arguments: [str("string"), str("cutstr")], return: str("string") },

  upper: { kind: "func", arguments: [str("string")], return: str("string") },
  lower: { kind: "func", arguments: [str("string")], return: str("string") },
  repeat: { kind: "func", arguments: [{ name: "n", kind: "int" }], return: str("string") },

  join: { kind: "func", arguments: [arrAny(), str("glue")], return: str("string") },
  indexOf: { kind: "func", arguments: [str("string"), str("substr")], return: { name: "index", kind: "int" } },
  lastIndexOf: { kind: "func", arguments: [str("string"), str("substr")], return: { name: "index", kind: "int" } },

  hasPrefix: { kind: "func", arguments: [str("string"), str("prefix")], return: { kind: "bool" } },
  hasSuffix: { kind: "func", arguments: [str("string"), str("prefix")], return: { kind: "bool" } },

  toJSON: { kind: "func", arguments: [anyT()], return: { kind: "string" } },
  fromJSON: { kind: "func", arguments: [{ kind: "string" }], return: anyT() },

  toBase64: { kind: "func", arguments: [{ kind: "string" }], return: { kind: "string" } },
  fromBase64: { kind: "func", arguments: [{ kind: "string" }], return: { kind: "string" } },

  first: { kind: "func", arguments: [arrAny()], return: anyT() },
  last: { kind: "func", arguments: [arrAny()], return: anyT() },

  now: { kind: "func", return: { name: "time.Time", kind: "struct" } },
  duration: { kind: "func", arguments: [{ kind: "string" }], return: { kind: "time.Duration" } },
};

// isPrivate: Go uses ^[A-Z]; a name is private if it does not start uppercase.
function isPrivate(s: string): boolean {
  return !/^[A-Z]/.test(s);
}

function isProtobuf(s: string): boolean {
  return s.startsWith("XXX_");
}

// use translates a TypeDescriptor into a DocType, mirroring Context.use.
// DIVERGENCE: Go inspects reflect methods + PkgPath; the TS descriptor carries
// methods in Type.methods and field info via nature.StructFields.
function use(c: Context, t: NatureType | null, method = false): DocType {
  if (t === null) {
    return { kind: "any" };
  }

  const methodNames = [...t.methods.keys()].filter(
    (n) => !isPrivate(n) && !isProtobuf(n),
  );

  // Named types with methods are emitted in the appendix (struct table).
  if (methodNames.length === 0) {
    switch (t.Kind()) {
      case NatureKind.Bool:
        return { kind: "bool" };
      case NatureKind.Int:
      case NatureKind.Int8:
      case NatureKind.Int16:
      case NatureKind.Int32:
      case NatureKind.Int64:
      case NatureKind.Uint:
      case NatureKind.Uint8:
      case NatureKind.Uint16:
      case NatureKind.Uint32:
      case NatureKind.Uint64:
      case NatureKind.Uintptr:
        return { kind: "int" };
      case NatureKind.Float32:
      case NatureKind.Float64:
        return { kind: "float" };
      case NatureKind.String:
        return { kind: "string" };
      case NatureKind.Interface:
        return { kind: "any" };
      case NatureKind.Slice:
      case NatureKind.Array:
        return { kind: "array", type: use(c, t.Elem()) };
      case NatureKind.Map:
        return { kind: "map", key: use(c, t.Key()), type: use(c, t.Elem()) };
      case NatureKind.Func: {
        const args: DocType[] = [];
        const start = method ? 1 : 0;
        for (let i = start; i < t.NumIn(); i++) {
          args.push(use(c, t.In(i)));
        }
        const f: DocType = { kind: "func", arguments: args };
        if (t.NumOut() > 0) {
          f.return = use(c, t.Out(0));
        }
        return f;
      }
      // Struct falls through to the appendix below.
    }
  }

  // appendix: named/struct type.
  const tname = t.String();
  const anonymous = t.name === "";
  let a = c.Types[tname];
  if (a === undefined) {
    a = { kind: "struct", fields: {} };
    if (!anonymous) {
      c.Types[tname] = a;
    }
    const fields = StructFields(undefined, t);
    for (const [name, fieldNature] of fields) {
      if (isPrivate(name) || isProtobuf(name)) continue;
      if (a.fields![name] !== undefined) continue;
      a.fields![name] = use(c, fieldNature.Type);
    }
    for (const m of methodNames) {
      a.fields![m] = use(c, t.methods.get(m) ?? null, true);
    }
  }
  if (anonymous) {
    return a;
  }
  return { kind: "struct", name: tname };
}

// CreateDoc builds a documentation Context from an env.
export function CreateDoc(i: any): Context {
  const c = new Context();
  c.use = (t, method) => use(c, t, method ?? false);

  const cache = new Cache();
  const env: Nature = EnvWithCache(cache, i);
  for (const [name, t] of env.All(cache)) {
    if (c.Variables[name] !== undefined) continue;
    c.Variables[name] = use(c, t.Type, t.Method);
  }

  for (const op of Operators) {
    c.Variables[op] = { kind: "operator" };
  }

  for (const [b, t] of Object.entries(Builtins)) {
    c.Variables[b] = t;
  }

  return c;
}

void FromType;
