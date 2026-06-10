// Port of expr-lang/expr checker/nature/nature.go
// DIVERGENCE (documented in PARITY.md): Go uses reflect for type introspection.
// This port uses the TypeDescriptor system in ./type.ts. Behavior of the type
// checker is reproduced; the underlying mechanism differs.
import {
  Type,
  anyType,
  intType,
  floatType,
  arrayType,
  byteSliceType,
  timeType,
  durationType,
  FuncOf,
  SliceOf,
} from "./type.js";
import { Kind, kindIsInteger, kindIsFloat } from "./kind.js";
import type { Func } from "../../builtin/function.js";

// Built-in Go type names that are allowed to compare across numeric kinds.
// User-defined named types (e.g., ModeEnum, EnvStr) are NOT in this set.
const BUILTIN_TYPE_NAMES = new Set([
  "bool", "int", "int8", "int16", "int32", "int64",
  "uint", "uint8", "uint16", "uint32", "uint64",
  "float32", "float64", "string",
  "interface {}", "time.Time", "time.Duration",
]);

export enum NatureCheck {
  BoolCheck = 1,
  StringCheck,
  IntegerCheck,
  NumberCheck,
  MapCheck,
  ArrayCheck,
  TimeCheck,
  DurationCheck,
}

// Cache is a no-op placeholder in the TS port. Go uses it to memoize reflect
// lookups; our descriptors are precomputed so the cache carries no state.
export class Cache {}

export class Nature {
  Type: Type | null;
  Kind: Kind;

  // Ref: predicate Out nature, or array element nature.
  Ref: Nature | null;

  // map-only data
  Fields: Map<string, Nature> | null;
  DefaultMapValue: Nature | null;

  // callable-only data
  Func: Func | null;
  MethodIndex: number;

  Nil: boolean;
  Strict: boolean;
  Method: boolean;
  IsInteger: boolean;
  IsFloat: boolean;

  constructor(init: Partial<Nature> = {}) {
    this.Type = init.Type ?? null;
    this.Kind = init.Kind ?? Kind.Invalid;
    this.Ref = init.Ref ?? null;
    this.Fields = init.Fields ?? null;
    this.DefaultMapValue = init.DefaultMapValue ?? null;
    this.Func = init.Func ?? null;
    this.MethodIndex = init.MethodIndex ?? 0;
    this.Nil = init.Nil ?? false;
    this.Strict = init.Strict ?? false;
    this.Method = init.Method ?? false;
    this.IsInteger = init.IsInteger ?? false;
    this.IsFloat = init.IsFloat ?? false;
  }

  IsAny(_c?: Cache): boolean {
    return (
      this.Type !== null &&
      this.Kind === Kind.Interface &&
      this.NumMethods() === 0
    );
  }

  IsUnknown(_c?: Cache): boolean {
    return (this.Type === null && !this.Nil) || this.IsAny();
  }

  String(): string {
    if (this.Type !== null) {
      return this.Type.String();
    }
    return "unknown";
  }

  Deref(_c?: Cache): Nature {
    if (this.Type !== null && this.Kind === Kind.Ptr) {
      return FromType(this.Type.Elem());
    }
    return this;
  }

  Key(_c?: Cache): Nature {
    if (this.Kind === Kind.Map && this.Type !== null) {
      return FromType(this.Type.Key());
    }
    return new Nature();
  }

  Elem(_c?: Cache): Nature {
    switch (this.Kind) {
      case Kind.Ptr:
        return FromType(this.Type!.Elem());
      case Kind.Map:
        if (this.DefaultMapValue !== null) {
          return this.DefaultMapValue;
        }
        return FromType(this.Type!.Elem());
      case Kind.Slice:
      case Kind.Array:
        if (this.Ref !== null) {
          return this.Ref;
        }
        return FromType(this.Type!.Elem());
    }
    return new Nature();
  }

  AssignableTo(nt: Nature): boolean {
    if (this.Nil) {
      switch (nt.Kind) {
        case Kind.Ptr:
        case Kind.Interface:
        case Kind.Chan:
        case Kind.Func:
        case Kind.Map:
        case Kind.Slice:
          return true;
      }
    }
    if (
      this.Type === null ||
      nt.Type === null ||
      (this.Kind !== nt.Kind && nt.Kind !== Kind.Interface)
    ) {
      return false;
    }
    return this.Type.AssignableTo(nt.Type);
  }

  NumMethods(_c?: Cache): number {
    return this.Type !== null ? this.Type.methods.size : 0;
  }

