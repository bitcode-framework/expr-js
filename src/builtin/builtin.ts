// Port of expr-lang/expr builtin/builtin.go
// DIVERGENCE (PARITY.md): Go uses reflect.Type for argument typing; this port
// uses the Type descriptor from checker/nature/type.ts. Go funcs return
// (any, error) / (any, uint, error); ported Func/Safe bodies throw on error.
// Aggregate/predicate builtins (all/any/filter/map/reduce/...) are implemented
// by the VM/compiler, so here they only carry Name + Predicate + Types.
import { Func } from "./function.js";
import {
  Type,
  anyType,
  intType,
  floatType,
  boolType,
  stringType,
  arrayType,
  timeType,
  durationType,
  SliceOf,
  MapOf,
  FuncOf,
} from "../checker/nature/type.js";
import { Kind } from "../checker/nature/kind.js";
import {
  integerType,
  mapType,
  locationType,
  kind,
  toInt,
  bitFunc,
} from "./utils.js";
import { validateAggregateFunc, validateRoundFunc } from "./validation.js";
import {
  Len,
  Type as TypeFn,
  Abs,
  Ceil,
  Floor,
  Round,
  Int,
  Float,
  String as StringFn,
  minMax,
  mean,
  median,
  flatten,
  get,
} from "./lib.js";
import { Less, More, Equal, Fetch, ToInt } from "../vm/runtime/runtime.js";
import { GoTime, GoDuration, GoLocation, parseInTimezone, parseGoLayout } from "../vm/runtime/gotime.js";

const stringSlice = SliceOf(stringType);

// Builtins mirrors the Go []*Function slice, order preserved.
export const Builtins: Func[] = [
  // --- Predicates (handled by VM/compiler) ---
  new Func({
    Name: "all",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [boolType])],
  }),
  new Func({
    Name: "none",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [boolType])],
  }),
  new Func({
    Name: "any",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [boolType])],
  }),
  new Func({
    Name: "one",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [boolType])],
  }),
  new Func({
    Name: "filter",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [arrayType])],
  }),
  new Func({
    Name: "map",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [anyType])], [arrayType])],
  }),
  new Func({
    Name: "find",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [anyType])],
  }),
  new Func({
    Name: "findIndex",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [intType])],
  }),
  new Func({
    Name: "findLast",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [anyType])],
  }),
  new Func({
    Name: "findLastIndex",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [intType])],
  }),
  new Func({
    Name: "count",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [intType])],
  }),
  new Func({
    Name: "sum",
    Predicate: true,
    Types: [FuncOf([arrayType, FuncOf([anyType], [boolType])], [intType])],
  }),
  new Func({
    Name: "groupBy",
    Predicate: true,
    Types: [
      FuncOf(
        [arrayType, FuncOf([anyType], [anyType])],
        [MapOf(anyType, arrayType)],
      ),
    ],
  }),
  new Func({
    Name: "sortBy",
    Predicate: true,
    Types: [
      FuncOf(
        [arrayType, FuncOf([anyType], [boolType]), stringType],
        [arrayType],
      ),
    ],
  }),
  new Func({
    Name: "reduce",
    Predicate: true,
    Types: [
      FuncOf(
        [arrayType, FuncOf([anyType, anyType], [anyType]), anyType],
        [anyType],
      ),
    ],
  }),
];

// --- len/type/math/conversion ---
Builtins.push(
  new Func({
    Name: "len",
    Fast: Len,
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Array:
        case Kind.Map:
        case Kind.Slice:
        case Kind.String:
        case Kind.Interface:
          return integerType;
      }
      throw new Error(`invalid argument for len (type ${args[0]!.String()})`);
    },
  }),
  new Func({
    Name: "type",
    Fast: TypeFn,
    Types: [FuncOf([anyType], [stringType])],
  }),
  new Func({
    Name: "abs",
    Fast: Abs,
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      const k = kind(args[0]);
      if (isNumericKind(k) || k === Kind.Interface) {
        return args[0]!;
      }
      throw new Error(`invalid argument for abs (type ${args[0]!.String()})`);
    },
  }),
  new Func({
    Name: "ceil",
    Fast: Ceil,
    Validate: (args: Type[]): Type => validateRoundFunc("ceil", args),
  }),
  new Func({
    Name: "floor",
    Fast: Floor,
    Validate: (args: Type[]): Type => validateRoundFunc("floor", args),
  }),
  new Func({
    Name: "round",
    Fast: Round,
    Validate: (args: Type[]): Type => validateRoundFunc("round", args),
  }),
  new Func({
    Name: "int",
    Fast: Int,
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      const k = kind(args[0]);
      if (k === Kind.Interface || isNumericKind(k) || k === Kind.String) {
        return integerType;
      }
      throw new Error(`invalid argument for int (type ${args[0]!.String()})`);
    },
  }),
  new Func({
    Name: "float",
    Fast: Float,
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      const k = kind(args[0]);
      if (k === Kind.Interface || isNumericKind(k) || k === Kind.String) {
        return floatType;
      }
      throw new Error(`invalid argument for float (type ${args[0]!.String()})`);
    },
  }),
  new Func({
    Name: "string",
    Fast: StringFn,
    Types: [FuncOf([anyType], [stringType])],
  }),
);

