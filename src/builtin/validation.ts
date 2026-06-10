// Port of expr-lang/expr builtin/validation.go
// DIVERGENCE (PARITY.md): Go returns (reflect.Type, error); this port throws on
// error and returns a Type.
import { Type, anyType, floatType } from "../checker/nature/type.js";
import { Kind } from "../checker/nature/kind.js";
import { kind } from "./utils.js";

const numericKinds = new Set<Kind>([
  Kind.Int,
  Kind.Int8,
  Kind.Int16,
  Kind.Int32,
  Kind.Int64,
  Kind.Uint,
  Kind.Uint8,
  Kind.Uint16,
  Kind.Uint32,
  Kind.Uint64,
  Kind.Float32,
  Kind.Float64,
]);

// validateAggregateFunc mirrors Go builtin.validateAggregateFunc.
export function validateAggregateFunc(name: string, args: Type[]): Type {
  if (args.length === 0) {
    throw new Error(`not enough arguments to call ${name}`);
  }
  for (const arg of args) {
    const k = kind(arg);
    if (k === Kind.Interface || k === Kind.Array || k === Kind.Slice) {
      return anyType;
    }
    if (numericKinds.has(k)) {
      continue;
    }
    throw new Error(`invalid argument for ${name} (type ${arg.String()})`);
  }
  return args[0]!;
}

// validateRoundFunc mirrors Go builtin.validateRoundFunc.
export function validateRoundFunc(name: string, args: Type[]): Type {
  if (args.length !== 1) {
    throw new Error(
      `invalid number of arguments (expected 1, got ${args.length})`,
    );
  }
  const k = kind(args[0]);
  if (numericKinds.has(k) || k === Kind.Interface) {
    return floatType;
  }
  throw new Error(`invalid argument for ${name} (type ${args[0]!.String()})`);
}