  MethodByName(_c: Cache | undefined, name: string): [Nature, boolean] {
    if (this.Type !== null) {
      const m = this.Type.methods.get(name);
      if (m) {
        const nt = FromType(m);
        nt.Method = true;
        return [nt, true];
      }
    }
    return [new Nature(), false];
  }

  NumIn(): number {
    return this.Type !== null ? this.Type.NumIn() : 0;
  }

  In(_c: Cache | undefined, i: number): Nature {
    return FromType(this.Type!.In(i));
  }

  InElem(c: Cache | undefined, i: number): Nature {
    return this.In(c, i).Elem(c);
  }

  IsFirstArgUnknown(_c?: Cache): boolean {
    if (this.Type !== null) {
      return FromType(this.Type.In(0)).IsUnknown();
    }
    return false;
  }

  NumOut(): number {
    return this.Type !== null ? this.Type.NumOut() : 0;
  }

  Out(_c: Cache | undefined, i: number): Nature {
    if (this.Type === null) return new Nature();
    return FromType(this.Type.Out(i));
  }

  IsVariadic(): boolean {
    return this.Type !== null ? this.Type.IsVariadic() : false;
  }

  FieldByName(_c: Cache | undefined, name: string): [Nature, boolean] {
    if (this.Kind !== Kind.Struct || this.Type === null) {
      return [new Nature(), false];
    }
    const f = this.Type.fields.find((fd) => fd.name === name);
    if (f) {
      return [FromType(f.type), true];
    }
    return [new Nature(), false];
  }

  IsFastMap(): boolean {
    return (
      this.Type !== null &&
      this.Type.Kind() === Kind.Map &&
      this.Type.Key().Kind() === Kind.String &&
      this.Type.Elem().Kind() === Kind.Interface
    );
  }

  Get(c: Cache | undefined, name: string): [Nature, boolean] {
    if (this.Kind === Kind.Map && this.Fields !== null) {
      if (this.Fields.has(name)) {
        return [this.Fields.get(name)!, true];
      }
      return [new Nature(), false];
    }
    return this.getSlow(c, name);
  }

  private getSlow(c: Cache | undefined, name: string): [Nature, boolean] {
    const [m, ok] = this.MethodByName(c, name);
    if (ok) {
      return [m, true];
    }
    let t = this.Type;
    let k = this.Kind;
    if (k === Kind.Ptr && t !== null) {
      t = t.Elem();
      k = t.Kind();
    }
    if (k === Kind.Struct && t !== null) {
      const f = t.fields.find((fd) => fd.name === name);
      if (f) {
        return [FromType(f.type), true];
      }
    }
    return [new Nature(), false];
  }

  FieldIndex(_c: Cache | undefined, name: string): [number[] | null, boolean] {
    if (this.Kind !== Kind.Struct || this.Type === null) {
      return [null, false];
    }
    const f = this.Type.fields.find((fd) => fd.name === name);
    if (f) {
      return [f.index, true];
    }
    return [null, false];
  }

  All(_c?: Cache): Map<string, Nature> {
    const table = new Map<string, Nature>();
    if (this.Type === null) {
      return table;
    }
    for (const [methodName, methodType] of this.Type.methods) {
      const nt = FromType(methodType);
      nt.Method = true;
      table.set(methodName, nt);
    }
    let t = this.Type;
    if (t.Kind() === Kind.Ptr) {
      t = t.Elem();
    }
    if (t.Kind() === Kind.Struct) {
      for (const f of t.fields) {
        if (table.has(f.name)) continue;
        table.set(f.name, FromType(f.type));
      }
    } else if (t.Kind() === Kind.Map && this.Fields !== null) {
      for (const [key, nt] of this.Fields) {
        if (table.has(key)) continue;
        table.set(key, nt);
      }
    }
    return table;
  }

  IsNumber(): boolean {
    return this.IsInteger || this.IsFloat;
  }

  PromoteNumericNature(_c: Cache | undefined, rhs: Nature): Nature {
    if (this.IsUnknown() || rhs.IsUnknown()) {
      return new Nature();
    }
    if (this.IsFloat || rhs.IsFloat) {
      return FromType(floatType);
    }
    return FromType(intType);
  }

  IsTime(): boolean {
    return this.Type === timeType;
  }

  IsDuration(): boolean {
    return this.Type === durationType;
  }

  IsBool(): boolean {
    return this.Kind === Kind.Bool;
  }

