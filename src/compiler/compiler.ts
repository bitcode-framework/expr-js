// Port of expr-lang/expr compiler/compiler.go
//
// Faithful port of the Go compiler. Walks the checked AST and emits bytecode
// (Opcode[] + Arguments number[] + Constants any[] + functions + locations +
// debugInfo) into a vm.Program via NewProgram.
//
// DIVERGENCES (documented inline and mirrored from the VM/checker ports):
//   - Numeric model: Go int/int64 -> JS bigint, float64 -> number. IntegerNode
//     emits OpPush with a bigint constant (matching Go's emitPush(node.Value)).
//   - reflect.Type is replaced by the Type descriptor (checker/nature/type.ts).
//     node.Type() never returns null in TS (returns anyType); we consult
//     node.Nature().Type === null to reproduce Go's `t == nil` checks.
//   - checker.TypedFuncIndex always returns [0,false] and checker.IsFastFunc
//     always returns false (the TS VM has no typed/fast dispatch tables). The
//     branches are ported faithfully but are effectively dead code.
//   - regexp.Compile -> new RegExp. matches-with-constant stores a RegExp in
//     constants and emits OpMatchesConst.
//   - Profiling Span.Name uses the JS constructor name (no "*ast." prefix).
//   - reflect.TypeOf(constant).Kind() dedup logic is reproduced structurally:
//     primitives (bigint/number/string/boolean) and Field/Method dedup; arrays,
//     objects, RegExp, functions, Error, Span, Uint8Array do not.

import {
  Node,
  NilNode,
  IdentifierNode,
  IntegerNode,
  FloatNode,
  BoolNode,
  StringNode,
  BytesNode,
  ConstantNode,
  UnaryNode,
  BinaryNode,
  ChainNode,
  MemberNode,
  SliceNode,
  CallNode,
  BuiltinNode,
  PredicateNode,
  PointerNode,
  VariableDeclaratorNode,
  SequenceNode,
  ConditionalNode,
  ArrayNode,
  MapNode,
  PairNode,
} from "../ast/node.js";
import { Builtins, Index as BuiltinIndex } from "../builtin/builtin.js";
import { Func } from "../builtin/function.js";
import * as checker from "../checker/info.js";
import { Cache, Nature } from "../checker/nature/nature.js";
import { Type } from "../checker/nature/type.js";
import { Kind } from "../checker/nature/kind.js";
import { Config } from "../conf/config.js";
import { Location } from "../file/location.js";
import { Tree } from "../parser/parser.js";
import { Opcode } from "../vm/opcodes.js";
import { Program, NewProgram, VMFunction } from "../vm/program.js";
import { Span } from "../vm/utils.js";
import { Field, Method } from "../vm/runtime/runtime.js";

const placeholder = 12345;

// Integer bounds for IntegerNode overflow checks (mirrors Go math.Max/Min*).
const MaxInt8 = 127n;
const MinInt8 = -128n;
const MaxInt16 = 32767n;
const MinInt16 = -32768n;
const MaxInt32 = 2147483647n;
const MinInt32 = -2147483648n;
const MaxUint8 = 255n;
const MaxUint16 = 65535n;

// scope mirrors Go's compiler scope struct.
interface scope {
  variableName: string;
  index: number;
}

// kind mirrors Go's kind(t reflect.Type) reflect.Kind helper, but consults the
// node Nature to reproduce the `t == nil -> reflect.Invalid` behavior (Type()
// never returns null in the TS port).
function kindOf(node: Node): Kind {
  const nat = node.Nature();
  if (nat.Type === null) {
    return Kind.Invalid;
  }
  return nat.Type.Kind();
}

// isSimpleType mirrors Go's isSimpleType (t.PkgPath() == ""). The TS Type has
// no PkgPath; builtin types have no "." in their name (e.g. "int", "string"),
// while package types do (e.g. "time.Time"). Documented divergence.
function isSimpleType(node: Node | null): boolean {
  if (node === null) {
    return false;
  }
  const nat = node.Nature();
  if (nat.Type === null) {
    return false;
  }
  return !nat.Type.name.includes(".");
}

export function Compile(tree: Tree, config: Config | null): Program {
  const c = new compiler(config);

  c.compile(tree.Node);

  if (c.config !== null) {
    switch (c.config.Expect) {
      case Kind.Int:
        c.emit(Opcode.OpCast, 0);
        break;
      case Kind.Int64:
        c.emit(Opcode.OpCast, 1);
        break;
      case Kind.Float64:
        c.emit(Opcode.OpCast, 2);
        break;
      case Kind.Bool:
        c.emit(Opcode.OpCast, 3);
        break;
    }
    if (c.config.Optimize) {
      c.optimize();
    }
  }

  let span: Span | null = null;
  if (c.spans.length > 0) {
    span = c.spans[0]!;
  }

  return NewProgram(
    tree.Source,
    tree.Node,
    c.locations,
    c.variables,
    c.constants,
    c.bytecode,
    c.arguments,
    c.functions,
    c.debugInfo,
    span,
  );
}

