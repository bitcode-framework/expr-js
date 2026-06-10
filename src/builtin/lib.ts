// Port of expr-lang/expr builtin/lib.go
// DIVERGENCE (PARITY.md): Go uses reflect to introspect values. This port
// operates on native JS values. Go int/int64 -> JS bigint, Go float64 -> JS
// number. Go funcs return (any, error); ported funcs throw on error.
// MaxDepth / ErrorMaxDepth live here (Go declares them in builtin.go) to avoid
// a circular import between builtin.ts and lib.ts.
import { Less, More, Equal, Fetch } from "../vm/runtime/runtime.js";

export const MaxDepth = 10000;
export const ErrorMaxDepth = new Error("recursion depth exceeded");

function goTypeName(v: any): string {
  if (v === null || v === undefined) return "<nil>";
  if (typeof v === "bigint") return "int";
  if (typeof v === "number") return "float64";
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "[]interface {}";
  if (v instanceof Map) return "map[interface {}]interface {}";
  return "interface {}";
}

function isNumeric(v: any): boolean {
  return typeof v === "bigint" || typeof v === "number";
}

// Len: Go returns v.Len() (an int). In our numeric model int -> bigint.
export function Len(x: any): any {
  if (Array.isArray(x)) return BigInt(x.length);
  if (typeof x === "string") {
    // utf8.RuneCountInString: count runes, not UTF-16 code units.
    return BigInt([...x].length);
  }
  if (x instanceof Map) return BigInt(x.size);
  if (x && typeof x === "object") return BigInt(Object.keys(x).length);
  throw new Error(`invalid argument for len (type ${goTypeName(x)})`);
}

// Type mirrors Go builtin.Type: returns a category string.
export function Type(arg: any): any {
  if (arg === null || arg === undefined) return "nil";
  switch (typeof arg) {
    case "boolean":
      return "bool";
    case "bigint":
      return "int";
    case "number":
      return "float";
    case "string":
      return "string";
    case "function":
      return "func";
    case "object":
      if (Array.isArray(arg)) return "array";
      if (arg instanceof Map) return "map";
      // Plain objects model Go structs/maps; treat as struct.
      return "struct";
    default:
      return "unknown";
  }
}

// Abs preserves the argument's numeric kind.
export function Abs(x: any): any {
  if (typeof x === "bigint") return x < 0n ? -x : x;
  if (typeof x === "number") return x < 0 ? -x : x;
  throw new Error(`invalid argument for abs (type ${goTypeName(x)})`);
}

// Ceil / Floor / Round: floats use Math.*, integers convert to float (number).
export function Ceil(x: any): any {
  if (typeof x === "number") return Math.ceil(x);
  if (typeof x === "bigint") return Number(x);
  throw new Error(`invalid argument for ceil (type ${goTypeName(x)})`);
}

export function Floor(x: any): any {
  if (typeof x === "number") return Math.floor(x);
  if (typeof x === "bigint") return Number(x);
  throw new Error(`invalid argument for floor (type ${goTypeName(x)})`);
}

export function Round(x: any): any {
  // DIVERGENCE: Go math.Round rounds half away from zero. JS Math.round rounds
  // half toward +Inf. Match Go for negative .5 cases.
  if (typeof x === "number") {
    return Math.sign(x) * Math.round(Math.abs(x));
  }
  if (typeof x === "bigint") return Number(x);
  throw new Error(`invalid argument for round (type ${goTypeName(x)})`);
}

// Int converts to a Go int (JS bigint).
export function Int(x: any): any {
  if (typeof x === "number") return BigInt(Math.trunc(x));
  if (typeof x === "bigint") return x;
  if (typeof x === "string") {
    // strconv.Atoi: base-10 integer.
    if (!/^[+-]?\d+$/.test(x)) {
      throw new Error(`invalid operation: int(${x})`);
    }
    return BigInt(x);
  }
  if (typeof x === "boolean") {
    // Go: reflect convert of bool is not allowed -> panic.
    throw new Error(`invalid operation: int(${goTypeName(x)})`);
  }
  throw new Error(`invalid operation: int(${goTypeName(x)})`);
}

// Float converts to a Go float64 (JS number).
export function Float(x: any): any {
  if (typeof x === "number") return x;
  if (typeof x === "bigint") return Number(x);
  if (typeof x === "string") {
    const f = Number(x);
    if (x.trim() === "" || Number.isNaN(f)) {
      throw new Error(`invalid operation: float(${x})`);
    }
    return f;
  }
  throw new Error(`invalid operation: float(${goTypeName(x)})`);
}

// String mirrors fmt.Sprintf("%v", arg).
// biome-ignore lint/suspicious/noShadowRestrictedNames: upstream Go export name.
export function String(arg: any): any {
  return goFormatV(arg);
}

