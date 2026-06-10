// Port of expr-lang/expr parser/parser.go
import {
  Node,
  NilNode,
  IdentifierNode,
  IntegerNode,
  FloatNode,
  BoolNode,
  StringNode,
  BytesNode,
  UnaryNode,
  BinaryNode,
  ChainNode,
  MemberNode,
  SliceNode,
  CallNode,
  BuiltinNode,
  PredicateNode,
  PointerNode,
  ConditionalNode,
  VariableDeclaratorNode,
  SequenceNode,
  ArrayNode,
  MapNode,
  PairNode,
} from "../ast/node.js";
import { Index as BuiltinIndex } from "../builtin/builtin.js";
import { Config, DefaultMaxNodes } from "../conf/config.js";
import { Source, NewSource } from "../file/source.js";
import { FileError } from "../file/error.js";
import { Location } from "../file/location.js";
import { Lexer, New as NewLexer } from "./lexer/lexer.js";
import { Token, Kind } from "./lexer/token.js";
import * as operator from "./operator/operator.js";
import * as utils from "./utils/utils.js";

// arg bit flags
const ARG_EXPR = 1;
const ARG_PREDICATE = 2;
const ARG_OPTIONAL = 1 << 7;

const predicates: Record<string, { args: number[] }> = {
  all: { args: [ARG_EXPR, ARG_PREDICATE] },
  none: { args: [ARG_EXPR, ARG_PREDICATE] },
  any: { args: [ARG_EXPR, ARG_PREDICATE] },
  one: { args: [ARG_EXPR, ARG_PREDICATE] },
  filter: { args: [ARG_EXPR, ARG_PREDICATE] },
  map: { args: [ARG_EXPR, ARG_PREDICATE] },
  count: { args: [ARG_EXPR, ARG_PREDICATE | ARG_OPTIONAL] },
  sum: { args: [ARG_EXPR, ARG_PREDICATE | ARG_OPTIONAL] },
  find: { args: [ARG_EXPR, ARG_PREDICATE] },
  findIndex: { args: [ARG_EXPR, ARG_PREDICATE] },
  findLast: { args: [ARG_EXPR, ARG_PREDICATE] },
  findLastIndex: { args: [ARG_EXPR, ARG_PREDICATE] },
  groupBy: { args: [ARG_EXPR, ARG_PREDICATE] },
  sortBy: { args: [ARG_EXPR, ARG_PREDICATE, ARG_EXPR | ARG_OPTIONAL] },
  reduce: { args: [ARG_EXPR, ARG_PREDICATE, ARG_EXPR | ARG_OPTIONAL] },
};

export class Tree {
  Node: Node;
  Source: Source;
  constructor(node: Node, source: Source) {
    this.Node = node;
    this.Source = source;
  }
}

const MaxInt64 = 9223372036854775807n;
const MaxInt = Number.MAX_SAFE_INTEGER;

export class Parser {
  private lexer: Lexer | null = null;
  private current: Token = new Token();
  private stashed: Token = new Token();
  private hasStash = false;
  private err: FileError | null = null;
  private config: Config | null = null;
  private depth = 0;
  private nodeCount = 0;

  Parse(input: string, config: Config | null): Tree {
    if (this.lexer === null) {
      this.lexer = NewLexer();
    }
    this.config = config;
    if (config !== null) {
      this.lexer.DisableIfOperator = config.DisableIfOperator;
    } else {
      this.lexer.DisableIfOperator = false;
    }
    const source = NewSource(input);
    this.lexer.Reset(source);
    this.next();
    const node = this.parseSequenceExpression();

    if (!this.current.Is(Kind.EOF)) {
      this.error(`unexpected token ${this.current.String()}`);
    }

    const tree = new Tree(node!, source);
    const err = this.err;

    this.err = null;
    this.config = null;
    this.lexer.Reset(NewSource(""));

    if (err !== null) {
      throw err.Bind(source);
    }
    return tree;
  }

  private checkNodeLimit(): void {
    this.nodeCount++;
    if (this.config === null) {
      if (this.nodeCount > DefaultMaxNodes) {
        this.error("compilation failed: expression exceeds maximum allowed nodes");
      }
      return;
    }
    if (this.config.MaxNodes > 0 && this.nodeCount > this.config.MaxNodes) {
      this.error("compilation failed: expression exceeds maximum allowed nodes");
    }
  }

