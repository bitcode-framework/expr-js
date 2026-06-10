// Port of expr-lang/expr conf/env.go
//
// Builds a checker Nature describing the environment.
//
// DIVERGENCE (FORCED_DIVERGENCE): Go inspects the env via reflect (struct vs
// map vs types.Map). JavaScript has no reflection and no struct type. This port
// reproduces the observable behavior:
//   - nil env  -> empty strict fast-map nature
//   - types.Map -> its declared Nature (strict, with field types)
//   - plain object / JS Map -> strict map nature with per-key field natures
// A JS plain object is the closest analog to a Go struct/map env; both expose
// string-keyed members, which is what the checker consumes.
import { Nature, Cache, NatureOf, FromType, STRUCT_TYPE } from "../checker/nature/nature.js";
import { Map as TypesMap } from "../types/types.js";

// Env returns the Nature of the given environment.
// Deprecated upstream: use EnvWithCache. Kept for source parity.
export function Env(env: any): Nature {
  return EnvWithCache(new Cache(), env);
}

export function EnvWithCache(c: Cache, env: any): Nature {
  if (env === null || env === undefined) {
    const n = NatureOf({});
    n.Strict = true;
    return n;
  }

  // types.Map env: use its declared Nature directly.
  if (env instanceof TypesMap) {
    return env.Nature();
  }

  // JS Map env: treat as a strict map with per-entry field natures.
  if (env instanceof globalThis.Map) {
    const n = NatureOf({});
    n.Strict = true;
    n.Fields = new globalThis.Map<string, Nature>();
    for (const [key, value] of env) {
      n.Fields.set(String(key), natureOfEntry(value));
    }
    return n;
  }

  // Plain object env (the JS analog of a Go struct/map). Walk own keys.
  if (typeof env === "object") {
    // Struct-marked env: use declared field types from markStruct metadata.
    // This reproduces Go's reflect-based struct field type resolution, enabling
    // named type distinction (e.g., EnvStr vs string) at the checker level.
    const structMeta = (env as any)[STRUCT_TYPE];
    if (structMeta) {
      const n = NatureOf(env);
      n.Strict = true;
      return n;
    }
    const n = NatureOf({});
    n.Strict = true;
    n.Fields = new globalThis.Map<string, Nature>();
    for (const key of Object.keys(env)) {
      n.Fields.set(key, natureOfEntry((env as Record<string, any>)[key]));
    }
    return n;
  }

  throw new Error(`unknown type ${typeof env}`);
}

function natureOfEntry(face: any): Nature {
  if (face instanceof TypesMap) {
    return face.Nature();
  }
  if (face === null || face === undefined) {
    return NatureOf(null);
  }
  return NatureOf(face);
}