class compiler {
  config: Config | null;
  ntCache: Cache;
  locations: Location[] = [];
  bytecode: Opcode[] = [];
  variables = 0;
  scopes: scope[] = [];
  constants: any[] = [];
  constantsIndex: Map<string, number> = new Map();
  functions: VMFunction[] = [];
  functionsIndex: Map<string, number> = new Map();
  debugInfo: Map<string, string> = new Map();
  nodes: Node[] = [];
  spans: Span[] = [];
  chains: number[][] = [];
  arguments: number[] = [];

  constructor(config: Config | null) {
    this.config = config;
    this.ntCache = config !== null ? config.NtCache : new Cache();
  }

  nodeParent(): Node | null {
    if (this.nodes.length > 1) {
      return this.nodes[this.nodes.length - 2]!;
    }
    return null;
  }

  emitLocation(loc: Location, op: Opcode, arg: number): number {
    this.bytecode.push(op);
    const current = this.bytecode.length;
    this.arguments.push(arg);
    this.locations.push(loc);
    return current;
  }

  emit(op: Opcode, arg = 0): number {
    let loc = new Location();
    if (this.nodes.length > 0) {
      loc = this.nodes[this.nodes.length - 1]!.Location();
    }
    return this.emitLocation(loc, op, arg);
  }

  emitPush(value: any): number {
    return this.emit(Opcode.OpPush, this.addConstant(value));
  }

  addConstant(constant: any): number {
    let indexable = true;
    let hash = "";
    const t = typeof constant;
    if (t === "bigint" || t === "number" || t === "string" || t === "boolean") {
      hash = `${t}:${String(constant)}`;
    } else if (constant instanceof Field) {
      // Mirror Go: *runtime.Field is indexable, hashed by its string repr.
      hash = `field:${constant.Path.join(".")}:${constant.Index.join(",")}`;
    } else if (constant instanceof Method) {
      hash = `method:${constant.Name}:${constant.Index}`;
    } else {
      // Slice/Map/Struct/Func equivalents (arrays, objects, RegExp, functions,
      // Error, Span, Uint8Array, null) are not deduplicated.
      indexable = false;
    }
    if (indexable) {
      const p = this.constantsIndex.get(hash);
      if (p !== undefined) {
        return p;
      }
    }
    this.constants.push(constant);
    const p = this.constants.length - 1;
    if (indexable) {
      this.constantsIndex.set(hash, p);
    }
    return p;
  }

  addVariable(name: string): number {
    this.variables++;
    this.debugInfo.set(`var_${this.variables - 1}`, name);
    return this.variables - 1;
  }

  // emitFunction adds builtin.Function.Func to program.functions and emits a
  // call opcode.
  emitFunction(fn: Func, argsLen: number): void {
    switch (argsLen) {
      case 0:
        this.emit(Opcode.OpCall0, this.addFunction(fn.Name, fn.Func!));
        break;
      case 1:
        this.emit(Opcode.OpCall1, this.addFunction(fn.Name, fn.Func!));
        break;
      case 2:
        this.emit(Opcode.OpCall2, this.addFunction(fn.Name, fn.Func!));
        break;
      case 3:
        this.emit(Opcode.OpCall3, this.addFunction(fn.Name, fn.Func!));
        break;
      default:
        this.emit(Opcode.OpLoadFunc, this.addFunction(fn.Name, fn.Func!));
        this.emit(Opcode.OpCallN, argsLen);
    }
  }

  // addFunction adds builtin.Function.Func to program.functions and returns its
  // index.
  addFunction(name: string, fn: VMFunction): number {
    if (fn === null || fn === undefined) {
      throw new Error("function is nil");
    }
    const existing = this.functionsIndex.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const p = this.functions.length;
    this.functions.push(fn);
    this.functionsIndex.set(name, p);
    this.debugInfo.set(`func_${p}`, name);
    return p;
  }

  patchJump(placeholderPos: number): void {
    const offset = this.bytecode.length - placeholderPos;
    this.arguments[placeholderPos - 1] = offset;
  }

  calcBackwardJump(to: number): number {
    return this.bytecode.length + 1 - to;
  }

  compile(node: Node): void {
    this.nodes.push(node);
    try {
      if (this.config !== null && this.config.Profile) {
        const span = new Span(node.constructor.name, node.String());
        if (this.spans.length > 0) {
          const prev = this.spans[this.spans.length - 1]!;
          prev.Children.push(span);
        }
        this.spans.push(span);
        this.emit(Opcode.OpProfileStart, this.addConstant(span));
        try {
          this.dispatch(node);
        } finally {
          this.emit(Opcode.OpProfileEnd, this.addConstant(span));
          if (this.spans.length > 1) {
            this.spans.pop();
          }
        }
        return;
      }
      this.dispatch(node);
    } finally {
      this.nodes.pop();
    }
  }