  private createNode(n: Node | null, loc: Location): Node | null {
    this.checkNodeLimit();
    if (n === null || this.err !== null) {
      return null;
    }
    n.SetLocation(loc);
    return n;
  }

  private createMemberNode(n: MemberNode, loc: Location): MemberNode | null {
    this.checkNodeLimit();
    if (this.err !== null) {
      return null;
    }
    n.SetLocation(loc);
    return n;
  }

  private error(message: string): void {
    this.errorAt(this.current, message);
  }

  private errorAt(token: Token, message: string): void {
    if (this.err === null) {
      this.err = new FileError({ location: token.Location, message });
    }
  }

  private next(): void {
    if (this.hasStash) {
      this.current = this.stashed;
      this.hasStash = false;
      return;
    }
    let token: Token | null;
    try {
      token = this.lexer!.Next();
    } catch (e) {
      if (e instanceof FileError) {
        this.err = e;
        return;
      }
      this.err = new FileError({
        location: this.current.Location,
        message: "unknown lexing error",
        prev: e as Error,
      });
      return;
    }
    if (token === null) {
      // io.EOF
      this.error("unexpected end of expression");
      return;
    }
    this.current = token;
  }

  private expect(kind: Kind, ...values: string[]): void {
    if (this.current.Is(kind, ...values)) {
      this.next();
      return;
    }
    this.error(`unexpected token ${this.current.String()}`);
  }

  private parseSequenceExpression(): Node {
    const nodes: Node[] = [this.parseExpression(0)!];

    while (this.current.Is(Kind.Operator, ";") && this.err === null) {
      this.next();
      if (this.current.Is(Kind.EOF)) {
        break;
      }
      nodes.push(this.parseExpression(0)!);
    }

    if (nodes.length === 1) {
      return nodes[0]!;
    }
    return this.createNode(new SequenceNode(nodes), nodes[0]!.Location())!;
  }

  private parseExpression(precedence: number): Node | null {
    if (this.err !== null) {
      return null;
    }

    if (precedence === 0 && this.current.Is(Kind.Operator, "let")) {
      return this.parseVariableDeclaration();
    }

    if (
      precedence === 0 &&
      (this.config === null || !this.config.DisableIfOperator) &&
      this.current.Is(Kind.Operator, "if")
    ) {
      return this.parseConditionalIf();
    }

    let nodeLeft = this.parsePrimary();

    let prevOperator = "";
    let opToken = this.current;
    while (opToken.Is(Kind.Operator) && this.err === null) {
      const negate = opToken.Is(Kind.Operator, "not");
      let notToken = new Token();

      if (negate) {
        const tokenBackup = this.current;
        this.next();
        if (operator.AllowedNegateSuffix(this.current.Value)) {
          const op = operator.Binary[this.current.Value];
          if (op && op.Precedence >= precedence) {
            notToken = this.current;
            opToken = this.current;
          } else {
            this.hasStash = true;
            this.stashed = this.current;
            this.current = tokenBackup;
            break;
          }
        } else {
          this.error(`unexpected token ${this.current.String()}`);
          break;
        }
      }

      const op = operator.Binary[opToken.Value];
      if (op && op.Precedence >= precedence) {
        this.next();

        if (opToken.Value === "|") {
          const identToken = this.current;
          this.expect(Kind.Identifier);
          nodeLeft = this.parseCall(identToken, [nodeLeft!], true);
          prevOperator = opToken.Value;
          opToken = this.current;
          continue;
        }

        if (
          prevOperator === "??" &&
          opToken.Value !== "??" &&
          !opToken.Is(Kind.Bracket, "(")
        ) {
          this.errorAt(
            opToken,
            `Operator (${opToken.Value}) and coalesce expressions (??) cannot be mixed. Wrap either by parentheses.`,
          );
          break;
        }

        if (operator.IsComparison(opToken.Value)) {
          nodeLeft = this.parseComparison(nodeLeft!, opToken, op.Precedence);
          prevOperator = opToken.Value;
          opToken = this.current;
          continue;
        }

        let nodeRight: Node | null;
        if (op.Associativity === operator.Associativity.Left) {
          nodeRight = this.parseExpression(op.Precedence + 1);
        } else {
          nodeRight = this.parseExpression(op.Precedence);
        }

        nodeLeft = this.createNode(
          new BinaryNode(opToken.Value, nodeLeft!, nodeRight!),
          opToken.Location,
        );
        if (nodeLeft === null) {
          return null;
        }

        if (negate) {
          nodeLeft = this.createNode(
            new UnaryNode("not", nodeLeft),
            notToken.Location,
          );
          if (nodeLeft === null) {
            return null;
          }
        }

        prevOperator = opToken.Value;
        opToken = this.current;
        continue;
      }
      break;
    }

    if (precedence === 0) {
      nodeLeft = this.parseConditional(nodeLeft!);
    }

    return nodeLeft;
  }