  IsString(): boolean {
    return this.Kind === Kind.String;
  }

  IsByteSlice(): boolean {
    return this.Type === byteSliceType;
  }

  IsArray(): boolean {
    return this.Kind === Kind.Slice || this.Kind === Kind.Array;
  }

  IsMap(): boolean {
    return this.Kind === Kind.Map;
  }

  IsStruct(): boolean {
    return this.Kind === Kind.Struct;
  }

  IsFunc(): boolean {
    return this.Kind === Kind.Func;
  }

  IsPointer(): boolean {
    return this.Kind === Kind.Ptr;
  }

  IsAnyOf(...cs: NatureCheck[]): boolean {
    let result = false;
    for (let i = 0; i < cs.length && !result; i++) {
      switch (cs[i]) {
        case NatureCheck.BoolCheck:
          result = this.IsBool();
          break;
        case NatureCheck.StringCheck:
          result = this.IsString();
          break;
        case NatureCheck.IntegerCheck:
          result = this.IsInteger;
          break;
        case NatureCheck.NumberCheck:
          result = this.IsNumber();
          break;
        case NatureCheck.MapCheck:
          result = this.IsMap();
          break;
        case NatureCheck.ArrayCheck:
          result = this.IsArray();
          break;
        case NatureCheck.TimeCheck:
          result = this.IsTime();
          break;
        case NatureCheck.DurationCheck:
          result = this.IsDuration();
          break;
        default:
          throw new Error(`unknown check value ${cs[i]}`);
      }
    }
    return result;
  }

  ComparableTo(_c: Cache | undefined, rhs: Nature): boolean {
    if (this.IsUnknown() || rhs.IsUnknown() || this.Nil || rhs.Nil) {
      return true;
    }
    // Named type distinction: Go's reflect-based checker distinguishes user-defined
    // named types (e.g., ModeEnum, EnvStr) from built-in types (int, float64, string).
    // Two types with different user-defined names are NOT comparable even if their
    // underlying kinds match. Built-in types (int, float64, etc.) can be compared
    // across numeric kinds.
    const lName = this.Type?.name ?? "";
    const rName = rhs.Type?.name ?? "";
    if (lName && rName && lName !== rName) {
      const lBuiltin = BUILTIN_TYPE_NAMES.has(lName);
      const rBuiltin = BUILTIN_TYPE_NAMES.has(rName);
      if (!lBuiltin || !rBuiltin) {
        // At least one is a custom named type — require exact type match.
        return this.AssignableTo(rhs);
      }
      // Both are built-in types — allow numeric kind comparison.
    }
    return (
      (this.IsNumber() && rhs.IsNumber()) ||
      (this.IsDuration() && rhs.IsDuration()) ||
      (this.IsTime() && rhs.IsTime()) ||
      (this.IsArray() && rhs.IsArray()) ||
      this.AssignableTo(rhs)
    );
  }

  MaybeCompatible(_c: Cache | undefined, rhs: Nature, ...cs: NatureCheck[]): boolean {
    const nIsUnknown = this.IsUnknown();
    const rhsIsUnknown = rhs.IsUnknown();
    return (
      (nIsUnknown && rhsIsUnknown) ||
      (nIsUnknown && rhs.IsAnyOf(...cs)) ||
      (rhsIsUnknown && this.IsAnyOf(...cs))
    );
  }

  MakeArrayOf(_c?: Cache): Nature {
    const nt = FromType(arrayType);
    nt.Ref = this;
    return nt;
  }
}

// NatureOf returns a Nature describing "i". If "i" is nil it returns a Nature
// describing nil.
export function NatureOf(i: any): Nature {
  if (i === null || i === undefined) {
    return new Nature({ Nil: true });
  }
  return FromType(typeOfValue(i));
}

// FromType returns a Nature describing a value of type "t".
export function FromType(t: Type | null): Nature {
  if (t === null) {
    return new Nature();
  }
  const k = t.Kind();
  let isInteger = false;
  let isFloat = false;
  if (kindIsInteger(k)) {
    isInteger = true;
  } else if (kindIsFloat(k)) {
    isFloat = true;
  }
  const n = new Nature({
    Type: t,
    Kind: k,
    IsInteger: isInteger,
    IsFloat: isFloat,
  });
  // Map "fast map" fields and struct fields are carried on the Type descriptor.
  if (k === Kind.Struct || (k === Kind.Map && t.fields.length > 0)) {
    n.Fields = new Map();
    for (const f of t.fields) {
      n.Fields.set(f.name, FromType(f.type));
    }
  }
  return n;
}

