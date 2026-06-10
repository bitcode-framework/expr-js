// Port of expr-lang/expr file/error.go
// Source parity: package file
import { Location } from "./location.js";
import type { Source } from "./source.js";

export class FileError extends Error {
  Location: Location;
  Line: number;
  Column: number;
  Message: string;
  Snippet: string;
  Prev: Error | null;

  constructor(opts: {
    location?: Location;
    line?: number;
    column?: number;
    message?: string;
    snippet?: string;
    prev?: Error | null;
  } = {}) {
    super(opts.message ?? "");
    this.Location = opts.location ?? new Location();
    this.Line = opts.line ?? 0;
    this.Column = opts.column ?? 0;
    this.Message = opts.message ?? "";
    this.Snippet = opts.snippet ?? "";
    this.Prev = opts.prev ?? null;
    Object.setPrototypeOf(this, FileError.prototype);
    this.name = "FileError";
  }

  get From(): number {
    return this.Location.From;
  }

  get To(): number {
    return this.Location.To;
  }

  Error(): string {
    return this.format();
  }

  override get message(): string {
    return this.format();
  }

  override set message(_v: string) {
    // Message is computed from format(); ignore direct sets after construction.
  }

  // Bind computes Line/Column/Snippet from the source.
  // Go indexes the raw source by bytes; this port operates on UTF-16 code
  // units (JS string indices). This is identical to Go for ASCII/BMP source,
  // which covers virtually all expression text. The only possible divergence
  // is the snippet column alignment for multibyte (astral) characters, which
  // does not affect evaluation behavior. Documented divergence.
  Bind(source: Source): FileError {
    const src = source.String();

    let runeCount = 0;
    let lineStart = 0;
    this.Line = 1;
    this.Column = 0;

    let idx = 0;
    for (const ch of src) {
      if (runeCount === this.From) {
        break;
      }
      if (ch === "\n") {
        lineStart = idx + ch.length;
        this.Line++;
        this.Column = 0;
      } else {
        this.Column++;
      }
      runeCount++;
      idx += ch.length;
    }

    let lineEnd = src.indexOf("\n", lineStart);
    if (lineEnd < 0) {
      lineEnd = src.length;
    }
    if (lineEnd < lineStart) {
      lineEnd = src.length;
    }
    if (lineStart === lineEnd) {
      return this;
    }

    const prefix = "\n | ";
    const line = src.slice(lineStart, lineEnd).replace(/\t/g, " ");
    let snippet = prefix + line + prefix;
    for (let i = 0; i < this.Column; i++) {
      snippet += ".";
    }
    snippet += "^";
    this.Snippet = snippet;
    return this;
  }

  Unwrap(): Error | null {
    return this.Prev;
  }

  Wrap(err: Error): void {
    this.Prev = err;
  }

  private format(): string {
    if (this.Snippet === "") {
      return this.Message;
    }
    return `${this.Message} (${this.Line}:${this.Column + 1})${this.Snippet}`;
  }
}