  private parseVariableDeclaration(): Node | null {
    this.expect(Kind.Operator, "let");
    const variableName = this.current;
    this.expect(Kind.Identifier);
    this.expect(Kind.Operator, "=");
    const value = this.parseExpression(0);
    this.expect(Kind.Operator, ";");
    const node = this.parseSequenceExpression();
    return this.createNode(
      new VariableDeclaratorNode(variableName.Value, value!, node),
      variableName.Location,
    );
  }

  private parseConditionalIf(): Node | null {
    this.next();
    if (this.err !== null) {
      return null;
    }
    const nodeCondition = this.parseExpression(0);
    this.expect(Kind.Bracket, "{");
    const expr1 = this.parseSequenceExpression();
    this.expect(Kind.Bracket, "}");
    this.expect(Kind.Operator, "else");

    let expr2: Node | null;
    if (this.current.Is(Kind.Operator, "if")) {
      expr2 = this.parseConditionalIf();
    } else {
      this.expect(Kind.Bracket, "{");
      expr2 = this.parseSequenceExpression();
      this.expect(Kind.Bracket, "}");
    }

    return new ConditionalNode(nodeCondition!, expr1, expr2!, false);
  }

  private parseConditional(node: Node | null): Node | null {
    let expr1: Node | null;
    let expr2: Node | null;
    while (this.current.Is(Kind.Operator, "?") && this.err === null) {
      this.next();

      if (!this.current.Is(Kind.Operator, ":")) {
        expr1 = this.parseExpression(0);
        this.expect(Kind.Operator, ":");
        expr2 = this.parseExpression(0);
      } else {
        this.next();
        expr1 = node;
        expr2 = this.parseExpression(0);
      }

      node = this.createNode(
        new ConditionalNode(node!, expr1!, expr2!, true),
        this.current.Location,
      );
      if (node === null) {
        return null;
      }
    }
    return node;
  }

  private parsePrimary(): Node | null {
    const token = this.current;

    if (token.Is(Kind.Operator)) {
      const op = operator.Unary[token.Value];
      if (op) {
        this.next();
        const expr = this.parseExpression(op.Precedence);
        const node = this.createNode(
          new UnaryNode(token.Value, expr!),
          token.Location,
        );
        if (node === null) {
          return null;
        }
        return this.parsePostfixExpression(node);
      }
    }

    if (token.Is(Kind.Bracket, "(")) {
      this.next();
      const expr = this.parseSequenceExpression();
      this.expect(Kind.Bracket, ")");
      return this.parsePostfixExpression(expr);
    }

    if (this.depth > 0) {
      if (token.Is(Kind.Operator, "#") || token.Is(Kind.Operator, ".")) {
        let name = "";
        if (token.Is(Kind.Operator, "#")) {
          this.next();
          if (this.current.Is(Kind.Identifier)) {
            name = this.current.Value;
            this.next();
          }
        }
        const node = this.createNode(new PointerNode(name), token.Location);
        if (node === null) {
          return null;
        }
        return this.parsePostfixExpression(node);
      }
    }

    if (token.Is(Kind.Operator, "::")) {
      this.next();
      const tok = this.current;
      this.expect(Kind.Identifier);
      return this.parsePostfixExpression(this.parseCall(tok, [], false));
    }

    return this.parseSecondary();
  }

