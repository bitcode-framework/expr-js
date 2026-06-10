// Port of expr-lang/expr parser/lexer/lexer.go
import { Source } from "../../file/source.js";
import { FileError } from "../../file/error.js";
import { Location } from "../../file/location.js";
import { Ring } from "../../internal/ring/ring.js";
import { Token, Kind } from "./token.js";
import { root, StateFn } from "./state.js";

const ringChunkSize = 10;

// EOF sentinel rune (Go uses -1).
export const eof = -1;

// Lex buffers and returns the tokens of a disposable Lexer.
export function Lex(source: Source): Token[] {
  const tokens: Token[] = [];
  const l = New();
  l.Reset(source);
  for (;;) {
    const t = l.Next();
    if (t === null) {
      // io.EOF -> finished
      return tokens;
    }
    tokens.push(t);
  }
}

export function New(): Lexer {
  return new Lexer();
}

interface Position {
  byte: number;
  rune: number;
}

export class Lexer {
  state: StateFn | null;
  source!: Source;
  private sourceStr = "";
  tokens: Ring<Token>;
  err: FileError | null;
  start: Position;
  end: Position;
  eofFlag: boolean;
  DisableIfOperator: boolean;

  constructor() {
    this.state = null;
    this.tokens = new Ring<Token>(ringChunkSize);
    this.err = null;
    this.start = { byte: 0, rune: 0 };
    this.end = { byte: 0, rune: 0 };
    this.eofFlag = false;
    this.DisableIfOperator = false;
  }

  Reset(source: Source): void {
    this.source = source;
    this.sourceStr = source.String();
    this.tokens.Reset();
    this.start = { byte: 0, rune: 0 };
    this.end = { byte: 0, rune: 0 };
    this.eofFlag = false;
    this.err = null;
    this.state = root;
  }

  // Next returns the next token, or null on io.EOF. Throws on lex error.
  Next(): Token | null {
    while (this.state !== null && this.err === null && this.tokens.Len() === 0) {
      this.state = this.state(this);
    }
    if (this.err !== null) {
      throw this.err.Bind(this.source);
    }
    const [t, ok] = this.tokens.Dequeue();
    if (ok) {
      return t!;
    }
    return null;
  }

  commit(): void {
    this.start = { byte: this.end.byte, rune: this.end.rune };
  }

  // next reads the next rune (code point). Uses UTF-16 code unit length to
  // advance the byte index in a way consistent with backup().
  next(): number {
    if (this.end.byte >= this.sourceStr.length) {
      this.eofFlag = true;
      return eof;
    }
    const cp = this.sourceStr.codePointAt(this.end.byte)!;
    const ch = String.fromCodePoint(cp);
    this.end.rune++;
    this.end.byte += ch.length;
    return cp;
  }

  peek(): number {
    if (this.end.byte < this.sourceStr.length) {
      return this.sourceStr.codePointAt(this.end.byte)!;
    }
    return eof;
  }

  backup(): void {
    if (this.eofFlag) {
      this.eofFlag = false;
    } else if (this.end.rune > 0) {
      // Decode the last rune before end.byte.
      const before = this.sourceStr.slice(0, this.end.byte);
      const cp = before.codePointAt(before.length - 2);
      // Determine the length of the last code point.
      let sz = 1;
      const lastCp = [...before].pop();
      if (lastCp) sz = lastCp.length;
      this.end.byte -= sz;
      this.end.rune--;
      void cp;
    }
  }

  emit(t: Kind): void {
    this.emitValue(t, this.word());
  }

  emitValue(t: Kind, value: string): void {
    this.tokens.Enqueue(
      new Token({
        Location: new Location(this.start.rune, this.end.rune),
        Kind: t,
        Value: value,
      }),
    );
    this.commit();
  }

  emitEOF(): void {
    let from = this.end.rune - 1;
    if (from < 0) from = 0;
    let to = this.end.rune;
    if (to < 0) to = 0;
    this.tokens.Enqueue(
      new Token({
        Location: new Location(from, to),
        Kind: Kind.EOF,
      }),
    );
    this.commit();
  }

  skip(): void {
    this.commit();
  }