function isNumericKind(k: Kind): boolean {
  switch (k) {
    case Kind.Float32:
    case Kind.Float64:
    case Kind.Int:
    case Kind.Int8:
    case Kind.Int16:
    case Kind.Int32:
    case Kind.Int64:
    case Kind.Uint:
    case Kind.Uint8:
    case Kind.Uint16:
    case Kind.Uint32:
    case Kind.Uint64:
      return true;
    default:
      return false;
  }
}

// --- string functions ---
Builtins.push(
  new Func({
    Name: "trim",
    Func: (...args: any[]): any => {
      if (args.length === 1) {
        return goTrimSpace(args[0] as string);
      }
      if (args.length === 2) {
        return goTrim(args[0] as string, args[1] as string);
      }
      throw new Error(
        `invalid number of arguments for trim (expected 1 or 2, got ${args.length})`,
      );
    },
    Types: [
      FuncOf([stringType], [stringType]),
      FuncOf([stringType, stringType], [stringType]),
    ],
  }),
  new Func({
    Name: "trimPrefix",
    Func: (...args: any[]): any => {
      const s = args.length === 2 ? (args[1] as string) : " ";
      const str = args[0] as string;
      return str.startsWith(s) ? str.slice(s.length) : str;
    },
    Types: [
      FuncOf([stringType, stringType], [stringType]),
      FuncOf([stringType], [stringType]),
    ],
  }),
  new Func({
    Name: "trimSuffix",
    Func: (...args: any[]): any => {
      const s = args.length === 2 ? (args[1] as string) : " ";
      const str = args[0] as string;
      return s.length > 0 && str.endsWith(s)
        ? str.slice(0, str.length - s.length)
        : str;
    },
    Types: [
      FuncOf([stringType, stringType], [stringType]),
      FuncOf([stringType], [stringType]),
    ],
  }),
  new Func({
    Name: "upper",
    Fast: (arg: any): any => (arg as string).toUpperCase(),
    Types: [FuncOf([stringType], [stringType])],
  }),
  new Func({
    Name: "lower",
    Fast: (arg: any): any => (arg as string).toLowerCase(),
    Types: [FuncOf([stringType], [stringType])],
  }),
  new Func({
    Name: "split",
    Func: (...args: any[]): any => {
      if (args.length === 2) {
        return goSplit(args[0] as string, args[1] as string, -1);
      }
      if (args.length === 3) {
        return goSplit(args[0] as string, args[1] as string, ToInt(args[2]));
      }
      throw new Error(
        `invalid number of arguments for split (expected 2 or 3, got ${args.length})`,
      );
    },
    Types: [
      FuncOf([stringType, stringType], [stringSlice]),
      FuncOf([stringType, stringType, intType], [stringSlice]),
    ],
  }),
  new Func({
    Name: "splitAfter",
    Func: (...args: any[]): any => {
      if (args.length === 2) {
        return goSplitAfter(args[0] as string, args[1] as string, -1);
      }
      if (args.length === 3) {
        return goSplitAfter(
          args[0] as string,
          args[1] as string,
          ToInt(args[2]),
        );
      }
      throw new Error(
        `invalid number of arguments for splitAfter (expected 2 or 3, got ${args.length})`,
      );
    },
    Types: [
      FuncOf([stringType, stringType], [stringSlice]),
      FuncOf([stringType, stringType, intType], [stringSlice]),
    ],
  }),
  new Func({
    Name: "replace",
    Func: (...args: any[]): any => {
      if (args.length === 4) {
        return goReplace(
          args[0] as string,
          args[1] as string,
          args[2] as string,
          ToInt(args[3]),
        );
      }
      if (args.length === 3) {
        return goReplace(
          args[0] as string,
          args[1] as string,
          args[2] as string,
          -1,
        );
      }
      throw new Error(
        `invalid number of arguments for replace (expected 3 or 4, got ${args.length})`,
      );
    },
    Types: [
      FuncOf([stringType, stringType, stringType, intType], [stringType]),
      FuncOf([stringType, stringType, stringType], [stringType]),
    ],
  }),
  new Func({
    Name: "repeat",
    Safe: (...args: any[]): [any, number] => {
      const s = args[0] as string;
      const n = ToInt(args[1]);
      if (n < 0) {
        throw new Error(
          `invalid argument for repeat (expected positive integer, got ${n})`,
        );
      }
      if (n > 1e6) {
        throw new Error("memory budget exceeded");
      }
      return [s.repeat(n), s.length * n];
    },
    Types: [FuncOf([stringType, intType], [stringType])],
  }),
  new Func({
    Name: "join",
    Func: (...args: any[]): any => {
      const glue = args.length === 2 ? (args[1] as string) : "";
      if (Array.isArray(args[0])) {
        const s: string[] = [];
        for (const arg of args[0] as any[]) {
          s.push(arg as string);
        }
        return s.join(glue);
      }
      throw new Error(`invalid argument for join (type ${goTypeName(args[0])})`);
    },
    Types: [
      FuncOf([stringSlice, stringType], [stringType]),
      FuncOf([arrayType, stringType], [stringType]),
      FuncOf([arrayType], [stringType]),
      FuncOf([stringSlice, stringType], [stringType]),
      FuncOf([stringSlice], [stringType]),
    ],
  }),
  new Func({
    Name: "indexOf",
    Func: (...args: any[]): any =>
      BigInt(goByteIndex(args[0] as string, args[1] as string)),
    Types: [FuncOf([stringType, stringType], [intType])],
  }),
  new Func({
    Name: "lastIndexOf",
    Func: (...args: any[]): any =>
      BigInt(goByteLastIndex(args[0] as string, args[1] as string)),
    Types: [FuncOf([stringType, stringType], [intType])],
  }),
  new Func({
    Name: "hasPrefix",
    Func: (...args: any[]): any =>
      (args[0] as string).startsWith(args[1] as string),
    Types: [FuncOf([stringType, stringType], [boolType])],
  }),
  new Func({
    Name: "hasSuffix",
    Func: (...args: any[]): any =>
      (args[0] as string).endsWith(args[1] as string),
    Types: [FuncOf([stringType, stringType], [boolType])],
  }),
);