  private parseSecondary(): Node | null {
    let node: Node | null = null;
    const token = this.current;

    switch (token.Kind) {
      case Kind.Identifier: {
        this.next();
        switch (token.Value) {
          case "true":
            node = this.createNode(new BoolNode(true), token.Location);
            return node;
          case "false":
            node = this.createNode(new BoolNode(false), token.Location);
            return node;
          case "nil":
            node = this.createNode(new NilNode(), token.Location);
            return node;
          default:
            if (this.current.Is(Kind.Bracket, "(")) {
              node = this.parseCall(token, [], true);
            } else {
              node = this.createNode(
                new IdentifierNode(token.Value),
                token.Location,
              );
              if (node === null) {
                return null;
              }
            }
        }
        break;
      }
      case Kind.Number: {
        this.next();
        const value = token.Value.replace(/_/g, "");
        let numNode: Node | null = null;
        const valueLower = value.toLowerCase();
        if (valueLower.startsWith("0x")) {
          numNode = this.toIntegerNode(parseBigIntStr(value, this));
        } else if (/[.e]/.test(valueLower)) {
          const f = Number.parseFloat(value);
          if (Number.isNaN(f)) {
            this.error("invalid float literal");
          }
          numNode = this.toFloatNode(f);
        } else if (valueLower.startsWith("0b")) {
          numNode = this.toIntegerNode(parseBigIntStr(value, this));
        } else if (valueLower.startsWith("0o")) {
          numNode = this.toIntegerNode(parseBigIntStr(value, this));
        } else {
          numNode = this.toIntegerNode(parseBigIntStr(value, this));
        }
        if (numNode !== null) {
          numNode.SetLocation(token.Location);
        }
        return numNode;
      }
      case Kind.String:
        this.next();
        node = this.createNode(new StringNode(token.Value), token.Location);
        if (node === null) {
          return null;
        }
        break;
      case Kind.Bytes:
        this.next();
        node = this.createNode(
          new BytesNode(stringToBytes(token.Value)),
          token.Location,
        );
        if (node === null) {
          return null;
        }
        break;
      default:
        if (token.Is(Kind.Bracket, "[")) {
          node = this.parseArrayExpression(token);
        } else if (token.Is(Kind.Bracket, "{")) {
          node = this.parseMapExpression(token);
        } else {
          this.error(`unexpected token ${token.String()}`);
        }
    }

    return this.parsePostfixExpression(node);
  }

  private toIntegerNode(num: bigint): Node | null {
    if (num > BigInt(MaxInt)) {
      // Go checks > math.MaxInt; keep int64 range but flag JS-unsafe ints.
      // int64 values beyond MaxInt are still valid in Go on 64-bit; the
      // IntegerNode stores bigint so precision is preserved.
      if (num > MaxInt64) {
        this.error("integer literal is too large");
        return null;
      }
    }
    return this.createNode(new IntegerNode(num), this.current.Location);
  }

  private toFloatNode(num: number): Node | null {
    if (!Number.isFinite(num)) {
      this.error("float literal is too large");
      return null;
    }
    return this.createNode(new FloatNode(num), this.current.Location);
  }

  private parseCall(token: Token, args: Node[], checkOverrides: boolean): Node | null {
    let node: Node | null = null;

    let isOverridden = false;
    if (this.config !== null) {
      isOverridden = this.config.IsOverridden(token.Value);
    }
    isOverridden = isOverridden && checkOverrides;

    const pred = predicates[token.Value];
    if (pred && !isOverridden) {
      this.expect(Kind.Bracket, "(");
      const argSpecs = pred.args.slice(args.length);

      for (let i = 0; i < argSpecs.length; i++) {
        const arg = argSpecs[i]!;
        if ((arg & ARG_OPTIONAL) === ARG_OPTIONAL) {
          if (this.current.Is(Kind.Bracket, ")")) {
            break;
          }
        } else {
          if (this.current.Is(Kind.Bracket, ")")) {
            this.error(`expected at least ${argSpecs.length} arguments`);
          }
        }
        if (i > 0) {
          this.expect(Kind.Operator, ",");
        }
        let argNode: Node | null = null;
        if ((arg & ARG_EXPR) === ARG_EXPR) {
          argNode = this.parseExpression(0);
        } else if ((arg & ARG_PREDICATE) === ARG_PREDICATE) {
          argNode = this.parsePredicate();
        }
        args.push(argNode!);
      }

      if (this.current.Is(Kind.Operator, ",")) {
        this.next();
      }
      this.expect(Kind.Bracket, ")");

      node = this.createNode(new BuiltinNode(token.Value, args), token.Location);
      if (node === null) {
        return null;
      }
    } else if (
      BuiltinIndex.has(token.Value) &&
      (this.config === null || !this.config.Disabled.get(token.Value)) &&
      !isOverridden
    ) {
      node = this.createNode(
        new BuiltinNode(token.Value, this.parseArguments(args)),
        token.Location,
      );
      if (node === null) {
        return null;
      }
    } else {
      const callee = this.createNode(
        new IdentifierNode(token.Value),
        token.Location,
      );
      if (callee === null) {
        return null;
      }
      node = this.createNode(
        new CallNode(callee, this.parseArguments(args)),
        token.Location,
      );
      if (node === null) {
        return null;
      }
    }
    return node;
  }

