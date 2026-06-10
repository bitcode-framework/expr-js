// Port of expr-lang/expr vm/runtime/runtime.go
// DIVERGENCE (documented in PARITY.md): Go uses reflect to introspect arrays,
// maps, structs and methods. This port operates on native JS values:
// Array, Map, plain object, string, function. Field access, indexing, slicing,
// membership and numeric conversions reproduce Go expr behavior.
import { GoTime, GoDuration } from "./gotime.js";
import { Equal } from "./helpers.js";

export function Fetch(from: any, i: any): any {
  if (from === null || from === undefined) {
    throw new Error(`cannot fetch ${stringify(i)} from ${typeName(from)}`);
  }

  // Method lookup: bind methods to the receiver so `this` is preserved.
  if (typeof i === "string") {
    const m = lookupMethod(from, i);
    if (m !== undefined) {
      return m;
    }
  }

  // Array / string indexing.
  if (Array.isArray(from) || typeof from === "string") {
    let index = ToInt(i);
    const l = from.length;
    if (index < 0) index = l + index;
    if (index < 0 || index >= l) {
      throw new Error(`index out of range: ${index} (array length is ${l})`);
    }
    return from[index];
  }

  // Map.
  if (from instanceof Map) {
    if (from.has(i)) return from.get(i);
    return undefined;
  }

  // Plain object (struct/map equivalent).
  if (typeof from === "object") {
    if (i in from) {
      return from[i];
    }
    // missing field -> Go returns zero value for map elem; for fast maps that
    // is nil/undefined.
    return undefined;
  }

  throw new Error(`cannot fetch ${stringify(i)} from ${typeName(from)}`);
}

function lookupMethod(from: any, name: string): any {
  // Functions stored as object properties; bind to receiver.
  const v = from[name];
  if (typeof v === "function") {
    return v.bind(from);
  }
  return undefined;
}

export class Field {
  Index: number[];
  Path: string[];
  constructor(index: number[], path: string[]) {
    this.Index = index;
    this.Path = path;
  }
}

export function FetchField(from: any, field: Field): any {
  if (from !== null && from !== undefined) {
    // Path-based field access for nested objects.
    let v = from;
    for (let i = 0; i < field.Path.length; i++) {
      if (v === null || v === undefined) {
        throw new Error(`cannot get ${field.Path[i]} from ${typeName(from)}`);
      }
      v = v[field.Path[i]!];
    }
    if (v !== undefined) {
      return v;
    }
  }
  throw new Error(`cannot get ${field.Path[0]} from ${typeName(from)}`);
}

export class Method {
  Index: number;
  Name: string;
  constructor(index: number, name: string) {
    this.Index = index;
    this.Name = name;
  }
}

export function FetchMethod(from: any, method: Method): any {
  if (from !== null && from !== undefined) {
    const m = from[method.Name];
    if (typeof m === "function") {
      return m.bind(from);
    }
  }
  throw new Error(`cannot fetch ${method.Name} from ${typeName(from)}`);
}

export function Slice(array: any, from: any, to: any): any {
  if (Array.isArray(array) || typeof array === "string") {
    const length = array.length;
    let a = ToInt(from);
    let b = ToInt(to);
    if (a < 0) a = length + a;
    if (a < 0) a = 0;
    if (b < 0) b = length + b;
    if (b < 0) b = 0;
    if (b > length) b = length;
    if (a > b) a = b;
    return array.slice(a, b);
  }
  throw new Error(`cannot slice ${typeName(array)}`);
}

export function In(needle: any, array: any): boolean {
  if (array === null || array === undefined) {
    return false;
  }
  if (Array.isArray(array)) {
    for (let i = 0; i < array.length; i++) {
      if (Equal(array[i], needle)) return true;
    }
    return false;
  }
  if (array instanceof Map) {
    return array.has(needle);
  }
  // Set: produced by the inArray optimizer for constant `x in [..]` arrays.
  // Go's optimizer builds a map[T]struct{} consumed by runtime.In via
  // reflect.Map.MapIndex; the TS port uses a Set with the same membership
  // semantics (bigint/string element identity matches the optimizer keys).
  if (array instanceof Set) {
    return array.has(needle);
  }
  if (typeof array === "object") {
    if (typeof needle !== "string") {
      throw new Error(
        `cannot use ${typeName(needle)} as field name of ${typeName(array)}`,
      );
    }
    return Object.prototype.hasOwnProperty.call(array, needle);
  }
  throw new Error(`operator "in" not defined on ${typeName(array)}`);
}

export function Len(a: any): number {
  if (Array.isArray(a) || typeof a === "string") return a.length;
  if (a instanceof Map) return a.size;
  if (a && typeof a === "object") return Object.keys(a).length;
  throw new Error(`invalid argument for len (type ${typeName(a)})`);
}

export function Negate(i: any): any {
  if (typeof i === "bigint") return -i;
  if (typeof i === "number") return -i;
  throw new Error(`invalid operation: - ${typeName(i)}`);
}

export function Exponent(a: any, b: any): number {
  return Math.pow(ToFloat64(a), ToFloat64(b));
}

export function MakeRange(min: number, max: number): bigint[] {
  const size = max - min + 1;
  if (size <= 0) return [];
  const rng: bigint[] = new Array(size);
  for (let i = 0; i < size; i++) {
    rng[i] = BigInt(min + i);
  }
  return rng;
}

export function ToInt(a: any): number {
  if (typeof a === "bigint") return Number(a);
  if (typeof a === "number") return Math.trunc(a);
  throw new Error(`invalid operation: int(${typeName(a)})`);
}

export function ToInt64(a: any): bigint {
  if (typeof a === "bigint") return a;
  if (typeof a === "number") return BigInt(Math.trunc(a));
  throw new Error(`invalid operation: int64(${typeName(a)})`);
}

export function ToFloat64(a: any): number {
  if (typeof a === "bigint") return Number(a);
  if (typeof a === "number") return a;
  throw new Error(`invalid operation: float(${typeName(a)})`);
}

export function ToBool(a: any): boolean {
  if (a === null || a === undefined) return false;
  if (typeof a === "boolean") return a;
  throw new Error(`invalid operation: bool(${typeName(a)})`);
}

export function IsNil(v: any): boolean {
  if (v === null || v === undefined) return true;
  return false;
}

function typeName(v: any): string {
  if (v === null || v === undefined) return "<nil>";
  if (typeof v === "bigint") return "int";
  if (typeof v === "number") return "float64";
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "[]interface {}";
  if (v instanceof GoTime) return "time.Time";
  if (v instanceof GoDuration) return "time.Duration";
  return "interface {}";
}

function stringify(v: any): string {
  try {
    return String(v);
  } catch {
    return "<value>";
  }
}

// Re-export arithmetic helpers so callers import from runtime barrel.
export {
  Equal,
  Less,
  More,
  LessOrEqual,
  MoreOrEqual,
  Add,
  Subtract,
  Multiply,
  Divide,
  Modulo,
} from "./helpers.js";