// --- Go string helpers (byte-oriented to match Go semantics) ---
function goTrimSpace(s: string): string {
  return s.replace(/^\s+|\s+$/g, "");
}

function goTrim(s: string, cutset: string): string {
  const set = new Set([...cutset]);
  let start = 0;
  let end = s.length;
  const chars = [...s];
  while (start < chars.length && set.has(chars[start]!)) start++;
  while (end > start && set.has(chars[end - 1]!)) end--;
  return chars.slice(start, end).join("");
}

// goSplit mirrors strings.Split / strings.SplitN. n<0 means no limit.
function goSplit(s: string, sep: string, n: number): string[] {
  if (n === 0) return [];
  if (sep === "") {
    // Go splits into runes.
    const runes = [...s];
    if (n > 0 && n < runes.length) {
      const head = runes.slice(0, n - 1);
      head.push(runes.slice(n - 1).join(""));
      return head;
    }
    return runes;
  }
  if (n < 0) return s.split(sep);
  const parts: string[] = [];
  let rest = s;
  while (parts.length < n - 1) {
    const idx = rest.indexOf(sep);
    if (idx < 0) break;
    parts.push(rest.slice(0, idx));
    rest = rest.slice(idx + sep.length);
  }
  parts.push(rest);
  return parts;
}

// goSplitAfter mirrors strings.SplitAfter / SplitAfterN (keeps separator).
function goSplitAfter(s: string, sep: string, n: number): string[] {
  if (n === 0) return [];
  if (sep === "") return goSplit(s, sep, n);
  const parts: string[] = [];
  let rest = s;
  while (true) {
    if (n > 0 && parts.length === n - 1) break;
    const idx = rest.indexOf(sep);
    if (idx < 0) break;
    parts.push(rest.slice(0, idx + sep.length));
    rest = rest.slice(idx + sep.length);
  }
  parts.push(rest);
  return parts;
}

// goReplace mirrors strings.Replace / ReplaceAll. n<0 means replace all.
function goReplace(s: string, oldStr: string, newStr: string, n: number): string {
  if (n === 0 || oldStr === newStr) return s;
  if (n < 0) {
    return s.split(oldStr).join(newStr);
  }
  let result = "";
  let rest = s;
  let count = 0;
  while (count < n) {
    const idx = rest.indexOf(oldStr);
    if (idx < 0) break;
    result += rest.slice(0, idx) + newStr;
    rest = rest.slice(idx + (oldStr.length || 1));
    count++;
    if (oldStr.length === 0) break;
  }
  return result + rest;
}