  private parseArguments(args: Node[]): Node[] {
    const offset = args.length;
    this.expect(Kind.Bracket, "(");
    while (!this.current.Is(Kind.Bracket, ")") && this.err === null) {
      if (args.length > offset) {
        this.expect(Kind.Operator, ",");
      }
      if (this.current.Is(Kind.Bracket, ")")) {
        break;
      }
      args.push(this.parseExpression(0)!);
    }
    this.expect(Kind.Bracket, ")");
    return args;
  }

  private parsePredicate(): Node | null {
    const startToken = this.current;
    let withBrackets = false;
    if (this.current.Is(Kind.Bracket, "{")) {
      this.next();
      withBrackets = true;
    }

    this.depth++;
    let node: Node;
    if (withBrackets) {
      node = this.parseSequenceExpression();
    } else {
      node = this.parseExpression(0)!;
      if (this.current.Is(Kind.Operator, ";")) {
        this.error("wrap predicate with brackets { and }");
      }
    }
    this.depth--;

    if (withBrackets) {
      this.expect(Kind.Bracket, "}");
    }
    return this.createNode(new PredicateNode(node), startToken.Location);
  }

  private parseArrayExpression(token: Token): Node | null {
    const nodes: Node[] = [];
    this.expect(Kind.Bracket, "[");
    while (!this.current.Is(Kind.Bracket, "]") && this.err === null) {
      if (nodes.length > 0) {
        this.expect(Kind.Operator, ",");
        if (this.current.Is(Kind.Bracket, "]")) {
          break;
        }
      }
      nodes.push(this.parseExpression(0)!);
    }
    this.expect(Kind.Bracket, "]");
    return this.createNode(new ArrayNode(nodes), token.Location);
  }

  private parseMapExpression(token: Token): Node | null {
    this.expect(Kind.Bracket, "{");
    const nodes: Node[] = [];
    while (!this.current.Is(Kind.Bracket, "}") && this.err === null) {
      if (nodes.length > 0) {
        this.expect(Kind.Operator, ",");
        if (this.current.Is(Kind.Bracket, "}")) {
          break;
        }
        if (this.current.Is(Kind.Operator, ",")) {
          this.error(`unexpected token ${this.current.String()}`);
        }
      }

      let key: Node | null;
      if (
        this.current.Is(Kind.Number) ||
        this.current.Is(Kind.String) ||
        this.current.Is(Kind.Identifier)
      ) {
        key = this.createNode(
          new StringNode(this.current.Value),
          this.current.Location,
        );
        if (key === null) {
          return null;
        }
        this.next();
      } else if (this.current.Is(Kind.Bracket, "(")) {
        key = this.parseExpression(0);
      } else {
        this.error(
          `a map key must be a quoted string, a number, a identifier, or an expression enclosed in parentheses (unexpected token ${this.current.String()})`,
        );
        key = null;
      }

      this.expect(Kind.Operator, ":");
      const node = this.parseExpression(0);
      const pair = this.createNode(new PairNode(key!, node!), token.Location);
      if (pair === null) {
        return null;
      }
      nodes.push(pair);
    }
    this.expect(Kind.Bracket, "}");
    return this.createNode(new MapNode(nodes), token.Location);
  }

