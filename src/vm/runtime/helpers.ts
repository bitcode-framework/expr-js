// Port of expr-lang/expr vm/runtime/helpers[generated].go
// DIVERGENCE (documented in PARITY.md): Go generates ~3700 lines of typed
// arithmetic dispatch over every int/uint/float pair. This port models the
// expr numeric domain with two JS types — bigint (Go int/int64) and number
// (Go float64) — plus time markers. Behavior is preserved: integer ops stay
// integer (bigint), any float promotes to float64, "/" always yields float64,
// "%" is integer-only. Function names match upstream exactly (source parity).
import { IsNil } from "./runtime.js";
import { GoTime, GoDuration } from "./gotime.js";
import { BRANDED, unbrand, getBrand } from "./branded.js";

function isInt(v: any): v is bigint {
  return typeof v === "bigint";
}
function isFloat(v: any): v is number {
  return typeof v === "number";
}
function isNumeric(v: any): boolean {
  return typeof v === "bigint" || typeof v === "number";
}

function toF(v: any): number {
  return typeof v === "bigint" ? Number(v) : (v as number);
}

function isBranded(v: any): boolean {
  return v !== null && typeof v === "object" && BRANDED in v;
}

export function Equal(a: any, b: any): boolean {
  // Branded value comparison: Go's reflect.DeepEqual treats named types as
  // distinct from their underlying primitive. ModeEnum(1) != int(1).
  const aBrand = getBrand(a);
  const bBrand = getBrand(b);
  if (aBrand !== undefined || bBrand !== undefined) {
    if (aBrand === bBrand) {
      // Same brand — unwrap and compare underlying values.
      return Equal(unbrand(a), unbrand(b));
    }
    // Different brands (or one branded, one not) → not equal.
    return false;
  }
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return a === b;
    return toF(a) === toF(b);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Equal(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "string" && typeof b === "string") {
    return a === b;
  }
  if (a instanceof GoTime && b instanceof GoTime) {
    return a.Equal(b);
  }
  if (a instanceof GoDuration && b instanceof GoDuration) {
    return a.value === b.value;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b;
  }
  if (IsNil(a) && IsNil(b)) {
    return true;
  }
  return deepEqual(a, b);
}

export function Less(a: any, b: any): boolean {
  // Strip brands for non-equality comparisons — ModeEnum < 2 compares underlying values.
  a = unbrand(a);
  b = unbrand(b);
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return a < b;
    return toF(a) < toF(b);
  }
  if (typeof a === "string" && typeof b === "string") return a < b;
  if (a instanceof GoTime && b instanceof GoTime) return a.Before(b);
  if (a instanceof GoDuration && b instanceof GoDuration) return a.value < b.value;
  throw new Error(`invalid operation: ${typeName(a)} < ${typeName(b)}`);
}

export function More(a: any, b: any): boolean {
  a = unbrand(a);
  b = unbrand(b);
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return a > b;
    return toF(a) > toF(b);
  }
  if (typeof a === "string" && typeof b === "string") return a > b;
  if (a instanceof GoTime && b instanceof GoTime) return a.After(b);
  if (a instanceof GoDuration && b instanceof GoDuration) return a.value > b.value;
  throw new Error(`invalid operation: ${typeName(a)} > ${typeName(b)}`);
}

export function LessOrEqual(a: any, b: any): boolean {
  a = unbrand(a);
  b = unbrand(b);
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return a <= b;
    return toF(a) <= toF(b);
  }
  if (typeof a === "string" && typeof b === "string") return a <= b;
  if (a instanceof GoTime && b instanceof GoTime) return a.Before(b) || a.Equal(b);
  if (a instanceof GoDuration && b instanceof GoDuration) return a.value <= b.value;
  throw new Error(`invalid operation: ${typeName(a)} <= ${typeName(b)}`);
}