// goByteIndex / goByteLastIndex return byte offsets (UTF-8) to match Go.
function goByteIndex(s: string, sub: string): number {
  const idx = s.indexOf(sub);
  if (idx < 0) return -1;
  return byteLen(s.slice(0, idx));
}

function goByteLastIndex(s: string, sub: string): number {
  const idx = s.lastIndexOf(sub);
  if (idx < 0) return -1;
  return byteLen(s.slice(0, idx));
}

function byteLen(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) n += 1;
    else if (cp < 0x800) n += 2;
    else if (cp < 0x10000) n += 3;
    else n += 4;
  }
  return n;
}

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

// --- aggregate / JSON / base64 ---
Builtins.push(
  new Func({
    Name: "max",
    Func: (...args: any[]): any => minMax("max", Less, 0, ...args),
    Validate: (args: Type[]): Type => validateAggregateFunc("max", args),
  }),
  new Func({
    Name: "min",
    Func: (...args: any[]): any => minMax("min", More, 0, ...args),
    Validate: (args: Type[]): Type => validateAggregateFunc("min", args),
  }),
  new Func({
    Name: "mean",
    Func: (...args: any[]): any => {
      const [count, sum] = mean(0, ...args);
      if (count === 0) return 0.0;
      return sum / count;
    },
    Validate: (args: Type[]): Type => validateAggregateFunc("mean", args),
  }),
  new Func({
    Name: "median",
    Func: (...args: any[]): any => {
      const values = median(0, ...args);
      const n = values.length;
      if (n > 0) {
        values.sort((a, b) => a - b);
        if (n % 2 === 1) return values[(n - 1) / 2]!;
        return (values[n / 2 - 1]! + values[n / 2]!) / 2;
      }
      return 0.0;
    },
    Validate: (args: Type[]): Type => validateAggregateFunc("median", args),
  }),
  new Func({
    Name: "toJSON",
    Func: (...args: any[]): any => goMarshalIndent(args[0]),
    Types: [FuncOf([anyType], [stringType])],
  }),
  new Func({
    Name: "fromJSON",
    Func: (...args: any[]): any => goUnmarshal(args[0] as string),
    Types: [FuncOf([stringType], [anyType])],
  }),
  new Func({
    Name: "toBase64",
    Func: (...args: any[]): any => goToBase64(args[0] as string),
    Types: [FuncOf([stringType], [stringType])],
  }),
  new Func({
    Name: "fromBase64",
    Func: (...args: any[]): any => goFromBase64(args[0] as string),
    Types: [FuncOf([stringType], [stringType])],
  }),
);

// goMarshalIndent mirrors json.MarshalIndent(v, "", "  ").
// DIVERGENCE: bigint serializes as a number, GoTime/GoDuration via String().
function goMarshalIndent(v: any): string {
  return JSON.stringify(v, jsonReplacer, "  ");
}

function jsonReplacer(_key: string, value: any): any {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Map) {
    const obj: Record<string, any> = {};
    for (const [k, val] of [...value.entries()].sort(([a], [b]) => globalThis.String(a).localeCompare(globalThis.String(b)))) {
      obj[globalThis.String(k)] = val;
    }
    return obj;
  }
  if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
    const obj: Record<string, any> = {};
    for (const k of Object.keys(value).sort()) {
      obj[k] = value[k];
    }
    return obj;
  }
  return value;
}

// goUnmarshal mirrors json.Unmarshal into any. JSON numbers become JS number
// (Go float64); the VM treats them as float64 which matches expr.
function goUnmarshal(s: string): any {
  return JSON.parse(s);
}

function goToBase64(s: string): string {
  // Encode UTF-8 bytes -> base64 without relying on Buffer/btoa typings.
  const bytes = utf8Bytes(s);
  return base64Encode(bytes);
}

