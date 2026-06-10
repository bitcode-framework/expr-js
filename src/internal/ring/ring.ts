// Port of expr-lang/expr internal/ring/ring.go
// A simple growing ring buffer.

export class Ring<T> {
  private data: (T | undefined)[] = [];
  private back = 0;
  private len = 0;
  private chunkSize: number;

  constructor(chunkSize: number) {
    if (chunkSize < 1) {
      throw new Error("chunkSize must be greater than zero");
    }
    this.chunkSize = chunkSize;
  }

  Len(): number {
    return this.len;
  }

  Cap(): number {
    return this.data.length;
  }

  Reset(): void {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = undefined;
    }
    this.back = 0;
    this.len = 0;
  }

  Nth(n: number): [T | undefined, boolean] {
    if (n < 0 || n >= this.len || this.data.length === 0) {
      return [undefined, false];
    }
    n = (n + this.back) % this.data.length;
    return [this.data[n], true];
  }

  Dequeue(): [T | undefined, boolean] {
    if (this.len === 0) {
      return [undefined, false];
    }
    const v = this.data[this.back];
    this.data[this.back] = undefined;
    this.len--;
    this.back = (this.back + 1) % this.data.length;
    return [v, true];
  }

  Enqueue(v: T): void {
    if (this.len === this.data.length) {
      this.grow();
    }
    const writePos = (this.back + this.len) % this.data.length;
    this.data[writePos] = v;
    this.len++;
  }

  private grow(): void {
    const s: (T | undefined)[] = new Array(this.data.length + this.chunkSize).fill(
      undefined,
    );
    if (this.len > 0) {
      let chunk1 = this.back + this.len;
      if (chunk1 > this.data.length) {
        chunk1 = this.data.length;
      }
      let copied = 0;
      for (let i = this.back; i < chunk1; i++) {
        s[copied++] = this.data[i];
      }
      if (copied < this.len) {
        const chunk2 = this.len - copied;
        for (let i = 0; i < chunk2; i++) {
          s[copied + i] = this.data[i];
        }
      }
    }
    this.back = 0;
    this.data = s;
  }
}

export function New<T>(chunkSize: number): Ring<T> {
  return new Ring<T>(chunkSize);
}