  private dispatch(node: Node): void {
    if (node instanceof NilNode) this.NilNode(node);
    else if (node instanceof IdentifierNode) this.IdentifierNode(node);
    else if (node instanceof IntegerNode) this.IntegerNode(node);
    else if (node instanceof FloatNode) this.FloatNode(node);
    else if (node instanceof BoolNode) this.BoolNode(node);
    else if (node instanceof StringNode) this.StringNode(node);
    else if (node instanceof BytesNode) this.BytesNode(node);
    else if (node instanceof ConstantNode) this.ConstantNode(node);
    else if (node instanceof UnaryNode) this.UnaryNode(node);
    else if (node instanceof BinaryNode) this.BinaryNode(node);
    else if (node instanceof ChainNode) this.ChainNode(node);
    else if (node instanceof MemberNode) this.MemberNode(node);
    else if (node instanceof SliceNode) this.SliceNode(node);
    else if (node instanceof CallNode) this.CallNode(node);
    else if (node instanceof BuiltinNode) this.BuiltinNode(node);
    else if (node instanceof PredicateNode) this.PredicateNode(node);
    else if (node instanceof PointerNode) this.PointerNode(node);
    else if (node instanceof VariableDeclaratorNode)
      this.VariableDeclaratorNode(node);
    else if (node instanceof SequenceNode) this.SequenceNode(node);
    else if (node instanceof ConditionalNode) this.ConditionalNode(node);
    else if (node instanceof ArrayNode) this.ArrayNode(node);
    else if (node instanceof MapNode) this.MapNode(node);
    else if (node instanceof PairNode) this.PairNode(node);
    else throw new Error(`undefined node type (${node.constructor.name})`);
  }

  NilNode(_node: NilNode): void {
    this.emit(Opcode.OpNil);
  }

  IdentifierNode(node: IdentifierNode): void {
    const [index, ok] = this.lookupVariable(node.Value);
    if (ok) {
      this.emit(Opcode.OpLoadVar, index);
      return;
    }
    if (node.Value === "$env") {
      this.emit(Opcode.OpLoadEnv);
      return;
    }

    let env = new Nature();
    if (this.config !== null) {
      env = this.config.Env;
    }

    if (env.IsFastMap()) {
      this.emit(Opcode.OpLoadFast, this.addConstant(node.Value));
      return;
    }
    {
      const [fok, findex, fname] = checker.FieldIndex(this.ntCache, env, node);
      if (fok) {
        this.emit(
          Opcode.OpLoadField,
          this.addConstant(new Field(findex ?? [], [fname])),
        );
        return;
      }
    }
    {
      const [mok, mindex, mname] = checker.MethodIndex(this.ntCache, env, node);
      if (mok) {
        this.emit(
          Opcode.OpLoadMethod,
          this.addConstant(new Method(mindex, mname)),
        );
        return;
      }
    }
    this.emit(Opcode.OpLoadConst, this.addConstant(node.Value));
  }

  IntegerNode(node: IntegerNode): void {
    const nat = node.Nature();
    if (nat.Type === null) {
      // Go: t == nil -> push raw value.
      this.emitPush(node.Value);
      return;
    }
    const v = node.Value;
    switch (node.Type().Kind()) {
      case Kind.Float32:
        this.emitPush(Number(v));
        break;
      case Kind.Float64:
        this.emitPush(Number(v));
        break;
      case Kind.Int:
        this.emitPush(v);
        break;
      case Kind.Int8:
        if (v > MaxInt8 || v < MinInt8) {
          throw new Error(`constant ${v} overflows int8`);
        }
        this.emitPush(v);
        break;
      case Kind.Int16:
        if (v > MaxInt16 || v < MinInt16) {
          throw new Error(`constant ${v} overflows int16`);
        }
        this.emitPush(v);
        break;
      case Kind.Int32:
        if (v > MaxInt32 || v < MinInt32) {
          throw new Error(`constant ${v} overflows int32`);
        }
        this.emitPush(v);
        break;
      case Kind.Int64:
        this.emitPush(v);
        break;
      case Kind.Uint:
        if (v < 0n) {
          throw new Error(`constant ${v} overflows uint`);
        }
        this.emitPush(v);
        break;
      case Kind.Uint8:
        if (v > MaxUint8 || v < 0n) {
          throw new Error(`constant ${v} overflows uint8`);
        }
        this.emitPush(v);
        break;
      case Kind.Uint16:
        if (v > MaxUint16 || v < 0n) {
          throw new Error(`constant ${v} overflows uint16`);
        }
        this.emitPush(v);
        break;
      case Kind.Uint32:
        if (v < 0n) {
          throw new Error(`constant ${v} overflows uint32`);
        }
        this.emitPush(v);
        break;
      case Kind.Uint64:
        if (v < 0n) {
          throw new Error(`constant ${v} overflows uint64`);
        }
        this.emitPush(v);
        break;
      default:
        this.emitPush(v);
    }
  }

  FloatNode(node: FloatNode): void {
    switch (node.Type().Kind()) {
      case Kind.Float32:
        this.emitPush(node.Value);
        break;
      case Kind.Float64:
        this.emitPush(node.Value);
        break;
      default:
        this.emitPush(node.Value);
    }
  }

  BoolNode(node: BoolNode): void {
    if (node.Value) {
      this.emit(Opcode.OpTrue);
    } else {
      this.emit(Opcode.OpFalse);
    }
  }

  StringNode(node: StringNode): void {
    this.emitPush(node.Value);
  }

  BytesNode(node: BytesNode): void {
    this.emitPush(node.Value);
  }

