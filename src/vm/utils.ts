// Port of expr-lang/expr vm/utils.go
import { GoTime } from "./runtime/gotime.js";

export type VMFunc = (...params: any[]) => any;
export type SafeFunction = (...params: any[]) => [any, number];

// Scope is the per-predicate iteration scope.
// DIVERGENCE: Go uses reflect.Value for Array + typed fast-path slices. This
// port stores the array as a plain JS array (Anys) and exposes Item().
export class Scope {
  Array: any[];
  Index: number;
  Len: number;
  Count: number;
  Acc: any;
  Ints: bigint[] | null;
  Floats: number[] | null;
  Strings: string[] | null;
  Anys: any[] | null;

  constructor() {
    this.Array = [];
    this.Index = 0;
    this.Len = 0;
    this.Count = 0;
    this.Acc = null;
    this.Ints = null;
    this.Floats = null;
    this.Strings = null;
    this.Anys = null;
  }

  Item(): any {
    if (this.Ints !== null) return this.Ints[this.Index];
    if (this.Floats !== null) return this.Floats[this.Index];
    if (this.Strings !== null) return this.Strings[this.Index];
    if (this.Anys !== null) return this.Anys[this.Index];
    return this.Array[this.Index];
  }
}

export type GroupBy = Map<any, any[]>;

export class Span {
  Name: string;
  Expression: string;
  Duration: number;
  Children: Span[];
  start: number; // epoch ms

  constructor(name = "", expression = "") {
    this.Name = name;
    this.Expression = expression;
    this.Duration = 0;
    this.Children = [];
    this.start = 0;
  }
}

void GoTime;
