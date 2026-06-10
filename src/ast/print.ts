// Port of expr-lang/expr ast/print.go
// String() methods live on the node classes (node.ts); this module provides
// the shared formatting helpers they delegate to, plus the precedence-aware
// wrapping logic for Binary/Unary/Conditional/Member.
import * as operator from "../parser/operator/operator.js";
import { IsValidIdentifier } from "../parser/utils/utils.js";
import type {
  Node,
  BinaryNode,
  UnaryNode,
  ConditionalNode,
  MemberNode,
} from "./node.js";

// %v float formatting (Go's default). Integers-valued floats print without
// a decimal point in Go's %v, e.g. 1.0 -> "1". Match that.
export function formatFloat(v: number): string {
  if (Number.isInteger(v) && Number.isFinite(v)) {
    return v.toString();
  }
  return String(v);
}

// %q string quoting (Go strconv.Quote semantics, common cases).
export function quoteString(s: string): string {
  let out = '"';
  for (const ch of s) {
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\r":
        out += "\\r";
        break;
      default:
        out += ch;
    }
  }
  return out + '"';
}

export function printConstant(value: any): string {
  if (value === null || value === undefined) {
    return "nil";
  }
  return JSON.stringify(value);
}

export function quoteIdentifierIfNeeded(value: string): string {
  if (IsValidIdentifier(value)) {
    return value;
  }
  return quoteString(value);
}

function isBinary(n: Node): n is BinaryNode {
  return n.constructor.name === "BinaryNode";
}
function isUnary(n: Node): n is UnaryNode {
  return n.constructor.name === "UnaryNode";
}
function isConditional(n: Node): n is ConditionalNode {
  return n.constructor.name === "ConditionalNode";
}
function isStringNode(n: Node): boolean {
  return n.constructor.name === "StringNode";
}
function isPointerNode(n: Node): boolean {
  return n.constructor.name === "PointerNode";
}

export function printBinary(n: BinaryNode): string {
  if (n.Operator === "..") {
    return `${n.Left.String()}..${n.Right.String()}`;
  }

  let lwrap = false;
  let rwrap = false;

  if (isUnary(n.Left)) {
    const l = n.Left;
    if (
      (operator.Unary[l.Operator]?.Precedence ?? 0) <
      (operator.Binary[n.Operator]?.Precedence ?? 0)
    ) {
      lwrap = true;
    }
  }
  if (isBinary(n.Left)) {
    const lb = n.Left;
    if (operator.Less(lb.Operator, n.Operator)) {
      lwrap = true;
    }
    if (
      operator.Binary[lb.Operator]?.Precedence ===
        operator.Binary[n.Operator]?.Precedence &&
      operator.Binary[n.Operator]?.Associativity === operator.Associativity.Right
    ) {
      lwrap = true;
    }
    if (lb.Operator === "??") {
      lwrap = true;
    }
    if (operator.IsBoolean(lb.Operator) && n.Operator !== lb.Operator) {
      lwrap = true;
    }
  }
  if (isBinary(n.Right)) {
    const rb = n.Right;
    if (operator.Less(rb.Operator, n.Operator)) {
      rwrap = true;
    }
    if (
      operator.Binary[rb.Operator]?.Precedence ===
        operator.Binary[n.Operator]?.Precedence &&
      operator.Binary[n.Operator]?.Associativity === operator.Associativity.Left
    ) {
      rwrap = true;
    }
    if (operator.IsBoolean(rb.Operator) && n.Operator !== rb.Operator) {
      rwrap = true;
    }
  }

  if (isConditional(n.Left)) {
    lwrap = true;
  }
  if (isConditional(n.Right)) {
    rwrap = true;
  }

  const lhs = lwrap ? `(${n.Left.String()})` : n.Left.String();
  const rhs = rwrap ? `(${n.Right.String()})` : n.Right.String();
  return `${lhs} ${n.Operator} ${rhs}`;
}

export function printMember(n: MemberNode): string {
  let node = n.Node.String();
  if (isBinary(n.Node)) {
    node = `(${node})`;
  }

  if (n.Optional) {
    if (isStringNode(n.Property) && IsValidIdentifier((n.Property as any).Value)) {
      return `${node}?.${(n.Property as any).Value}`;
    }
    return `${node}?.[${n.Property.String()}]`;
  }
  if (isStringNode(n.Property) && IsValidIdentifier((n.Property as any).Value)) {
    if (isPointerNode(n.Node)) {
      return `.${(n.Property as any).Value}`;
    }
    return `${node}.${(n.Property as any).Value}`;
  }
  return `${node}[${n.Property.String()}]`;
}

export function printConditional(n: ConditionalNode): string {
  if (!n.Ternary) {
    const cond = n.Cond.String();
    const exp1 = n.Exp1.String();
    if (isConditional(n.Exp2) && !n.Exp2.Ternary) {
      return `if ${cond} { ${exp1} } else ${n.Exp2.String()}`;
    }
    const exp2 = n.Exp2.String();
    return `if ${cond} { ${exp1} } else { ${exp2} }`;
  }

  const cond = isConditional(n.Cond) ? `(${n.Cond.String()})` : n.Cond.String();
  const exp1 = isConditional(n.Exp1) ? `(${n.Exp1.String()})` : n.Exp1.String();
  const exp2 = isConditional(n.Exp2) ? `(${n.Exp2.String()})` : n.Exp2.String();
  return `${cond} ? ${exp1} : ${exp2}`;
}

// Minimal UTF-8 decoder shim for BytesNode.String().
export class TextDecoderShim {
  decode(bytes: Uint8Array): string {
    let s = "";
    for (let i = 0; i < bytes.length; i++) {
      s += String.fromCharCode(bytes[i]!);
    }
    return s;
  }
}