  ConstantNode(node: ConstantNode): void {
    if (node.Value === null || node.Value === undefined) {
      this.emit(Opcode.OpNil);
      return;
    }
    this.emitPush(node.Value);
  }

  UnaryNode(node: UnaryNode): void {
    this.compile(node.Node);
    this.derefInNeeded(node.Node);

    switch (node.Operator) {
      case "!":
      case "not":
        this.emit(Opcode.OpNot);
        break;
      case "+":
        // Do nothing.
        break;
      case "-":
        this.emit(Opcode.OpNegate);
        break;
      default:
        throw new Error(`unknown operator (${node.Operator})`);
    }
  }

  BinaryNode(node: BinaryNode): void {
    switch (node.Operator) {
      case "==":
        this.equalBinaryNode(node);
        break;

      case "!=":
        this.equalBinaryNode(node);
        this.emit(Opcode.OpNot);
        break;

      case "or":
      case "||":
        if (this.config !== null && !this.config.ShortCircuit) {
          this.compile(node.Left);
          this.derefInNeeded(node.Left);
          this.compile(node.Right);
          this.derefInNeeded(node.Right);
          this.emit(Opcode.OpOr);
          break;
        }
        {
          this.compile(node.Left);
          this.derefInNeeded(node.Left);
          const end = this.emit(Opcode.OpJumpIfTrue, placeholder);
          this.emit(Opcode.OpPop);
          this.compile(node.Right);
          this.derefInNeeded(node.Right);
          this.patchJump(end);
        }
        break;

      case "and":
      case "&&":
        if (this.config !== null && !this.config.ShortCircuit) {
          this.compile(node.Left);
          this.derefInNeeded(node.Left);
          this.compile(node.Right);
          this.derefInNeeded(node.Right);
          this.emit(Opcode.OpAnd);
          break;
        }
        {
          this.compile(node.Left);
          this.derefInNeeded(node.Left);
          const end = this.emit(Opcode.OpJumpIfFalse, placeholder);
          this.emit(Opcode.OpPop);
          this.compile(node.Right);
          this.derefInNeeded(node.Right);
          this.patchJump(end);
        }
        break;

      case "<":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpLess);
        break;

      case ">":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpMore);
        break;

