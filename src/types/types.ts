// Port of expr-lang/expr types/types.go
//
// This package maps user-facing type descriptors to checker Nature descriptors.
// It is the public type-builder used to declare the expected shape of an env.
//
// DIVERGENCE (documented inline): Go uses reflect.TypeOf to derive a Type from a
// runtime value. JavaScript has no reflection and no distinct fixed-width integer
// kinds, so:
//   - TypeOf(v) infers a checker Type descriptor from the JS runtime value.
//   - The exported integer primitives (Int, Int8, ... Uint64) all collapse to the
//     single int descriptor because JS numbers have no width. The float primitives
//     collapse to float64. Names are preserved for source parity.
import {
  Type as NatureType,
  intType,
  floatType,
  boolType,
  stringType,
} from "../checker/nature/type.js";
import { Nature, NatureOf, FromType } from "../checker/nature/nature.js";

// Type is a type that can be used to represent a value.
export interface Type {
  Nature(): Nature;
  Equal(t: Type): boolean;
  String(): string;
}

// TypeOf returns a Type describing the given runtime value.
// DIVERGENCE: Go uses reflect.TypeOf(v); this infers a checker Type descriptor
// from the JS value (see ../checker/nature typeOfValue semantics).
export function TypeOf(v: any): Type {
  if (v === null || v === undefined) {
    return Nil;
  }
  const nt = NatureOf(v);
  return new RType(nt.Type);
}

class AnyType implements Type {
  Nature(): Nature {
    return FromType(null);
  }
  Equal(_t: Type): boolean {
    return true;
  }
  String(): string {
    return "any";
  }
}

class NilType implements Type {
  Nature(): Nature {
    return NatureOf(null);
  }
  Equal(t: Type): boolean {
    if (t === Any) {
      return true;
    }
    return t === Nil;
  }
  String(): string {
    return "nil";
  }
}

class RType implements Type {
  t: NatureType | null;
  constructor(t: NatureType | null) {
    this.t = t;
  }
  Nature(): Nature {
    return FromType(this.t);
  }
  Equal(t: Type): boolean {
    if (t === Any) {
      return true;
    }
    if (t instanceof RType) {
      return this.tString() === t.tString();
    }
    return false;
  }
  String(): string {
    return this.tString();
  }
  private tString(): string {
    return this.t !== null ? this.t.String() : "interface {}";
  }
}

// Nil and Any are singleton type descriptors.
export const Nil: Type = new NilType();
export const Any: Type = new AnyType();

// Primitive type descriptors built from explicit checker descriptors.
// DIVERGENCE: all integer widths collapse to the single int descriptor and both
// float widths collapse to float64, because JS numbers are width-less. Go derives
// each via reflect.TypeOf(int8(0)) etc.; names are preserved for source parity.
export const Int: Type = new RType(intType);
export const Int8: Type = new RType(intType);
export const Int16: Type = new RType(intType);
export const Int32: Type = new RType(intType);
export const Int64: Type = new RType(intType);
export const Uint: Type = new RType(intType);
export const Uint8: Type = new RType(intType);
export const Uint16: Type = new RType(intType);
export const Uint32: Type = new RType(intType);
export const Uint64: Type = new RType(intType);
export const Float: Type = new RType(floatType);
export const Float64: Type = new RType(floatType);
export const String: Type = new RType(stringType);
export const Bool: Type = new RType(boolType);

// Extra is a sentinel key that, when present in a Map, marks the map as
// non-strict and supplies the default value type for unknown keys.
export const Extra = "[[__extra_keys__]]";

// Map represents a map[string]any type with defined keys.
// Go models this as `type Map map[string]Type`; in TS it is a class wrapping a
// string-keyed record of field Types. Construct with `new Map({ key: Int })`.
export class Map implements Type {
  fields: Record<string, Type>;
  constructor(fields: Record<string, Type> = {}) {
    this.fields = fields;
  }

  Nature(): Nature {
    // NatureOf({}) yields a fast-map nature; we then attach strict fields.
    // DIVERGENCE: Go allocates a TypeData struct (nt.TypeData = new(TypeData));
    // the TS Nature has no TypeData field, so this allocation is omitted.
    const nt = NatureOf({});
    nt.Fields = new globalThis.Map<string, Nature>();
    nt.Strict = true;
    for (const k of Object.keys(this.fields)) {
      const v = this.fields[k]!;
      if (k === Extra) {
        nt.Strict = false;
        nt.DefaultMapValue = v.Nature();
        continue;
      }
      nt.Fields.set(k, v.Nature());
    }
    return nt;
  }

  Equal(t: Type): boolean {
    if (t === Any) {
      return true;
    }
    if (!(t instanceof Map)) {
      return false;
    }
    const mKeys = Object.keys(this.fields);
    const tKeys = Object.keys(t.fields);
    if (mKeys.length !== tKeys.length) {
      return false;
    }
    for (const k of mKeys) {
      const v = this.fields[k]!;
      const other = t.fields[k];
      if (other === undefined || !v.Equal(other)) {
        return false;
      }
    }
    return true;
  }

  String(): string {
    const pairs: string[] = [];
    for (const k of Object.keys(this.fields)) {
      pairs.push(`${k}: ${this.fields[k]!.String()}`);
    }
    return `Map{${pairs.join(", ")}}`;
  }
}

// Array returns a type that represents an array of the given type.
export function Array(of: Type): Type {
  return new ArrayType(of);
}

class ArrayType implements Type {
  of: Type;
  constructor(of: Type) {
    this.of = of;
  }

  Nature(): Nature {
    const of = this.of.Nature();
    // NatureOf([]) yields an array (slice) nature.
    // DIVERGENCE: Go allocates a TypeData struct here too; omitted in TS.
    const nt = NatureOf([]);
    nt.Fields = new globalThis.Map<string, Nature>();
    nt.Ref = of;
    return nt;
  }

  Equal(t: Type): boolean {
    if (t === Any) {
      return true;
    }
    if (!(t instanceof ArrayType)) {
      return false;
    }
    return this.of.Equal(t.of);
  }

  String(): string {
    return `Array{${this.of.String()}}`;
  }
}
