// Port of expr-lang/expr builtin/function.go
import type { Type } from "../checker/nature/type.js";

export class Func {
  Name: string;
  // Fast: func(arg any) any
  Fast?: (arg: any) => any;
  // Func: func(args ...any) (any, error)
  Func?: (...args: any[]) => any;
  // Safe: func(args ...any) (any, uint, error)
  Safe?: (...args: any[]) => [any, number];
  // Types: []reflect.Type
  Types?: Type[];
  // Validate: func(args []reflect.Type) (reflect.Type, error)
  Validate?: (args: Type[]) => Type;
  // Deref: func(i int, arg reflect.Type) bool
  Deref?: (i: number, arg: Type) => boolean;
  Predicate: boolean;

  constructor(init: Partial<Func> = {}) {
    this.Name = init.Name ?? "";
    this.Fast = init.Fast;
    this.Func = init.Func;
    this.Safe = init.Safe;
    this.Types = init.Types;
    this.Validate = init.Validate;
    this.Deref = init.Deref;
    this.Predicate = init.Predicate ?? false;
  }

  Type(): Type | null {
    if (this.Types && this.Types.length > 0) {
      return this.Types[0]!;
    }
    return null;
  }
}

// Alias preserving upstream Go name "Function".
export { Func as Function };