      case "<=":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpLessOrEqual);
        break;

      case ">=":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpMoreOrEqual);
        break;

      case "+":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpAdd);
        break;

      case "-":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpSubtract);
        break;

      case "*":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpMultiply);
        break;

      case "/":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpDivide);
        break;

      case "%":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpModulo);
        break;

      case "**":
      case "^":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpExponent);
        break;

      case "in":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpIn);
        break;

      case "matches":
        if (node.Right instanceof StringNode) {
          // DIVERGENCE: Go uses regexp.Compile; TS uses new RegExp. A bad
          // pattern throws, mirroring Go's panic(err).
          const re = new RegExp(node.Right.Value);
          this.compile(node.Left);
          this.derefInNeeded(node.Left);
          this.emit(Opcode.OpMatchesConst, this.addConstant(re));
        } else {
          this.compile(node.Left);
          this.derefInNeeded(node.Left);
          this.compile(node.Right);
          this.derefInNeeded(node.Right);
          this.emit(Opcode.OpMatches);
        }
        break;

      case "contains":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpContains);
        break;

      case "startsWith":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpStartsWith);
        break;

      case "endsWith":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpEndsWith);
        break;

      case "..":
        this.compile(node.Left);
        this.derefInNeeded(node.Left);
        this.compile(node.Right);
        this.derefInNeeded(node.Right);
        this.emit(Opcode.OpRange);
        break;

      case "??":
        {
          this.compile(node.Left);
          this.derefInNeeded(node.Left);
          const end = this.emit(Opcode.OpJumpIfNotNil, placeholder);
          this.emit(Opcode.OpPop);
          this.compile(node.Right);
          this.derefInNeeded(node.Right);
          this.patchJump(end);
        }
        break;

      default:
        throw new Error(`unknown operator (${node.Operator})`);
    }
  }

  equalBinaryNode(node: BinaryNode): void {
    const l = kindOf(node.Left);
    const r = kindOf(node.Right);

    const leftIsSimple = isSimpleType(node.Left);
    const rightIsSimple = isSimpleType(node.Right);
    const leftAndRightAreSimple = leftIsSimple && rightIsSimple;

    this.compile(node.Left);
    this.derefInNeeded(node.Left);
    this.compile(node.Right);
    this.derefInNeeded(node.Right);

    if (l === r && l === Kind.Int && leftAndRightAreSimple) {
      this.emit(Opcode.OpEqualInt);
    } else if (l === r && l === Kind.String && leftAndRightAreSimple) {
      this.emit(Opcode.OpEqualString);
    } else {
      this.emit(Opcode.OpEqual);
    }
  }

  ChainNode(node: ChainNode): void {
    this.chains.push([]);
    this.compile(node.Node);
    for (const ph of this.chains[this.chains.length - 1]!) {
      this.patchJump(ph); // If chain activated jump here (got nil somewhere).
    }
    const parent = this.nodeParent();
    if (parent instanceof BinaryNode && parent.Operator === "??") {
      // If chain is used in nil coalescing operator, we can omit the nil push
      // at the end of the chain. The ?? operator will handle it.
    } else {
      // We need to put the nil on the stack, otherwise a "typed" nil will be
      // used as a result of the chain.
      const j = this.emit(Opcode.OpJumpIfNotNil, placeholder);
      this.emit(Opcode.OpPop);
      this.emit(Opcode.OpNil);
      this.patchJump(j);
    }
    this.chains.pop();
  }

  MemberNode(node: MemberNode): void {
    let env = new Nature();
    if (this.config !== null) {
      env = this.config.Env;
    }

    {
      const [mok, mindex, mname] = checker.MethodIndex(this.ntCache, env, node);
      if (mok) {
        this.compile(node.Node);
        this.emit(Opcode.OpMethod, this.addConstant(new Method(mindex, mname)));
        return;
      }
    }
    let op = Opcode.OpFetch;
    let base: Node = node.Node;
    // current is the MemberNode being folded across the field path.
    let current = node;

    const [ok, idx0, nodeName] = checker.FieldIndex(this.ntCache, env, node);
    let index: number[] = idx0 ?? [];
    let path: string[] = [nodeName];

    if (ok) {
      op = Opcode.OpFetchField;
      while (!current.Optional) {
        if (base instanceof IdentifierNode) {
          const [iok, identIndex, name] = checker.FieldIndex(
            this.ntCache,
            env,
            base,
          );
          if (iok) {
            index = [...(identIndex ?? []), ...index];
            path = [name, ...path];
            this.emitLocation(
              base.Location(),
              Opcode.OpLoadField,
              this.addConstant(new Field(index, path)),
            );
            return;
          }
        }

        if (base instanceof MemberNode) {
          const [bok, memberIndex, name] = checker.FieldIndex(
            this.ntCache,
            env,
            base,
          );
          if (bok) {
            index = [...(memberIndex ?? []), ...index];
            path = [name, ...path];
            current = base;
            base = base.Node;
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }

    this.compile(base);
    // If the field is optional, we need to jump over the fetch operation.
    // If no ChainNode (none c.chains) is used, do not compile the optional fetch.
    if (node.Optional && this.chains.length > 0) {
      const ph = this.emit(Opcode.OpJumpIfNil, placeholder);
      this.chains[this.chains.length - 1]!.push(ph);
    }

    if (op === Opcode.OpFetch) {
      this.compile(node.Property);
      let deref = true;
      // If the map key is a pointer, we should not dereference the property.
      const baseNat = node.Node.Nature();
      if (baseNat.Type !== null && baseNat.Type.Kind() === Kind.Map) {
        const keyType = baseNat.Type.Key();
        const propNat = node.Property.Nature();
        if (propNat.Type !== null && propNat.Type.AssignableTo(keyType)) {
          deref = false;
        }
      }
      if (deref) {
        this.derefInNeeded(node.Property);
      }
      this.emit(Opcode.OpFetch);
    } else {
      this.emitLocation(
        node.Location(),
        op,
        this.addConstant(new Field(index, path)),
      );
    }
  }

  SliceNode(node: SliceNode): void {
    this.compile(node.Node);
    if (node.To !== null) {
      this.compile(node.To);
      this.derefInNeeded(node.To);
    } else {
      this.emit(Opcode.OpLen);
    }
    if (node.From !== null) {
      this.compile(node.From);
      this.derefInNeeded(node.From);
    } else {
      this.emitPush(0n);
    }
    this.emit(Opcode.OpSlice);
  }

  CallNode(node: CallNode): void {
    const fnNat = node.Callee.Nature();
    const fn: Type | null = fnNat.Type;
    if (fn !== null && fn.Kind() === Kind.Func) {
      let fnInOffset = 0;
      let fnNumIn = fn.NumIn();
      if (node.Callee instanceof MemberNode) {
        const callee = node.Callee;
        if (callee.Property instanceof StringNode) {
          const prop = callee.Property;
          const calleeNat = callee.Node.Nature();
          if (
            calleeNat.Type !== null &&
            calleeNat.Type.methods.has(prop.Value) &&
            calleeNat.Type.Kind() !== Kind.Interface
          ) {
            fnInOffset = 1;
            fnNumIn--;
          }
        }
      } else if (node.Callee instanceof IdentifierNode) {
        const callee = node.Callee;
        if (this.config !== null) {
          const [t, ok] = this.config.Env.MethodByName(this.ntCache, callee.Value);
          if (ok && t.Method) {
            fnInOffset = 1;
            fnNumIn--;
          }
        }
      }
      for (let i = 0; i < node.Arguments.length; i++) {
        const arg = node.Arguments[i]!;
        this.compile(arg);

        let inType: Type;
        if (fn.IsVariadic() && i >= fnNumIn - 1) {
          inType = fn.In(fn.NumIn() - 1).Elem();
        } else {
          inType = fn.In(i + fnInOffset);
        }

        this.derefParam(inType, arg);
      }
    } else {
      for (const arg of node.Arguments) {
        this.compile(arg);
      }
    }

    if (node.Callee instanceof IdentifierNode) {
      const ident = node.Callee;
      if (this.config !== null) {
        const f = this.config.Functions.get(ident.Value);
        if (f !== undefined) {
          this.emitFunction(f, node.Arguments.length);
          return;
        }
      }
    }
    this.compile(node.Callee);

    if (this.config !== null) {
      const [isMethod] = checker.MethodIndex(
        this.ntCache,
        this.config.Env,
        node.Callee,
      );
      const calleeType = node.Callee.Nature().Type;
      const [index, ok] = checker.TypedFuncIndex(calleeType, isMethod);
      if (ok) {
        // DIVERGENCE: TypedFuncIndex always returns [0,false]; dead branch.
        this.emit(Opcode.OpCallTyped, index);
        return;
      } else if (checker.IsFastFunc(calleeType, isMethod)) {
        // DIVERGENCE: IsFastFunc always returns false; dead branch.
        this.emit(Opcode.OpCallFast, node.Arguments.length);
      } else {
        this.emit(Opcode.OpCall, node.Arguments.length);
      }
    } else {
      this.emit(Opcode.OpCall, node.Arguments.length);
    }
  }

  BuiltinNode(node: BuiltinNode): void {
    switch (node.Name) {
      case "all": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        let loopBreak = 0;
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          loopBreak = this.emit(Opcode.OpJumpIfFalse, placeholder);
          this.emit(Opcode.OpPop);
        });
        this.emit(Opcode.OpTrue);
        this.patchJump(loopBreak);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "none": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        let loopBreak = 0;
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          this.emit(Opcode.OpNot);
          loopBreak = this.emit(Opcode.OpJumpIfFalse, placeholder);
          this.emit(Opcode.OpPop);
        });
        this.emit(Opcode.OpTrue);
        this.patchJump(loopBreak);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "any": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        let loopBreak = 0;
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          loopBreak = this.emit(Opcode.OpJumpIfTrue, placeholder);
          this.emit(Opcode.OpPop);
        });
        this.emit(Opcode.OpFalse);
        this.patchJump(loopBreak);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "one": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          this.emitCond(() => {
            this.emit(Opcode.OpIncrementCount);
          });
        });
        this.emit(Opcode.OpGetCount);
        this.emitPush(1n);
        this.emit(Opcode.OpEqual);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "filter": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          this.emitCond(() => {
            this.emit(Opcode.OpIncrementCount);
            if (node.Map !== null) {
              this.compile(node.Map);
            } else {
              this.emit(Opcode.OpPointer);
            }
          });
        });
        this.emit(Opcode.OpGetCount);
        this.emit(Opcode.OpEnd);
        this.emit(Opcode.OpArray);
        return;
      }

      case "map": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
        });
        this.emit(Opcode.OpGetLen);
        this.emit(Opcode.OpEnd);
        this.emit(Opcode.OpArray);
        return;
      }

      case "count": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        let loopBreak = 0;
        this.emitLoop(() => {
          if (node.Arguments.length === 2) {
            this.compile(node.Arguments[1]!);
          } else {
            this.emit(Opcode.OpPointer);
          }
          this.emitCond(() => {
            this.emit(Opcode.OpIncrementCount);
            // Early termination if threshold is set.
            if (node.Threshold !== null) {
              this.emit(Opcode.OpGetCount);
              this.emit(Opcode.OpInt, node.Threshold);
              this.emit(Opcode.OpMoreOrEqual);
              loopBreak = this.emit(Opcode.OpJumpIfTrue, placeholder);
              this.emit(Opcode.OpPop);
            }
          });
        });
        this.emit(Opcode.OpGetCount);
        if (node.Threshold !== null) {
          const end = this.emit(Opcode.OpJump, placeholder);
          this.patchJump(loopBreak);
          // Early exit path: pop the bool comparison result, push count.
          this.emit(Opcode.OpPop);
          this.emit(Opcode.OpGetCount);
          this.patchJump(end);
        }
        this.emit(Opcode.OpEnd);
        return;
      }

      case "sum": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        this.emit(Opcode.OpInt, 0);
        this.emit(Opcode.OpSetAcc);
        this.emitLoop(() => {
          if (node.Arguments.length === 2) {
            this.compile(node.Arguments[1]!);
          } else {
            this.emit(Opcode.OpPointer);
          }
          this.emit(Opcode.OpGetAcc);
          this.emit(Opcode.OpAdd);
          this.emit(Opcode.OpSetAcc);
        });
        this.emit(Opcode.OpGetAcc);
        this.emit(Opcode.OpEnd);
        return;
      }
    }

    this.builtinNode2(node);
  }

  private builtinNode2(node: BuiltinNode): void {
    switch (node.Name) {
      case "find": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        let loopBreak = 0;
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          const noop = this.emit(Opcode.OpJumpIfFalse, placeholder);
          this.emit(Opcode.OpPop);
          if (node.Map !== null) {
            this.compile(node.Map);
          } else {
            this.emit(Opcode.OpPointer);
          }
          loopBreak = this.emit(Opcode.OpJump, placeholder);
          this.patchJump(noop);
          this.emit(Opcode.OpPop);
        });
        if (node.Throws) {
          this.emit(
            Opcode.OpPush,
            this.addConstant(new Error("reflect: slice index out of range")),
          );
          this.emit(Opcode.OpThrow);
        } else {
          this.emit(Opcode.OpNil);
        }
        this.patchJump(loopBreak);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "findIndex": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        let loopBreak = 0;
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          const noop = this.emit(Opcode.OpJumpIfFalse, placeholder);
          this.emit(Opcode.OpPop);
          this.emit(Opcode.OpGetIndex);
          loopBreak = this.emit(Opcode.OpJump, placeholder);
          this.patchJump(noop);
          this.emit(Opcode.OpPop);
        });
        this.emit(Opcode.OpNil);
        this.patchJump(loopBreak);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "findLast": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        let loopBreak = 0;
        this.emitLoopBackwards(() => {
          this.compile(node.Arguments[1]!);
          const noop = this.emit(Opcode.OpJumpIfFalse, placeholder);
          this.emit(Opcode.OpPop);
          if (node.Map !== null) {
            this.compile(node.Map);
          } else {
            this.emit(Opcode.OpPointer);
          }
          loopBreak = this.emit(Opcode.OpJump, placeholder);
          this.patchJump(noop);
          this.emit(Opcode.OpPop);
        });
        if (node.Throws) {
          this.emit(
            Opcode.OpPush,
            this.addConstant(new Error("reflect: slice index out of range")),
          );
          this.emit(Opcode.OpThrow);
        } else {
          this.emit(Opcode.OpNil);
        }
        this.patchJump(loopBreak);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "findLastIndex": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        let loopBreak = 0;
        this.emitLoopBackwards(() => {
          this.compile(node.Arguments[1]!);
          const noop = this.emit(Opcode.OpJumpIfFalse, placeholder);
          this.emit(Opcode.OpPop);
          this.emit(Opcode.OpGetIndex);
          loopBreak = this.emit(Opcode.OpJump, placeholder);
          this.patchJump(noop);
          this.emit(Opcode.OpPop);
        });
        this.emit(Opcode.OpNil);
        this.patchJump(loopBreak);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "groupBy": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        this.emit(Opcode.OpCreate, 1);
        this.emit(Opcode.OpSetAcc);
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          this.emit(Opcode.OpGroupBy);
        });
        this.emit(Opcode.OpGetAcc);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "sortBy": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        if (node.Arguments.length === 3) {
          this.compile(node.Arguments[2]!);
        } else {
          this.emit(Opcode.OpPush, this.addConstant("asc"));
        }
        this.emit(Opcode.OpCreate, 2);
        this.emit(Opcode.OpSetAcc);
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          this.emit(Opcode.OpSortBy);
        });
        this.emit(Opcode.OpSort);
        this.emit(Opcode.OpEnd);
        return;
      }

      case "reduce": {
        this.compile(node.Arguments[0]!);
        this.derefInNeeded(node.Arguments[0]!);
        this.emit(Opcode.OpBegin);
        if (node.Arguments.length === 3) {
          this.compile(node.Arguments[2]!);
          this.derefInNeeded(node.Arguments[2]!);
          this.emit(Opcode.OpSetAcc);
        } else {
          // When no initial value is provided, we use the first element as the
          // accumulator. But first we must check if the array is empty to avoid
          // an index out of range panic.
          const empty = this.emit(Opcode.OpJumpIfEnd, placeholder);
          this.emit(Opcode.OpPointer);
          this.emit(Opcode.OpIncrementIndex);
          this.emit(Opcode.OpSetAcc);
          const jumpPastError = this.emit(Opcode.OpJump, placeholder);
          this.patchJump(empty);
          this.emit(
            Opcode.OpPush,
            this.addConstant(
              new Error("reduce of empty array with no initial value"),
            ),
          );
          this.emit(Opcode.OpThrow);
          this.patchJump(jumpPastError);
        }
        this.emitLoop(() => {
          this.compile(node.Arguments[1]!);
          this.emit(Opcode.OpSetAcc);
        });
        this.emit(Opcode.OpGetAcc);
        this.emit(Opcode.OpEnd);
        return;
      }
    }

    const id = BuiltinIndex.get(node.Name);
    if (id !== undefined) {
      const f = Builtins[id]!;
      for (let i = 0; i < node.Arguments.length; i++) {
        const arg = node.Arguments[i]!;
        this.compile(arg);
        const argNat = arg.Nature();
        const argType = arg.Type();
        if (argType.Kind() === Kind.Ptr || argNat.IsUnknown(this.ntCache)) {
          if (f.Deref === undefined) {
            // By default, builtins expect arguments to be dereferenced.
            this.emit(Opcode.OpDeref);
          } else {
            if (f.Deref(i, argType)) {
              this.emit(Opcode.OpDeref);
            }
          }
        }
      }

      if (f.Fast !== undefined) {
        this.emit(Opcode.OpCallBuiltin1, id);
      } else if (f.Safe !== undefined) {
        const cid = this.addConstant(f.Safe);
        this.emit(Opcode.OpPush, cid);
        this.debugInfo.set(`const_${cid}`, node.Name);
        this.emit(Opcode.OpCallSafe, node.Arguments.length);
      } else if (f.Func !== undefined) {
        this.emitFunction(f, node.Arguments.length);
      }
      return;
    }

    throw new Error(`unknown builtin ${node.Name}`);
  }

  emitCond(body: () => void): void {
    const noop = this.emit(Opcode.OpJumpIfFalse, placeholder);
    this.emit(Opcode.OpPop);

    body();

    const jmp = this.emit(Opcode.OpJump, placeholder);
    this.patchJump(noop);
    this.emit(Opcode.OpPop);
    this.patchJump(jmp);
  }

  emitLoop(body: () => void): void {
    const begin = this.bytecode.length;
    const end = this.emit(Opcode.OpJumpIfEnd, placeholder);

    body();

    this.emit(Opcode.OpIncrementIndex);
    this.emit(Opcode.OpJumpBackward, this.calcBackwardJump(begin));
    this.patchJump(end);
  }

  emitLoopBackwards(body: () => void): void {
    this.emit(Opcode.OpGetLen);
    this.emit(Opcode.OpInt, 1);
    this.emit(Opcode.OpSubtract);
    this.emit(Opcode.OpSetIndex);
    const begin = this.bytecode.length;
    this.emit(Opcode.OpGetIndex);
    this.emit(Opcode.OpInt, 0);
    this.emit(Opcode.OpMoreOrEqual);
    const end = this.emit(Opcode.OpJumpIfFalse, placeholder);

    body();

    this.emit(Opcode.OpDecrementIndex);
    this.emit(Opcode.OpJumpBackward, this.calcBackwardJump(begin));
    this.patchJump(end);
  }

  PredicateNode(node: PredicateNode): void {
    this.compile(node.Node);
  }

  PointerNode(node: PointerNode): void {
    switch (node.Name) {
      case "index":
        this.emit(Opcode.OpGetIndex);
        break;
      case "acc":
        this.emit(Opcode.OpGetAcc);
        break;
      case "":
        this.emit(Opcode.OpPointer);
        break;
      default:
        throw new Error(`unknown pointer ${node.Name}`);
    }
  }

  VariableDeclaratorNode(node: VariableDeclaratorNode): void {
    this.compile(node.Value);
    const index = this.addVariable(node.Name);
    this.emit(Opcode.OpStore, index);
    this.beginScope(node.Name, index);
    this.compile(node.Expr);
    this.endScope();
  }

  SequenceNode(node: SequenceNode): void {
    for (let i = 0; i < node.Nodes.length; i++) {
      this.compile(node.Nodes[i]!);
      if (i < node.Nodes.length - 1) {
        this.emit(Opcode.OpPop);
      }
    }
  }

  beginScope(name: string, index: number): void {
    this.scopes.push({ variableName: name, index });
  }

  endScope(): void {
    this.scopes.pop();
  }

  lookupVariable(name: string): [number, boolean] {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i]!.variableName === name) {
        return [this.scopes[i]!.index, true];
      }
    }
    return [0, false];
  }

  ConditionalNode(node: ConditionalNode): void {
    this.compile(node.Cond);
    this.derefInNeeded(node.Cond);
    const otherwise = this.emit(Opcode.OpJumpIfFalse, placeholder);

    this.emit(Opcode.OpPop);
    this.compile(node.Exp1);
    const end = this.emit(Opcode.OpJump, placeholder);

    this.patchJump(otherwise);
    this.emit(Opcode.OpPop);
    this.compile(node.Exp2);

    this.patchJump(end);
  }

  ArrayNode(node: ArrayNode): void {
    for (const n of node.Nodes) {
      this.compile(n);
    }

    this.emitPush(BigInt(node.Nodes.length));
    this.emit(Opcode.OpArray);
  }

  MapNode(node: MapNode): void {
    for (const pair of node.Pairs) {
      this.compile(pair);
    }

    this.emitPush(BigInt(node.Pairs.length));
    this.emit(Opcode.OpMap);
  }

  PairNode(node: PairNode): void {
    this.compile(node.Key);
    this.compile(node.Value);
  }

  derefInNeeded(node: Node): void {
    if (node.Nature().Nil) {
      return;
    }
    switch (node.Type().Kind()) {
      case Kind.Ptr:
      case Kind.Interface:
        this.emit(Opcode.OpDeref);
        break;
    }
  }

  derefParam(inType: Type, param: Node): void {
    if (param.Nature().Nil) {
      return;
    }
    const paramType = param.Type();
    if (paramType.AssignableTo(inType)) {
      return;
    }
    if (inType.Kind() !== Kind.Ptr && paramType.Kind() === Kind.Ptr) {
      this.emit(Opcode.OpDeref);
    }
  }

  optimize(): void {
    for (let i = 0; i < this.bytecode.length; i++) {
      const op = this.bytecode[i]!;
      switch (op) {
        case Opcode.OpJumpIfTrue:
        case Opcode.OpJumpIfFalse:
        case Opcode.OpJumpIfNil:
        case Opcode.OpJumpIfNotNil: {
          let target = i + this.arguments[i]! + 1;
          while (target < this.bytecode.length && this.bytecode[target] === op) {
            target += this.arguments[target]! + 1;
          }
          this.arguments[i] = target - i - 1;
          break;
        }
      }
    }
  }
}
