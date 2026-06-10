// Port of expr-lang/expr ast/node.go
import { Location } from "../file/location.js";
import { Nature, FromType } from "../checker/nature/nature.js";
import { Type, anyType } from "../checker/nature/type.js";

// Node represents items of abstract syntax tree.
export interface Node {
  Location(): Location;
  SetLocation(loc: Location): void;
  Nature(): Nature;
  SetNature(nature: Nature): void;
  Type(): Type;
  SetType(t: Type): void;
  String(): string;
}

// Patch replaces the node with a new one. Location is preserved; type is lost.
export function Patch(ref: { node: Node }, newNode: Node): void {
  newNode.SetLocation(ref.node.Location());
  ref.node = newNode;
}

// base is the base struct for all nodes.
export abstract class Base implements Node {
  protected loc: Location = new Location();
  protected nature: Nature = new Nature();

  Location(): Location {
    return this.loc;
  }

  SetLocation(loc: Location): void {
    this.loc = loc;
  }

  Nature(): Nature {
    return this.nature;
  }

  SetNature(nature: Nature): void {
    this.nature = nature;
  }

  Type(): Type {
    if (this.nature.Type === null) {
      return anyType;
    }
    return this.nature.Type;
  }

  SetType(t: Type): void {
    this.nature = FromType(t);
  }

  abstract String(): string;
}

export class NilNode extends Base {
  String(): string {
    return "nil";
  }
}

export class IdentifierNode extends Base {
  Value: string;
  constructor(value = "") {
    super();
    this.Value = value;
  }
  String(): string {
    return this.Value;
  }
}

// IntegerNode: Go stores `int`. We store bigint to preserve int64 semantics.
export class IntegerNode extends Base {
  Value: bigint;
  constructor(value: bigint = 0n) {
    super();
    this.Value = value;
  }
  String(): string {
    return this.Value.toString();
  }
}

export class FloatNode extends Base {
  Value: number;
  constructor(value = 0) {
    super();
    this.Value = value;
  }
  String(): string {
    return formatFloat(this.Value);
  }
}

export class BoolNode extends Base {
  Value: boolean;
  constructor(value = false) {
    super();
    this.Value = value;
  }
  String(): string {
    return this.Value ? "true" : "false";
  }
}

export class StringNode extends Base {
  Value: string;
  constructor(value = "") {
    super();
    this.Value = value;
  }
  String(): string {
    return quoteString(this.Value);
  }
}

export class BytesNode extends Base {
  Value: Uint8Array;
  constructor(value: Uint8Array = new Uint8Array()) {
    super();
    this.Value = value;
  }
  String(): string {
    return quoteString(new TextDecoderShim().decode(this.Value));
  }
}

export class ConstantNode extends Base {
  Value: any;
  constructor(value: any = null) {
    super();
    this.Value = value;
  }
  String(): string {
    return printConstant(this.Value);
  }
}

export class UnaryNode extends Base {
  Operator: string;
  Node: Node;
  constructor(operator: string, node: Node) {
    super();
    this.Operator = operator;
    this.Node = node;
  }
  String(): string {
    let op = this.Operator;
    if (op === "not") {
      op = op + " ";
    }
    if (this.Node instanceof BinaryNode) {
      return `${op}(${this.Node.String()})`;
    }
    return `${op}${this.Node.String()}`;
  }
}

export class BinaryNode extends Base {
  Operator: string;
  Left: Node;
  Right: Node;
  constructor(operator: string, left: Node, right: Node) {
    super();
    this.Operator = operator;
    this.Left = left;
    this.Right = right;
  }
  String(): string {
    return printBinary(this);
  }
}

export class ChainNode extends Base {
  Node: Node;
  constructor(node: Node) {
    super();
    this.Node = node;
  }
  String(): string {
    return this.Node.String();
  }
}

export class MemberNode extends Base {
  Node: Node;
  Property: Node;
  Optional: boolean;
  Method: boolean;
  constructor(node: Node, property: Node, optional = false, method = false) {
    super();
    this.Node = node;
    this.Property = property;
    this.Optional = optional;
    this.Method = method;
  }
  String(): string {
    return printMember(this);
  }
}