function goFromBase64(s: string): string {
  const bytes = base64Decode(s);
  return utf8Decode(bytes);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Encode(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

function base64Decode(s: string): number[] {
  const clean = s.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = B64.indexOf(ch);
    if (idx < 0) throw new Error("illegal base64 data");
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function utf8Bytes(s: string): number[] {
  const bytes: number[] = [];
  for (const ch of s) {
    let cp = ch.codePointAt(0)!;
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return bytes;
}

function utf8Decode(bytes: number[]): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i]!;
    let cp: number;
    if (b0 < 0x80) {
      cp = b0;
      i += 1;
    } else if (b0 < 0xe0) {
      cp = ((b0 & 0x1f) << 6) | (bytes[i + 1]! & 0x3f);
      i += 2;
    } else if (b0 < 0xf0) {
      cp =
        ((b0 & 0x0f) << 12) |
        ((bytes[i + 1]! & 0x3f) << 6) |
        (bytes[i + 2]! & 0x3f);
      i += 3;
    } else {
      cp =
        ((b0 & 0x07) << 18) |
        ((bytes[i + 1]! & 0x3f) << 12) |
        ((bytes[i + 2]! & 0x3f) << 6) |
        (bytes[i + 3]! & 0x3f);
      i += 4;
    }
    out += String.fromCodePoint(cp);
  }
  return out;
}

// --- time functions ---
// Go uses time.Time / *time.Location. This port uses GoTime and GoLocation
// from vm/runtime/gotime.ts. The WithTimezone patcher prepends a GoLocation
// constant to date()/now() calls; the builtins detect it and apply timezone.

function isGoLocation(v: any): v is GoLocation {
  return v !== null && typeof v === "object" && typeof v.name === "string" && typeof v.String === "function";
}

let nowProvider = (): number => Date.now();

export function setNowProviderForParity(provider: (() => number) | null): void {
  nowProvider = provider ?? (() => Date.now());
}

Builtins.push(
  new Func({
    Name: "now",
    Func: (...args: any[]): any => {
      const now = nowProvider();
      if (args.length === 0) {
        return new GoTime(now);
      }
      if (args.length === 1 && isGoLocation(args[0])) {
        return new GoTime(now, args[0]);
      }
      throw new Error(
        `invalid number of arguments (expected 0, got ${args.length})`,
      );
    },
    Validate: (args: Type[]): Type => {
      if (args.length === 0) return timeType;
      if (args.length === 1 && args[0] && args[0]!.AssignableTo(locationType)) {
        return timeType;
      }
      throw new Error(
        `invalid number of arguments (expected 0, got ${args.length})`,
      );
    },
    Deref: (_i: number, _arg: Type): boolean => false,
  }),
  new Func({
    Name: "duration",
    Func: (...args: any[]): any => goParseDuration(args[0] as string),
    Types: [FuncOf([stringType], [durationType])],
  }),
  new Func({
    Name: "date",
    Func: (...args: any[]): any => {
      let rest = args;
      let loc: GoLocation | undefined;
      if (rest.length > 0 && isGoLocation(rest[0])) {
        loc = rest[0];
        rest = rest.slice(1);
      }
      // rest is now [value] or [value, layout] or [value, layout, tzName]
      if (rest.length === 1) {
        // 1-arg: try ISO parse with fallback layouts
        const dateStr = rest[0] as string;
        let ms: number;
        if (loc && loc.name !== "UTC") {
          ms = parseInTimezone(dateStr, loc.name);
        } else {
          ms = Date.parse(dateStr.replace(" ", "T"));
          if (Number.isNaN(ms)) {
            // Try Go fallback layouts
            ms = tryGoFallbackParse(dateStr);
          }
        }
        return new GoTime(ms, loc);
      }
      if (rest.length === 2) {
        // 2-arg: value + layout
        const dateStr = rest[0] as string;
        const layout = rest[1] as string;
        const ms = parseGoLayout(dateStr, layout);
        return new GoTime(ms, loc);
      }
      if (rest.length === 3) {
        // 3-arg: value + layout + timezone name
        const dateStr = rest[0] as string;
        const layout = rest[1] as string;
        const tzName = rest[2] as string;
        const tzLoc = new GoLocation(tzName);
        // Parse in the given timezone
        const ms = parseGoLayoutInTimezone(dateStr, layout, tzName);
        return new GoTime(ms, loc ?? tzLoc);
      }
      throw new Error(
        `invalid number of arguments (expected 1-3, got ${rest.length})`,
      );
    },
    Validate: (args: Type[]): Type => {
      let rest = args;
      if (rest.length < 1) {
        throw new Error(
          `invalid number of arguments (expected at least 1, got ${args.length})`,
        );
      }
      if (rest[0] && rest[0]!.AssignableTo(locationType)) {
        rest = rest.slice(1);
      }
      if (rest.length > 3) {
        throw new Error(
          `invalid number of arguments (expected at most 3, got ${rest.length})`,
        );
      }
      return timeType;
    },
    Deref: (_i: number, arg: Type): boolean => {
      if (arg.AssignableTo(locationType)) return false;
      return true;
    },
  }),
  new Func({
    Name: "timezone",
    Func: (...args: any[]): any => new GoLocation(args[0] as string),
    Types: [FuncOf([stringType], [locationType])],
  }),
);

// goParseDuration mirrors time.ParseDuration -> GoDuration (nanoseconds).
function goParseDuration(s: string): GoDuration {
  const units: Record<string, bigint> = {
    ns: 1n,
    us: 1000n,
    µs: 1000n,
    ms: 1000000n,
    s: 1000000000n,
    m: 60000000000n,
    h: 3600000000000n,
  };
  const re = /(-?\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g;
  let total = 0n;
  let matched = false;
  for (const m of s.matchAll(re)) {
    matched = true;
    const value = Number(m[1]);
    const unit = units[m[2]!]!;
    total += BigInt(Math.round(value * Number(unit)));
  }
  if (!matched) {
    throw new Error(`time: invalid duration ${s}`);
  }
  return new GoDuration(total);
}

// Go fallback layouts for date() 1-arg form (mirrors Go's time package).
const GO_FALLBACK_LAYOUTS = [
  "2006-01-02",
  "15:04:05",
  "2006-01-02 15:04:05",
  "2006-01-02T15:04:05Z07:00",
  "02 Jan 06 15:04 MST",
  "Monday, 02-Jan-06 15:04:05 MST",
  "Mon, 02 Jan 2006 15:04:05 MST",
];

function tryGoFallbackParse(dateStr: string): number {
  // First try standard ISO parse
  const iso = Date.parse(dateStr.replace(" ", "T"));
  if (!Number.isNaN(iso)) return iso;
  // Then try Go layouts
  for (const layout of GO_FALLBACK_LAYOUTS) {
    try {
      return parseGoLayout(dateStr, layout);
    } catch {
      // try next
    }
  }
  throw new Error(`invalid date ${dateStr}`);
}

// Parse a date string using a Go layout, then interpret the result as local time
// in the given timezone. Returns epoch milliseconds.
function parseGoLayoutInTimezone(dateStr: string, layout: string, tzName: string): number {
  // First parse as if UTC to get the "wall clock" components
  const utcMs = parseGoLayout(dateStr, layout);
  // Now reinterpret: the parsed date/time components should be local in tzName.
  // Use the same "guess and check" approach as parseInTimezone.
  // The parsed UTC ms represents the wall-clock time interpreted as UTC.
  // We need to find the actual UTC instant that, when displayed in tzName,
  // shows the same wall-clock time.
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tzName,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  // Use parseInTimezone approach: treat the date string components as local in tz
  // Reconstruct a date string from the parsed components
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const da = d.getUTCDate();
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const isoStr = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return parseInTimezone(isoStr, tzName);
}

// --- array / map functions ---
Builtins.push(
  new Func({
    Name: "first",
    Func: (...args: any[]): any => {
      try {
        return Fetch(args[0], 0n);
      } catch {
        return undefined;
      }
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
          return anyType;
        case Kind.Slice:
        case Kind.Array:
          return args[0]!.Elem();
      }
      throw new Error(`cannot get first element from ${args[0]!.String()}`);
    },
  }),
  new Func({
    Name: "last",
    Func: (...args: any[]): any => {
      try {
        return Fetch(args[0], -1n);
      } catch {
        return undefined;
      }
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
          return anyType;
        case Kind.Slice:
        case Kind.Array:
          return args[0]!.Elem();
      }
      throw new Error(`cannot get last element from ${args[0]!.String()}`);
    },
  }),
  new Func({
    Name: "get",
    Func: get,
  }),
  new Func({
    Name: "take",
    Func: (...args: any[]): any => {
      if (args.length !== 2) {
        throw new Error(
          `invalid number of arguments (expected 2, got ${args.length})`,
        );
      }
      if (!Array.isArray(args[0])) {
        throw new Error(`cannot take from ${goTypeName(args[0])}`);
      }
      if (typeof args[1] !== "bigint" && typeof args[1] !== "number") {
        throw new Error(`cannot take ${goTypeName(args[1])} elements`);
      }
      const arr = args[0] as any[];
      const n = ToInt(args[1]);
      const to = n > arr.length ? arr.length : n;
      return arr.slice(0, to);
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 2) {
        throw new Error(
          `invalid number of arguments (expected 2, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
        case Kind.Slice:
        case Kind.Array:
          break;
        default:
          throw new Error(`cannot take from ${args[0]!.String()}`);
      }
      switch (kind(args[1])) {
        case Kind.Interface:
        case Kind.Int:
        case Kind.Int8:
        case Kind.Int16:
        case Kind.Int32:
        case Kind.Int64:
          break;
        default:
          throw new Error(`cannot take ${args[1]!.String()} elements`);
      }
      return args[0]!;
    },
  }),
);

// --- map keys/values/pairs ---
function asMapEntries(v: any): [any, any][] {
  if (v instanceof Map) return [...v.entries()];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return Object.keys(v).map((k) => [k, (v as any)[k]] as [any, any]);
  }
  return [];
}

Builtins.push(
  new Func({
    Name: "keys",
    Func: (...args: any[]): any => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      if (!isMapLike(args[0])) {
        throw new Error(`cannot get keys from ${goTypeName(args[0])}`);
      }
      return asMapEntries(args[0]).map(([k]) => k);
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
        case Kind.Map:
          return arrayType;
      }
      throw new Error(`cannot get keys from ${args[0]!.String()}`);
    },
  }),
  new Func({
    Name: "values",
    Func: (...args: any[]): any => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      if (!isMapLike(args[0])) {
        throw new Error(`cannot get values from ${goTypeName(args[0])}`);
      }
      return asMapEntries(args[0]).map(([, val]) => val);
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
        case Kind.Map:
          return arrayType;
      }
      throw new Error(`cannot get values from ${args[0]!.String()}`);
    },
  }),
  new Func({
    Name: "toPairs",
    Func: (...args: any[]): any => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      if (!isMapLike(args[0])) {
        throw new Error(`cannot transform ${goTypeName(args[0])} to pairs`);
      }
      return asMapEntries(args[0]).map(([k, val]) => [k, val]);
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
        case Kind.Map:
          return arrayType;
      }
      throw new Error(`cannot transform ${args[0]!.String()} to pairs`);
    },
  }),
  new Func({
    Name: "fromPairs",
    Func: (...args: any[]): any => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      if (!Array.isArray(args[0])) {
        throw new Error(`cannot transform ${goTypeName(args[0])} from pairs`);
      }
      const out = new Map<any, any>();
      for (const pair of args[0] as any[]) {
        if (!Array.isArray(pair)) {
          throw new Error(`invalid pair ${goTypeName(pair)}`);
        }
        if (pair.length !== 2) {
          throw new Error(`invalid pair length ${pair.length}`);
        }
        out.set(pair[0], pair[1]);
      }
      return out;
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
        case Kind.Slice:
        case Kind.Array:
          return mapType;
      }
      throw new Error(`cannot transform ${args[0]!.String()} from pairs`);
    },
  }),
);

function isMapLike(v: any): boolean {
  if (v instanceof Map) return true;
  if (v && typeof v === "object" && !Array.isArray(v)) return true;
  return false;
}

// --- reverse / uniq / concat / flatten / sort ---
Builtins.push(
  new Func({
    Name: "reverse",
    Safe: (...args: any[]): [any, number] => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      if (!Array.isArray(args[0])) {
        throw new Error(`cannot reverse ${goTypeName(args[0])}`);
      }
      const src = args[0] as any[];
      const size = src.length;
      const arr = new Array(size);
      for (let i = 0; i < size; i++) {
        arr[i] = src[size - i - 1];
      }
      return [arr, size];
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
        case Kind.Slice:
        case Kind.Array:
          return arrayType;
        default:
          throw new Error(`cannot reverse ${args[0]!.String()}`);
      }
    },
  }),
  new Func({
    Name: "uniq",
    Func: (...args: any[]): any => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      if (!Array.isArray(args[0])) {
        throw new Error(`cannot uniq ${goTypeName(args[0])}`);
      }
      const src = args[0] as any[];
      const ret: any[] = [];
      for (let i = 0; i < src.length; i++) {
        let dup = false;
        for (const r of ret) {
          if (Equal(src[i], r)) {
            dup = true;
            break;
          }
        }
        if (!dup) ret.push(src[i]);
      }
      return ret;
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      switch (kind(args[0])) {
        case Kind.Interface:
        case Kind.Slice:
        case Kind.Array:
          return arrayType;
        default:
          throw new Error(`cannot uniq ${args[0]!.String()}`);
      }
    },
  }),
  new Func({
    Name: "concat",
    Safe: (...args: any[]): [any, number] => {
      if (args.length === 0) {
        throw new Error(
          "invalid number of arguments (expected at least 1, got 0)",
        );
      }
      let size = 0;
      let arr: any[] = [];
      for (const arg of args) {
        if (!Array.isArray(arg)) {
          throw new Error(`cannot concat ${goTypeName(arg)}`);
        }
        size += arg.length;
        arr = arr.concat(arg);
      }
      return [arr, size];
    },
    Validate: (args: Type[]): Type => {
      if (args.length === 0) {
        throw new Error(
          "invalid number of arguments (expected at least 1, got 0)",
        );
      }
      for (const arg of args) {
        switch (kind(arg)) {
          case Kind.Interface:
          case Kind.Slice:
          case Kind.Array:
            break;
          default:
            throw new Error(`cannot concat ${arg.String()}`);
        }
      }
      return arrayType;
    },
  }),
  new Func({
    Name: "flatten",
    Safe: (...args: any[]): [any, number] => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      if (!Array.isArray(args[0])) {
        throw new Error(`cannot flatten ${goTypeName(args[0])}`);
      }
      const ret = flatten(args[0] as any[], 0);
      return [ret, ret.length];
    },
    Validate: (args: Type[]): Type => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments (expected 1, got ${args.length})`,
        );
      }
      for (const arg of args) {
        switch (kind(arg)) {
          case Kind.Interface:
          case Kind.Slice:
          case Kind.Array:
            break;
          default:
            throw new Error(`cannot flatten ${arg.String()}`);
        }
      }
      return arrayType;
    },
  }),
  new Func({
    Name: "sort",
    Safe: (...args: any[]): [any, number] => {
      if (args.length !== 1 && args.length !== 2) {
        throw new Error(
          `invalid number of arguments (expected 1 or 2, got ${args.length})`,
        );
      }
      if (!Array.isArray(args[0])) {
        throw new Error(`cannot sort ${goTypeName(args[0])}`);
      }
      const array = (args[0] as any[]).slice();
      let desc = false;
      if (args.length === 2) {
        if (typeof args[1] !== "string") {
          throw new Error(
            `sort order argument must be a string (got ${goTypeName(args[1])})`,
          );
        }
        const order = args[1] as string;
        if (order === "asc") desc = false;
        else if (order === "desc") desc = true;
        else throw new Error(`invalid order ${order}, expected asc or desc`);
      }
      array.sort((a, b) => {
        const lt = Less(a, b);
        const gt = More(a, b);
        const cmp = lt ? -1 : gt ? 1 : 0;
        return desc ? -cmp : cmp;
      });
      return [array, array.length];
    },
    Types: [
      FuncOf([arrayType, stringType], [arrayType]),
      FuncOf([SliceOf(intType), stringType], [arrayType]),
      FuncOf([SliceOf(floatType), stringType], [arrayType]),
      FuncOf([stringSlice, stringType], [arrayType]),
      FuncOf([arrayType], [arrayType]),
      FuncOf([SliceOf(floatType)], [arrayType]),
      FuncOf([stringSlice], [arrayType]),
      FuncOf([SliceOf(intType)], [arrayType]),
    ],
  }),
);

