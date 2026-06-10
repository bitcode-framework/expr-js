// Port of expr-lang/expr vm/runtime/sort.go
import { Less } from "./helpers.js";

export class SortBy {
  Desc: boolean;
  Array: any[];
  Values: any[];
  constructor(desc = false) {
    this.Desc = desc;
    this.Array = [];
    this.Values = [];
  }
  Len(): number {
    return this.Array.length;
  }
  // sort using a stable comparator over (Array, Values) pairs.
  sort(): void {
    const idx = this.Array.map((_, i) => i);
    idx.sort((i, j) => {
      const a = this.Values[i];
      const b = this.Values[j];
      const less = this.Desc ? Less(b, a) : Less(a, b);
      if (less) return -1;
      const greater = this.Desc ? Less(a, b) : Less(b, a);
      if (greater) return 1;
      return i - j; // stable
    });
    this.Array = idx.map((i) => this.Array[i]);
    this.Values = idx.map((i) => this.Values[i]);
  }
}

export class Sort {
  Desc: boolean;
  Array: any[];
  constructor(desc = false, array: any[] = []) {
    this.Desc = desc;
    this.Array = array;
  }
  Len(): number {
    return this.Array.length;
  }
  sort(): void {
    const arr = this.Array;
    const idx = arr.map((_, i) => i);
    idx.sort((i, j) => {
      const a = arr[i];
      const b = arr[j];
      const less = this.Desc ? Less(b, a) : Less(a, b);
      if (less) return -1;
      const greater = this.Desc ? Less(a, b) : Less(b, a);
      if (greater) return 1;
      return i - j;
    });
    this.Array = idx.map((i) => arr[i]);
  }
}
