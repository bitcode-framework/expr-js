// Port of expr-lang/expr builtin/utils.go
// DIVERGENCE (PARITY.md): Go uses reflect.Type; this port uses the TypeScript
// Type descriptor from checker/nature/type.ts. Go int/int64 -> JS bigint,
// Go float64 -> JS number. toInt returns bigint so bit functions preserve
// 64-bit integer semantics (Go int).
import { Func } from "./function.js";
import {
  Type,
  anyType,
  intType,
  floatType,
  stringType,
  arrayType,
  MapOf,
  timeType,
  FuncOf,
} from "../checker/nature/type.js";
import { Kind } from "../checker/nature/kind.js";

// Type singletons mirroring Go's package-level reflect.Type values.
export { anyType, floatType, arrayType, timeType };
// Go: integerType = reflect.TypeOf(0) -> int.
export const integerType = intType;
// Go: mapType = reflect.TypeOf(map[any]any{}).
export const mapType = MapOf(anyType, anyType);
// Go: locationType = reflect.TypeOf(new(time.Location)) -> *time.Location.
export const locationType = (() => {
  const t = new Type(Kind.Ptr, "*time.Location");
  t.elem = new Type(Kind.Struct, "time.Location");
  // Register String() method on both Ptr and elem so checker resolves it.
  t.methods.set("String", FuncOf([t], [stringType]));
  if (t.elem) {
    t.elem.methods.set("String", FuncOf([t], [stringType]));
  }
  return t;
})();

// kind reproduces Go builtin.kind: nil -> Invalid, else deref then Kind().
export function kind(t: Type | null | undefined): Kind {
  if (t === null || t === undefined) {
    return Kind.Invalid;
  }
  // deref.Type: follow pointer to element.
  let cur: Type = t;
  while (cur.Kind() === Kind.Ptr && cur.elem) {
    cur = cur.elem;
  }
  return cur.Kind();
}

// toInt converts a runtime value to a Go int (JS bigint). Throws on non-int.
// DIVERGENCE: Go switches on concrete int/uint kinds; JS only has number and
// bigint, so we accept bigint directly and integer-valued numbers.
export function toInt(val: any): bigint {
  if (typeof val === "bigint") {
    return val;
  }
  if (typeof val === "number" && Number.isInteger(val)) {
    return BigInt(val);
  }
  throw new Error(`cannot use ${goTypeName(val)} as argument (type int)`);
}

function goTypeName(v: any): string {
  if (v === null || v === undefined) return "<nil>";
  if (typeof v === "bigint") return "int";
  if (typeof v === "number") return "float64";
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "[]interface {}";
  return "interface {}";
}

// bitFunc mirrors Go builtin.bitFunc: a 2-arg integer function. The Go body
// returns (any, error); here fn returns any and throws on error.
export function bitFunc(name: string, fn: (x: bigint, y: bigint) => any): Func {
  return new Func({
    Name: name,
    Func: (...args: any[]): any => {
      if (args.length !== 2) {
        throw new Error(
          `invalid number of arguments for ${name} (expected 2, got ${args.length})`,
        );
      }
      let x: bigint;
      let y: bigint;
      try {
        x = toInt(args[0]);
      } catch (e) {
        throw new Error(`${(e as Error).message} to call ${name}`);
      }
      try {
        y = toInt(args[1]);
      } catch (e) {
        throw new Error(`${(e as Error).message} to call ${name}`);
      }
      return fn(x, y);
    },
    Types: [FuncOf([intType, intType], [intType])],
  });
}