export class SliceNode extends Base {
  Node: Node;
  From: Node | null;
  To: Node | null;
  constructor(node: Node, from: Node | null = null, to: Node | null = null) {
    super();
    this.Node = node;
    this.From = from;
    this.To = to;
  }
  String(): string {
    let s = `${this.Node.String()}[`;
    if (this.From !== null) s += this.From.String();
    s += ":";
    if (this.To !== null) s += this.To.String();
    s += "]";
    return s;
  }
}

export class CallNode extends Base {
  Callee: Node;
  Arguments: Node[];
  constructor(callee: Node, args: Node[] = []) {
    super();
    this.Callee = callee;
    this.Arguments = args;
  }
  String(): string {
    const args = this.Arguments.map((a) => a.String()).join(", ");
    return `${this.Callee.String()}(${args})`;
  }
}

export class BuiltinNode extends Base {
  Name: string;
  Arguments: Node[];
  Throws: boolean;
  Map: Node | null;
  Threshold: number | null;
  constructor(name: string, args: Node[] = []) {
    super();
    this.Name = name;
    this.Arguments = args;
    this.Throws = false;
    this.Map = null;
    this.Threshold = null;
  }
  String(): string {
    const args = this.Arguments.map((a) => a.String()).join(", ");
    return `${this.Name}(${args})`;
  }
}

export class PredicateNode extends Base {
  Node: Node;
  constructor(node: Node) {
    super();
    this.Node = node;
  }
  String(): string {
    return this.Node.String();
  }
}

export class PointerNode extends Base {
  Name: string;
  constructor(name = "") {
    super();
    this.Name = name;
  }
  String(): string {
    return "#" + this.Name;
  }
}

export class ConditionalNode extends Base {
  Ternary: boolean;
  Cond: Node;
  Exp1: Node;
  Exp2: Node;
  constructor(cond: Node, exp1: Node, exp2: Node, ternary = false) {
    super();
    this.Cond = cond;
    this.Exp1 = exp1;
    this.Exp2 = exp2;
    this.Ternary = ternary;
  }
  String(): string {
    return printConditional(this);
  }
}

export class VariableDeclaratorNode extends Base {
  Name: string;
  Value: Node;
  Expr: Node;
  constructor(name: string, value: Node, expr: Node) {
    super();
    this.Name = name;
    this.Value = value;
    this.Expr = expr;
  }
  String(): string {
    return `let ${this.Name} = ${this.Value.String()}; ${this.Expr.String()}`;
  }
}

export class SequenceNode extends Base {
  Nodes: Node[];
  constructor(nodes: Node[] = []) {
    super();
    this.Nodes = nodes;
  }
  String(): string {
    return this.Nodes.map((n) => n.String()).join("; ");
  }
}

export class ArrayNode extends Base {
  Nodes: Node[];
  constructor(nodes: Node[] = []) {
    super();
    this.Nodes = nodes;
  }
  String(): string {
    return "[" + this.Nodes.map((n) => n.String()).join(", ") + "]";
  }
}

export class MapNode extends Base {
  Pairs: Node[];
  constructor(pairs: Node[] = []) {
    super();
    this.Pairs = pairs;
  }
  String(): string {
    return "{" + this.Pairs.map((p) => p.String()).join(", ") + "}";
  }
}

export class PairNode extends Base {
  Key: Node;
  Value: Node;
  constructor(key: Node, value: Node) {
    super();
    this.Key = key;
    this.Value = value;
  }
  String(): string {
    if (this.Key instanceof StringNode) {
      return `${quoteIdentifierIfNeeded(this.Key.Value)}: ${this.Value.String()}`;
    }
    return `(${this.Key.String()}): ${this.Value.String()}`;
  }
}

// --- printing helpers (forward references resolved in print.ts) ---
import {
  formatFloat,
  quoteString,
  printConstant,
  printBinary,
  printMember,
  printConditional,
  quoteIdentifierIfNeeded,
  TextDecoderShim,
} from "./print.js";
