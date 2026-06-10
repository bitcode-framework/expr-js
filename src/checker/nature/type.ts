// TypeDescriptor: a TypeScript replacement for Go's reflect.Type.
// DIVERGENCE (documented in PARITY.md): Go's checker uses runtime reflection.
// TypeScript has no equivalent, so we model types with an explicit descriptor
// graph that reproduces the subset of reflect.Type the checker relies on:
// Kind, Elem, Key, struct fields, func in/out, and identity comparison.
import { Kind } from "./kind.js";

export interface FieldDescriptor {
  name: string;
  type: Type;
  anonymous: boolean;
  index: number[];
  // PkgPath mirrors Go's reflect.StructField.PkgPath:
  // "" (empty) = exported, non-empty = unexported.
  PkgPath?: string;
}

export class Type {
  kind: Kind;
  // name is used for String() and identity (time.Time, time.Duration markers).
  name: string;
  // elem: element type for Slice/Array/Ptr/Chan, value type for Map.
  elem: Type | null;
  // key: key type for Map.
  key: Type | null;
  // fields: ordered struct fields (Map "fast map" has none).
  fields: FieldDescriptor[];
  // in/out: function signature.
  in: Type[];
  out: Type[];
  variadic: boolean;
  // methods available on this type (name -> func Type).
  methods: Map<string, Type>;

  constructor(kind: Kind, name = "") {
    this.kind = kind;
    this.name = name;
    this.elem = null;
    this.key = null;
    this.fields = [];
    this.in = [];
    this.out = [];
    this.variadic = false;
    this.methods = new Map();
  }

  Kind(): Kind {
    return this.kind;
  }

  Elem(): Type {
    return this.elem ?? anyType;
  }

  Key(): Type {
    return this.key ?? anyType;
  }

  NumIn(): number {
    return this.in.length;
  }

  In(i: number): Type {
    return this.in[i] ?? anyType;
  }

  NumOut(): number {
    return this.out.length;
  }

  Out(i: number): Type {
    return this.out[i] ?? anyType;
  }

  IsVariadic(): boolean {
    return this.variadic;
  }

  String(): string {
    if (this.name) return this.name;
    switch (this.kind) {
      case Kind.Bool:
        return "bool";
      case Kind.Int:
        return "int";
      case Kind.Float64:
        return "float64";
      case Kind.String:
        return "string";
      case Kind.Slice:
        return `[]${this.Elem().String()}`;
      case Kind.Array:
        return `[N]${this.Elem().String()}`;
      case Kind.Map:
        return `map[${this.Key().String()}]${this.Elem().String()}`;
      case Kind.Interface:
        return "interface {}";
      case Kind.Func:
        return "func(...)";
      case Kind.Ptr:
        return `*${this.Elem().String()}`;
      default:
        return "unknown";
    }
  }

  // AssignableTo: structural assignability. For identity types compare by ref
  // or by name; "any" (empty interface) accepts everything.
  AssignableTo(t: Type): boolean {
    if (t.kind === Kind.Interface && t.methods.size === 0) return true;
    if (this === t) return true;
    if (this.kind !== t.kind) return false;
    if (this.name && t.name) return this.name === t.name;
    return true;
  }
}

// Primitive singletons mirroring Go's well-known reflect.Type values.
export const anyType = new Type(Kind.Interface, "interface {}");
export const intType = new Type(Kind.Int, "int");
export const floatType = new Type(Kind.Float64, "float64");
export const boolType = new Type(Kind.Bool, "bool");
export const stringType = new Type(Kind.String, "string");
export const timeType = new Type(Kind.Struct, "time.Time");
export const durationType = new Type(Kind.Int64, "time.Duration");

export const arrayType = (() => {
  const t = new Type(Kind.Slice, "[]interface {}");
  t.elem = anyType;
  return t;
})();

export const byteSliceType = (() => {
  const t = new Type(Kind.Slice, "[]uint8");
  t.elem = new Type(Kind.Uint8, "uint8");
  return t;
})();

export function SliceOf(elem: Type): Type {
  const t = new Type(Kind.Slice, `[]${elem.String()}`);
  t.elem = elem;
  return t;
}

export function MapOf(key: Type, value: Type): Type {
  const t = new Type(Kind.Map, `map[${key.String()}]${value.String()}`);
  t.key = key;
  t.elem = value;
  return t;
}

export function FuncOf(inTypes: Type[], outTypes: Type[], variadic = false): Type {
  const t = new Type(Kind.Func, "func");
  t.in = inTypes;
  t.out = outTypes;
  t.variadic = variadic;
  return t;
}

// Register the methods of time.Time and time.Duration on their Type
// descriptors. Go derives these from reflect at runtime; the TS checker has no
// reflection, so the method set is declared here to mirror Go's time package.
// Only the methods used in expression contexts are registered.
(() => {
  // time.Time methods. MethodByName sets Method=true, so the checker treats
  // In(0) as the receiver and subtracts it from the argument count. Therefore
  // each signature includes the receiver (timeType) as In(0), followed by the
  // actual method arguments.
  timeType.methods.set("After", FuncOf([timeType, timeType], [boolType]));
  timeType.methods.set("Before", FuncOf([timeType, timeType], [boolType]));
  timeType.methods.set("Equal", FuncOf([timeType, timeType], [boolType]));
  timeType.methods.set("Add", FuncOf([timeType, durationType], [timeType]));
  timeType.methods.set("Sub", FuncOf([timeType, timeType], [durationType]));
  timeType.methods.set("Year", FuncOf([timeType], [intType]));
  timeType.methods.set("Month", FuncOf([timeType], [intType]));
  timeType.methods.set("Day", FuncOf([timeType], [intType]));
  timeType.methods.set("Hour", FuncOf([timeType], [intType]));
  timeType.methods.set("Minute", FuncOf([timeType], [intType]));
  timeType.methods.set("Second", FuncOf([timeType], [intType]));
  timeType.methods.set("Unix", FuncOf([timeType], [intType]));
  timeType.methods.set("String", FuncOf([timeType], [stringType]));
  timeType.methods.set("Format", FuncOf([timeType, stringType], [stringType]));

  // time.Duration methods (receiver durationType as In(0)).
  durationType.methods.set("Hours", FuncOf([durationType], [floatType]));
  durationType.methods.set("Minutes", FuncOf([durationType], [floatType]));
  durationType.methods.set("Seconds", FuncOf([durationType], [floatType]));
  durationType.methods.set("String", FuncOf([durationType], [stringType]));
})();