// --- bit functions ---
Builtins.push(
  bitFunc("bitand", (x, y) => BigInt.asIntN(64, x & y)),
  bitFunc("bitor", (x, y) => BigInt.asIntN(64, x | y)),
  bitFunc("bitxor", (x, y) => BigInt.asIntN(64, x ^ y)),
  bitFunc("bitnand", (x, y) => BigInt.asIntN(64, x & ~y)),
  bitFunc("bitshl", (x, y) => {
    if (y < 0n) {
      throw new Error(`invalid operation: negative shift count ${y} (type int)`);
    }
    return BigInt.asIntN(64, x << y);
  }),
  bitFunc("bitshr", (x, y) => {
    if (y < 0n) {
      throw new Error(`invalid operation: negative shift count ${y} (type int)`);
    }
    return BigInt.asIntN(64, x >> y);
  }),
  bitFunc("bitushr", (x, y) => {
    if (y < 0n) {
      throw new Error(`invalid operation: negative shift count ${y} (type int)`);
    }
    return BigInt.asIntN(64, BigInt.asUintN(64, x) >> y);
  }),
  new Func({
    Name: "bitnot",
    Func: (...args: any[]): any => {
      if (args.length !== 1) {
        throw new Error(
          `invalid number of arguments for bitnot (expected 1, got ${args.length})`,
        );
      }
      let x: bigint;
      try {
        x = toInt(args[0]);
      } catch (e) {
        throw new Error(`${(e as Error).message} to call bitnot`);
      }
      return BigInt.asIntN(64, ~x);
    },
    Types: [FuncOf([intType], [intType])],
  }),
);

// Mirror Go's init(): build Index (name -> position) and Names (ordered).
export const Index: Map<string, number> = new Map();
export const Names: string[] = new Array(Builtins.length);
for (let i = 0; i < Builtins.length; i++) {
  const fn = Builtins[i]!;
  Index.set(fn.Name, i);
  Names[i] = fn.Name;
}