  word(): string {
    return this.sourceStr.slice(this.start.byte, this.end.byte);
  }

  accept(valid: string): boolean {
    const p = this.peek();
    if (p !== eof && valid.includes(String.fromCodePoint(p))) {
      this.next();
      return true;
    }
    return false;
  }

  acceptRun(valid: string): void {
    while (this.accept(valid)) {
      // loop
    }
  }

  skipSpaces(): void {
    this.acceptRun(" ");
    this.skip();
  }

  error(message: string): StateFn | null {
    if (this.err === null) {
      let end = this.end.rune;
      if (this.eofFlag) end++;
      this.err = new FileError({
        location: new Location(end - 1, end),
        message,
      });
    }
    return null;
  }

  // --- numeric/string scanning helpers used by state.ts ---

  scanDigits(ch: number, base: number, n: number): number {
    while (n > 0 && digitVal(ch) < base) {
      ch = this.next();
      n--;
    }
    if (n > 0) {
      this.error("invalid char escape");
    }
    return ch;
  }

  scanEscape(quote: number): number {
    let ch = this.next();
    switch (ch) {
      case 0x61: // a
      case 0x62: // b
      case 0x66: // f
      case 0x6e: // n
      case 0x72: // r
      case 0x74: // t
      case 0x76: // v
      case 0x5c: // backslash
        ch = this.next();
        break;
      case quote:
        ch = this.next();
        break;
      case 0x30:
      case 0x31:
      case 0x32:
      case 0x33:
      case 0x34:
      case 0x35:
      case 0x36:
      case 0x37:
        ch = this.scanDigits(ch, 8, 3);
        break;
      case 0x78: // x
        ch = this.scanDigits(this.next(), 16, 2);
        break;
      case 0x75: // u
        if (this.peek() === 0x7b) {
          this.next();
          let digits = 0;
          for (;;) {
            const p = this.peek();
            if (p === 0x7d) break;
            if (digitVal(p) >= 16) {
              this.error("invalid char escape");
              return eof;
            }
            if (digits >= 6) {
              this.error("invalid char escape");
              return eof;
            }
            this.next();
            digits++;
          }
          if (this.peek() !== 0x7d || digits === 0) {
            this.error("invalid char escape");
            return eof;
          }
          this.next();
          ch = this.next();
          break;
        }
        ch = this.scanDigits(this.next(), 16, 4);
        break;
      case 0x55: // U
        ch = this.scanDigits(this.next(), 16, 8);
        break;
      default:
        this.error("invalid char escape");
    }
    return ch;
  }

  scanString(quote: number): number {
    let ch = this.next();
    let n = 0;
    while (ch !== quote) {
      if (ch === 0x0a || ch === eof) {
        this.error("literal not terminated");
        return n;
      }
      if (ch === 0x5c) {
        ch = this.scanEscape(quote);
      } else {
        ch = this.next();
      }
      n++;
    }
    return n;
  }

  scanRawString(quote: number): number {
    let escapedQuotes = 0;
    let n = 0;
    loop: for (;;) {
      let ch = this.next();
      while (ch === quote && this.peek() === quote) {
        this.next();
        ch = this.next();
        escapedQuotes++;
      }
      switch (ch) {
        case quote:
          break loop;
        case eof:
          this.error("literal not terminated");
          return n;
      }
      n++;
    }
    const str = this.sourceStr.slice(this.start.byte + 1, this.end.byte - 1);
    if (escapedQuotes === 0) {
      this.emitValue(Kind.String, str);
      return n;
    }
    let b = "";
    let skipped = false;
    const quoteChar = String.fromCodePoint(quote);
    for (const r of str) {
      if (r === quoteChar) {
        if (!skipped) {
          skipped = true;
          continue;
        }
        skipped = false;
      }
      b += r;
    }
    this.emitValue(Kind.String, b);
    return n;
  }
}

export function digitVal(ch: number): number {
  if (0x30 <= ch && ch <= 0x39) {
    return ch - 0x30;
  }
  const l = lower(ch);
  if (0x61 <= l && l <= 0x66) {
    return l - 0x61 + 10;
  }
  return 16;
}

function lower(ch: number): number {
  return (0x61 - 0x41) | ch;
}
