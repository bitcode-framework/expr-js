// Port of Go reflect.Kind, used by checker/nature.
// DIVERGENCE: Go uses reflect.Kind. TypeScript has no reflection, so we model
// the subset of kinds the expr type system actually distinguishes. Documented
// in PARITY.md (checker/nature reflection divergence).

export enum Kind {
  Invalid = 0,
  Bool,
  Int,
  Int8,
  Int16,
  Int32,
  Int64,
  Uint,
  Uint8,
  Uint16,
  Uint32,
  Uint64,
  Uintptr,
  Float32,
  Float64,
  String,
  Slice,
  Array,
  Map,
  Struct,
  Func,
  Ptr,
  Interface,
  Chan,
}

export function kindIsInteger(k: Kind): boolean {
  return (
    k === Kind.Int ||
    k === Kind.Int8 ||
    k === Kind.Int16 ||
    k === Kind.Int32 ||
    k === Kind.Int64 ||
    k === Kind.Uint ||
    k === Kind.Uint8 ||
    k === Kind.Uint16 ||
    k === Kind.Uint32 ||
    k === Kind.Uint64 ||
    k === Kind.Uintptr
  );
}

export function kindIsFloat(k: Kind): boolean {
  return k === Kind.Float32 || k === Kind.Float64;
}