export function ArrayFromType(t: Type | null): Nature {
  const elem = FromType(t);
  const nt = FromType(arrayType);
  nt.Ref = elem;
  return nt;
}

// typeOfValue infers a Type descriptor from a runtime JS value. This is the
// TS-port equivalent of reflect.TypeOf for env construction.
function typeOfValue(i: any): Type {
  if (typeof i === "boolean") return new Type(Kind.Bool, "bool");
  if (typeof i === "bigint") return intType;
  if (typeof i === "number") {
    return Number.isInteger(i) ? intType : floatType;
  }
  if (typeof i === "string") return stringTypeRef;
  if (Array.isArray(i)) {
    if (i.length > 0) {
      const elemType = typeOfValue(i[0]);
      return SliceOf(elemType);
    }
    return arrayType;
  }
  if (typeof i === "function") {
    // DIVERGENCE: JS functions carry no introspectable signature. Go derives
    // in/out via reflect. We model an env function as variadic `func(...any)
    // any`, which is how Go treats a function added without explicit Types:
    // it accepts any args and returns a single any. This lets the checker
    // accept env-method calls (e.g. Add(1,2)) and type their result as any.
    const f = new Type(Kind.Func, "func(...interface {}) interface {}");
    f.in = [arrayType];
    f.out = [anyType];
    f.variadic = true;
    return f;
  }
  if (i && typeof i === "object") {
    // GoTime / GoDuration / GoLocation runtime values map to their canonical
    // Type markers. Duck-typed by constructor name to avoid circular imports.
    const ctor = i.constructor?.name;
    if (ctor === "GoTime") return timeType;
    if (ctor === "GoDuration") return durationType;
    if (ctor === "GoLocation") return locationTypeRef;
    // Struct-marked objects: carry type metadata via STRUCT_TYPE symbol.
    const structMeta = i[STRUCT_TYPE] as StructMeta | undefined;
    if (structMeta) {
      return buildStructType(structMeta);
    }
  }
  if (i instanceof Map || (i && typeof i === "object")) {
    // Check if map values carry struct metadata for typed map detection.
    if (!(i instanceof Map) && !i[STRUCT_TYPE]) {
      const vals = Object.values(i);
      if (vals.length > 0 && vals[0] && typeof vals[0] === "object" && (vals[0] as any)[STRUCT_TYPE]) {
        const valType = typeOfValue(vals[0]);
        const mt = new Type(Kind.Map, `map[string]${valType.String()}`);
        mt.key = new Type(Kind.String, "string");
        mt.elem = valType;
        return mt;
      }
    }
    return new Type(Kind.Map, "map[string]interface {}");
  }
  return anyType;
}

const stringTypeRef = new Type(Kind.String, "string");
// locationType mirrors builtin/utils.ts locationType (*time.Location).
// Defined here to avoid circular import (nature → builtin → nature/type).
const locationTypeRef = (() => {
  const t = new Type(Kind.Ptr, "*time.Location");
  t.elem = new Type(Kind.Struct, "time.Location");
  t.methods.set("String", FuncOf([t], [stringTypeRef]));
  if (t.elem) {
    t.elem.methods.set("String", FuncOf([t], [stringTypeRef]));
  }
  return t;
})();

// --- Struct metadata system for checker strict-struct parity ---
// Allows mock env objects to carry type information (field types, method types)
// so the checker can enforce closed struct field/method access.

export const STRUCT_TYPE = Symbol.for("expr.structType");

export interface StructMeta {
  name: string;
  fields: Record<string, Type>;
  methods?: Record<string, Type>;
}

function buildStructType(meta: StructMeta): Type {
  const t = new Type(Kind.Struct, meta.name);
  for (const [fieldName, fieldType] of Object.entries(meta.fields)) {
    t.fields.push({ name: fieldName, type: fieldType, anonymous: false, index: [] });
  }
  if (meta.methods) {
    for (const [methodName, methodType] of Object.entries(meta.methods)) {
      t.methods.set(methodName, methodType);
    }
  }
  return t;
}

// Mark an object as a typed struct for the checker.
// Runtime behavior is unchanged — the symbol is invisible to normal property access.
export function markStruct<T extends Record<string, any>>(
  obj: T,
  name: string,
  fields: Record<string, Type>,
  methods?: Record<string, Type>,
): T {
  (obj as any)[STRUCT_TYPE] = { name, fields, methods } as StructMeta;
  return obj;
}

