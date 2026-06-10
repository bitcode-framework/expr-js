// Port of expr-lang/expr file/location.go
// Source parity: package file

export class Location {
  From: number;
  To: number;

  constructor(from = 0, to = 0) {
    this.From = from;
    this.To = to;
  }
}