// goFormatV approximates Go's fmt %v verb for the value shapes expr produces.
function goFormatV(v: any): string {
  if (v === null || v === undefined) return "<nil>";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return formatGoFloat(v);
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return "[" + v.map(goFormatV).join(" ") + "]";
  if (v instanceof Map) {
    const parts: string[] = [];
    for (const [k, val] of v) parts.push(`${goFormatV(k)}:${goFormatV(val)}`);
    return "map[" + parts.join(" ") + "]";
  }
  if (typeof v === "object") {
    const parts: string[] = [];
    for (const k of Object.keys(v)) parts.push(goFormatV(v[k]));
    return "{" + parts.join(" ") + "}";
  }
  return globalThis.String(v as any);
}

function formatGoFloat(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toString();
}

// minMax mirrors Go builtin.minMax: recursive numeric reduction over nested
// arrays. fn(a, b) reports whether b should replace the current value.
export function minMax(
  name: string,
  fn: (a: any, b: any) => boolean,
  depth: number,
  ...args: any[]
): any {
  if (depth > MaxDepth) {
    throw ErrorMaxDepth;
  }
  let val: any = null;
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const elem of arg) {
        if (isNumeric(elem)) {
          if (val === null || fn(val, elem)) {
            val = elem;
          }
        } else if (Array.isArray(elem)) {
          const nested = minMax(name, fn, depth + 1, elem);
          if (nested !== null && (val === null || fn(val, nested))) {
            val = nested;
          }
        } else {
          throw new Error(
            `invalid argument for ${name} (type ${goTypeName(elem)})`,
          );
        }
      }
      continue;
    }
    if (isNumeric(arg)) {
      if (val === null || fn(val, arg)) {
        val = arg;
      }
      continue;
    }
    if (args.length === 1) {
      return args[0];
    }
    throw new Error(`invalid argument for ${name} (type ${goTypeName(arg)})`);
  }
  return val;
}

// mean mirrors Go builtin.mean: returns [count, total].
export function mean(depth: number, ...args: any[]): [number, number] {
  if (depth > MaxDepth) {
    throw ErrorMaxDepth;
  }
  let total = 0;
  let count = 0;
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const elem of arg) {
        if (isNumeric(elem)) {
          total += Number(elem);
          count++;
        } else if (Array.isArray(elem)) {
          const [nestedCount, nestedSum] = mean(depth + 1, elem);
          total += nestedSum;
          count += nestedCount;
        } else {
          throw new Error(
            `invalid argument for mean (type ${goTypeName(elem)})`,
          );
        }
      }
      continue;
    }
    if (isNumeric(arg)) {
      total += Number(arg);
      count++;
      continue;
    }
    throw new Error(`invalid argument for mean (type ${goTypeName(arg)})`);
  }
  return [count, total];
}

// median mirrors Go builtin.median: collects all numeric leaves as floats.
export function median(depth: number, ...args: any[]): number[] {
  if (depth > MaxDepth) {
    throw ErrorMaxDepth;
  }
  const values: number[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const elem of arg) {
        if (isNumeric(elem)) {
          values.push(Number(elem));
        } else if (Array.isArray(elem)) {
          values.push(...median(depth + 1, elem));
        } else {
          throw new Error(
            `invalid argument for median (type ${goTypeName(elem)})`,
          );
        }
      }
      continue;
    }
    if (isNumeric(arg)) {
      values.push(Number(arg));
      continue;
    }
    throw new Error(`invalid argument for median (type ${goTypeName(arg)})`);
  }
  return values;
}

// flatten mirrors Go builtin.flatten: recursively flatten nested arrays.
export function flatten(arg: any[], depth: number): any[] {
  if (depth > MaxDepth) {
    throw ErrorMaxDepth;
  }
  const ret: any[] = [];
  for (let i = 0; i < arg.length; i++) {
    const v = arg[i];
    if (Array.isArray(v)) {
      ret.push(...flatten(v, depth + 1));
    } else {
      ret.push(v);
    }
  }
  return ret;
}

// get mirrors Go builtin.get: like runtime.Fetch but returns null instead of
// panicking on a missing/out-of-range key.
export function get(...params: any[]): any {
  if (params.length < 2) {
    throw new Error(
      `invalid number of arguments (expected 2, got ${params.length})`,
    );
  }
  const from = params[0];
  const i = params[1];
  if (from === null || from === undefined) {
    return null;
  }

  // Method lookup on any type.
  if (typeof i === "string" && typeof from === "object") {
    const m = (from as any)[i];
    if (typeof m === "function") {
      return m.bind(from);
    }
  }

  if (Array.isArray(from) || typeof from === "string") {
    let index = Number(typeof i === "bigint" ? i : Math.trunc(i));
    const l = from.length;
    if (index < 0) index = l + index;
    if (index >= 0 && index < l) {
      return from[index];
    }
    return null;
  }

  if (from instanceof Map) {
    if (from.has(i)) return from.get(i);
    return null;
  }

  if (typeof from === "object") {
    if (typeof i === "string" && i in from) {
      return (from as any)[i];
    }
    return null;
  }

  // Main difference from runtime.Fetch: return null instead of panic.
  return null;
}
