// Port of expr-lang/expr parser/lexer/token.go
import { Location } from "../../file/location.js";

export enum Kind {
  Identifier = "Identifier",
  Number = "Number",
  String = "String",
  Bytes = "Bytes",
  Operator = "Operator",
  Bracket = "Bracket",
  EOF = "EOF",
}

export class Token {
  Location: Location;
  Kind: Kind;
  Value: string;

  constructor(init: { Location?: Location; Kind?: Kind; Value?: string } = {}) {
    this.Location = init.Location ?? new Location();
    this.Kind = init.Kind ?? Kind.EOF;
    this.Value = init.Value ?? "";
  }

  get From(): number {
    return this.Location.From;
  }

  get To(): number {
    return this.Location.To;
  }

  String(): string {
    if (this.Value === "") {
      return String(this.Kind);
    }
    return `${this.Kind}(${JSON.stringify(this.Value)})`;
  }

  Is(kind: Kind, ...values: string[]): boolean {
    if (kind !== this.Kind) {
      return false;
    }
    for (const v of values) {
      if (v === this.Value) {
        return true;
      }
    }
    return values.length === 0;
  }
}