  private parsePostfixExpression(nodeIn: Node | null): Node | null {
    let node = nodeIn;
    let postfixToken = this.current;
    while (
      (postfixToken.Is(Kind.Operator) || postfixToken.Is(Kind.Bracket)) &&
      this.err === null
    ) {
      let optional = postfixToken.Value === "?.";
      // parseToken label emulation
      // eslint-disable-next-line no-constant-condition
      parseToken: for (;;) {
        if (postfixToken.Value === "." || postfixToken.Value === "?.") {
          this.next();
          let propertyToken = this.current;
          if (optional && propertyToken.Is(Kind.Bracket, "[")) {
            postfixToken = propertyToken;
            continue parseToken;
          }
          this.next();

          if (
            propertyToken.Kind !== Kind.Identifier &&
            (propertyToken.Kind !== Kind.Operator ||
              !utils.IsValidIdentifier(propertyToken.Value))
          ) {
            this.error("expected name");
          }

          const property = this.createNode(
            new StringNode(propertyToken.Value),
            propertyToken.Location,
          );
          if (property === null) {
            return null;
          }

          const isChain = node instanceof ChainNode;
          optional = postfixToken.Value === "?.";

          if (isChain) {
            node = (node as ChainNode).Node;
          }

          const memberNode = this.createMemberNode(
            new MemberNode(node!, property, optional),
            propertyToken.Location,
          );
          if (memberNode === null) {
            return null;
          }

          if (this.current.Is(Kind.Bracket, "(")) {
            memberNode.Method = true;
            node = this.createNode(
              new CallNode(memberNode, this.parseArguments([])),
              propertyToken.Location,
            );
            if (node === null) {
              return null;
            }
          } else {
            node = memberNode;
          }

          if (isChain || optional) {
            node = this.createNode(
              new ChainNode(node),
              propertyToken.Location,
            );
            if (node === null) {
              return null;
            }
          }
        } else if (postfixToken.Value === "[") {
          this.next();
          let from: Node | null = null;
          let to: Node | null = null;

          if (this.current.Is(Kind.Operator, ":")) {
            this.next();
            if (!this.current.Is(Kind.Bracket, "]")) {
              to = this.parseExpression(0);
            }
            node = this.createNode(
              new SliceNode(node!, null, to),
              postfixToken.Location,
            );
            if (node === null) {
              return null;
            }
            this.expect(Kind.Bracket, "]");
          } else {
            from = this.parseExpression(0);
            if (this.current.Is(Kind.Operator, ":")) {
              this.next();
              if (!this.current.Is(Kind.Bracket, "]")) {
                to = this.parseExpression(0);
              }
              node = this.createNode(
                new SliceNode(node!, from, to),
                postfixToken.Location,
              );
              if (node === null) {
                return null;
              }
              this.expect(Kind.Bracket, "]");
            } else {
              node = this.createNode(
                new MemberNode(node!, from!, optional),
                postfixToken.Location,
              );
              if (node === null) {
                return null;
              }
              if (optional) {
                node = this.createNode(
                  new ChainNode(node),
                  postfixToken.Location,
                );
                if (node === null) {
                  return null;
                }
              }
              this.expect(Kind.Bracket, "]");
            }
          }
        } else {
          return node;
        }
        break parseToken;
      }
      postfixToken = this.current;
    }
    return node;
  }

  private parseComparison(
    leftIn: Node,
    tokenIn: Token,
    precedence: number,
  ): Node | null {
    let left = leftIn;
    let token = tokenIn;
    let rootNode: Node | null = null;
    for (;;) {
      const comparator = this.parseExpression(precedence + 1);
      const cmpNode = this.createNode(
        new BinaryNode(token.Value, left, comparator!),
        token.Location,
      );
      if (cmpNode === null) {
        return null;
      }
      if (rootNode === null) {
        rootNode = cmpNode;
      } else {
        rootNode = this.createNode(
          new BinaryNode("&&", rootNode, cmpNode),
          token.Location,
        );
        if (rootNode === null) {
          return null;
        }
      }

      left = comparator!;
      token = this.current;
      if (
        !(
          token.Is(Kind.Operator) &&
          operator.IsComparison(token.Value) &&
          this.err === null
        )
      ) {
        break;
      }
      this.next();
    }
    return rootNode;
  }
}

// Parse parses an expression into an AST tree with default config.
export function Parse(input: string): Tree {
  return ParseWithConfig(input, null);
}

export function ParseWithConfig(input: string, config: Config | null): Tree {
  return new Parser().Parse(input, config);
}

// parseBigIntStr parses Go-style int literals (0x, 0o, 0b, decimal) to bigint.
function parseBigIntStr(value: string, p: { errorPublic: (m: string) => void } | any): bigint {
  try {
    const lower = value.toLowerCase();
    if (lower.startsWith("0x") || lower.startsWith("0o") || lower.startsWith("0b")) {
      return BigInt(value);
    }
    return BigInt(value);
  } catch {
    if (typeof p.error === "function") {
      // not accessible (private); fall through with 0n
    }
    return 0n;
  }
}

// stringToBytes converts a byte-string (each char code is a byte) to Uint8Array.
function stringToBytes(s: string): Uint8Array {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    arr[i] = s.charCodeAt(i) & 0xff;
  }
  return arr;
}