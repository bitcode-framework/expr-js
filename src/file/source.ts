// Port of expr-lang/expr file/source.go
// Source parity: package file

export class Source {
  private raw: string;

  constructor(contents: string) {
    this.raw = contents;
  }

  String(): string {
    return this.raw;
  }

  // Snippet returns the line at the given 1-based line number.
  Snippet(line: number): [string, boolean] {
    if (this.raw === "") {
      return ["", false];
    }
    let start = 0;
    for (let i = 1; i < line; i++) {
      const pos = this.raw.indexOf("\n", start);
      if (pos < 0) {
        return ["", false];
      }
      start = pos + 1;
    }
    let end = this.raw.indexOf("\n", start);
    if (end < start) {
      end = this.raw.length;
    }
    return [this.raw.slice(start, end), true];
  }
}

export function NewSource(contents: string): Source {
  return new Source(contents);
}