export function MoreOrEqual(a: any, b: any): boolean {
  a = unbrand(a);
  b = unbrand(b);
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return a >= b;
    return toF(a) >= toF(b);
  }
  if (typeof a === "string" && typeof b === "string") return a >= b;
  if (a instanceof GoTime && b instanceof GoTime) return a.After(b) || a.Equal(b);
  if (a instanceof GoDuration && b instanceof GoDuration) return a.value >= b.value;
  throw new Error(`invalid operation: ${typeName(a)} >= ${typeName(b)}`);
}

export function Add(a: any, b: any): any {
  a = unbrand(a);
  b = unbrand(b);
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a + b);
    return toF(a) + toF(b);
  }
  if (typeof a === "string" && typeof b === "string") return a + b;
  if (a instanceof GoTime && b instanceof GoDuration) return a.Add(b);
  if (a instanceof GoDuration && b instanceof GoTime) return b.Add(a);
  if (a instanceof GoDuration && b instanceof GoDuration)
    return new GoDuration(a.value + b.value);
  throw new Error(`invalid operation: ${typeName(a)} + ${typeName(b)}`);
}

export function Subtract(a: any, b: any): any {
  a = unbrand(a);
  b = unbrand(b);
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a - b);
    return toF(a) - toF(b);
  }
  if (a instanceof GoTime && b instanceof GoTime) return a.Sub(b);
  if (a instanceof GoTime && b instanceof GoDuration)
    return a.Add(new GoDuration(-b.value));
  if (a instanceof GoDuration && b instanceof GoDuration)
    return new GoDuration(a.value - b.value);
  throw new Error(`invalid operation: ${typeName(a)} - ${typeName(b)}`);
}

export function Multiply(a: any, b: any): any {
  a = unbrand(a);
  b = unbrand(b);
  if (isNumeric(a) && isNumeric(b)) {
    if (isInt(a) && isInt(b)) return wrapInt64(a * b);
    return toF(a) * toF(b);
  }
  // duration * scalar. Go's generated Multiply uses cases_with_duration where
  // a float operand promotes the whole expression to float64 (float takes
  // precedence over duration), while an int operand keeps it a duration.
  if (a instanceof GoDuration && isNumeric(b)) {
    if (isFloat(b)) return Number(a.value) * (b as number);
    return new GoDuration(a.value * (b as bigint));
  }
  if (isNumeric(a) && b instanceof GoDuration) {
    if (isFloat(a)) return (a as number) * Number(b.value);
    return new GoDuration((a as bigint) * b.value);
  }
  throw new Error(`invalid operation: ${typeName(a)} * ${typeName(b)}`);
}

export function Divide(a: any, b: any): number {
  a = unbrand(a);
  b = unbrand(b);
  if (isNumeric(a) && isNumeric(b)) {
    return toF(a) / toF(b);
  }
  throw new Error(`invalid operation: ${typeName(a)} / ${typeName(b)}`);
}

export function Modulo(a: any, b: any): bigint {
  a = unbrand(a);
  b = unbrand(b);
  if (isInt(a) && isInt(b)) {
    if (b === 0n) {
      throw new Error("integer divide by zero");
    }
    // Go % truncates toward zero (matches JS BigInt %).
    return a % b;
  }
  throw new Error(`invalid operation: ${typeName(a)} % ${typeName(b)}`);
}

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;
const UINT64 = 2n ** 64n;

// wrapInt64 emulates Go int64 wraparound on overflow.
function wrapInt64(v: bigint): bigint {
  if (v >= INT64_MIN && v <= INT64_MAX) return v;
  let m = ((v - INT64_MIN) % UINT64 + UINT64) % UINT64;
  return m + INT64_MIN;
}

function typeName(v: any): string {
  if (typeof v === "bigint") return "int";
  if (typeof v === "number") return Number.isInteger(v) ? "float64" : "float64";
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "bool";
  if (v === null || v === undefined) return "<nil>";
  return typeof v;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}
