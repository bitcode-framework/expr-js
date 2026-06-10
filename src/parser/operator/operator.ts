// Port of expr-lang/expr parser/operator/operator.go

export enum Associativity {
  Left = 1,
  Right,
}

export interface Operator {
  Precedence: number;
  Associativity: Associativity;
}

export function Less(a: string, b: string): boolean {
  return (Binary[a]?.Precedence ?? 0) < (Binary[b]?.Precedence ?? 0);
}

export function IsBoolean(op: string): boolean {
  return op === "and" || op === "or" || op === "&&" || op === "||";
}

export function AllowedNegateSuffix(op: string): boolean {
  switch (op) {
    case "contains":
    case "matches":
    case "startsWith":
    case "endsWith":
    case "in":
      return true;
    default:
      return false;
  }
}

export const Unary: Record<string, Operator> = {
  not: { Precedence: 50, Associativity: Associativity.Left },
  "!": { Precedence: 50, Associativity: Associativity.Left },
  "-": { Precedence: 90, Associativity: Associativity.Left },
  "+": { Precedence: 90, Associativity: Associativity.Left },
};

export const Binary: Record<string, Operator> = {
  "|": { Precedence: 0, Associativity: Associativity.Left },
  or: { Precedence: 10, Associativity: Associativity.Left },
  "||": { Precedence: 10, Associativity: Associativity.Left },
  and: { Precedence: 15, Associativity: Associativity.Left },
  "&&": { Precedence: 15, Associativity: Associativity.Left },
  "==": { Precedence: 20, Associativity: Associativity.Left },
  "!=": { Precedence: 20, Associativity: Associativity.Left },
  "<": { Precedence: 20, Associativity: Associativity.Left },
  ">": { Precedence: 20, Associativity: Associativity.Left },
  ">=": { Precedence: 20, Associativity: Associativity.Left },
  "<=": { Precedence: 20, Associativity: Associativity.Left },
  in: { Precedence: 20, Associativity: Associativity.Left },
  matches: { Precedence: 20, Associativity: Associativity.Left },
  contains: { Precedence: 20, Associativity: Associativity.Left },
  startsWith: { Precedence: 20, Associativity: Associativity.Left },
  endsWith: { Precedence: 20, Associativity: Associativity.Left },
  "..": { Precedence: 25, Associativity: Associativity.Left },
  "+": { Precedence: 30, Associativity: Associativity.Left },
  "-": { Precedence: 30, Associativity: Associativity.Left },
  "*": { Precedence: 60, Associativity: Associativity.Left },
  "/": { Precedence: 60, Associativity: Associativity.Left },
  "%": { Precedence: 60, Associativity: Associativity.Left },
  "**": { Precedence: 100, Associativity: Associativity.Right },
  "^": { Precedence: 100, Associativity: Associativity.Right },
  "??": { Precedence: 500, Associativity: Associativity.Left },
};

export function IsComparison(op: string): boolean {
  return op === "<" || op === ">" || op === ">=" || op === "<=";
}
