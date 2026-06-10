// Port of expr-lang/expr checker/checker.go
//
// The checker walks the AST, infers a Nature for each node (via node.SetNature),
// validates operators / builtins / calls, and reports compile-time type errors
// through file.Error (FileError here), bound to the source. Error message
// strings mirror the Go upstream as closely as feasible (parity tests compare
// error text).
//
// DIVERGENCES (documented inline and in PARITY.md):
//   - Go uses reflect.Type; the TS port uses the Type descriptor graph from
//     checker/nature/type.ts. Nature.Cache is a no-op in this port.
//   - Go's Nature.TypeData.Func is modeled as Nature.Func directly here.
//   - node.Type() never returns null in the TS Base (returns anyType); the Go
//     `typ != nil && typ != anyType` guard becomes `typ !== anyType`.
//   - `error()` takes an already-formatted message string (call sites use
//     template literals) instead of Go's fmt.Sprintf(format, args...).

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
  ConditionalNode,
  VariableDeclaratorNode,
  SequenceNode,
  ArrayNode,
  MapNode,
  PairNode,
} from "../ast/node.js";
import { Walk, Visitor, NodeRef } from "../ast/visitor.js";
import {
  Nature,
  Cache,
  NatureOf,
  FromType,
  ArrayFromType,
  NatureCheck,
} from "./nature/nature.js";
import {
  Type,
  anyType,
  intType,
  floatType,
  boolType,
  stringType,
  timeType,
  durationType,
  arrayType,
  byteSliceType,
  MapOf,
  FuncOf,
} from "./nature/type.js";
import { Kind } from "./nature/kind.js";
import { Func } from "../builtin/function.js";
import { Builtins, Index as BuiltinIndex } from "../builtin/builtin.js";
import { Config, New as NewConfig } from "../conf/config.js";
import { FileError } from "../file/error.js";
import { Tree, ParseWithConfig } from "../parser/parser.js";

// Module-level type singletons mirroring Go's package-level vars.
const mapType = MapOf(stringType, anyType);
const anyTypeSlice: Type[] = [anyType];

interface predicateScope {
  collection: Nature;
  vars: varScope[];
}

interface varScope {
  name: string;
  nature: Nature;
}

// ParseCheck parses input expression and checks its types. Also, it applies
// all provided patchers. In case of error, it throws (with the tree available
// only when parsing succeeds). Returns the checked Tree.
export function ParseCheck(input: string, config: Config | null): Tree {
  const tree = ParseWithConfig(input, config);
  new Checker().PatchAndCheck(tree, config);
  return tree;
}

// Check calls Check on a disposable Checker.
export function Check(tree: Tree, config: Config | null): Type | null {
  return new Checker().Check(tree, config);
}

export class Checker {
  private config!: Config;
  private predicateScopes: predicateScope[] = [];
  private varScopes: varScope[] = [];
  private err: FileError | null = null;
  private needsReset = false;

  // PatchAndCheck applies all patchers and checks the tree.
  PatchAndCheck(tree: Tree, config: Config | null): Type | null {
    this.reset(config);
    if (this.config.Visitors.length > 0) {
      // Run all patchers that don't support being run repeatedly first.
      this.runVisitors(tree, false);
      // Run patchers that require multiple passes next.
      this.runVisitors(tree, true);
    }
    return this.Check(tree, config);
  }

  // Check checks types of the expression tree. It returns type of the
  // expression and throws on error. If config is null, default config is used.
  Check(tree: Tree, config: Config | null): Type | null {
    this.reset(config);
    return this.check(tree);
  }

  // runVisitors runs visitors in a given config over the given tree.
  // runRepeatable controls whether to filter for only visitors that require
  // multiple passes or not.
  private runVisitors(tree: Tree, runRepeatable: boolean): void {
    for (;;) {
      let more = false;
      for (const visitor of this.config.Visitors) {
        // We need to perform type check, because some visitors may rely on
        // type information available in the tree.
        try {
          this.Check(tree, this.config);
        } catch {
          // ignore; mirrors Go ignoring the (_, _) return.
        }

        const r = visitor as unknown as {
          Reset?: () => void;
          ShouldRepeat?: () => boolean;
        };
        const repeatable =
          typeof r.Reset === "function" && typeof r.ShouldRepeat === "function";

        const ref: NodeRef = {
          get node(): Node {
            return tree.Node;
          },
          set node(n: Node) {
            tree.Node = n;
          },
        };

        if (repeatable) {
          if (runRepeatable) {
            r.Reset!();
            Walk(ref, visitor);
            more = more || r.ShouldRepeat!();
          }
        } else {
          if (!runRepeatable) {
            Walk(ref, visitor);
          }
        }
      }

      if (!more) {
        break;
      }
    }
  }

  private check(tree: Tree): Type | null {
    const nt = this.visit(tree.Node);

    // To keep compatibility with previous versions, we should return any, if
    // nature is unknown.
    let t: Type | null = nt.Type;
    if (t === null) {
      t = anyType;
    }

    if (this.err !== null) {
      throw this.err.Bind(tree.Source);
    }

    if (this.config.Expect !== Kind.Invalid) {
      if (this.config.ExpectAny) {
        if (nt.IsUnknown(this.config.NtCache)) {
          return t;
        }
      }

      switch (this.config.Expect) {
        case Kind.Int:
        case Kind.Int64:
        case Kind.Float64:
          if (!nt.IsNumber()) {
            throw new Error(
              `expected ${kindString(this.config.Expect)}, but got ${nt.String()}`,
            );
          }
          break;
        default:
          if (nt.Kind !== this.config.Expect) {
            throw new Error(
              `expected ${kindString(this.config.Expect)}, but got ${nt.String()}`,
            );
          }
      }
    }

    return t;
  }

  private reset(config: Config | null): void {
    if (this.needsReset) {
      this.predicateScopes = [];
      this.varScopes = [];
      this.err = null;
    }
    this.needsReset = true;

    if (config === null) {
      config = NewConfig(null);
    }
    this.config = config;
  }

  private visit(node: Node): Nature {
    let nt: Nature;
    if (node instanceof NilNode) {
      nt = NatureOf(null);
    } else if (node instanceof IdentifierNode) {
      nt = this.identifierNode(node);
    } else if (node instanceof IntegerNode) {
      nt = FromType(intType);
    } else if (node instanceof FloatNode) {
      nt = FromType(floatType);
    } else if (node instanceof BoolNode) {
      nt = FromType(boolType);
    } else if (node instanceof StringNode) {
      nt = FromType(stringType);
    } else if (node instanceof BytesNode) {
      nt = FromType(byteSliceType);
    } else if (node instanceof ConstantNode) {
      nt = NatureOf(node.Value);
    } else if (node instanceof UnaryNode) {
      nt = this.unaryNode(node);
    } else if (node instanceof BinaryNode) {
      nt = this.binaryNode(node);
    } else if (node instanceof ChainNode) {
      nt = this.chainNode(node);
    } else if (node instanceof MemberNode) {
      nt = this.memberNode(node);
    } else if (node instanceof SliceNode) {
      nt = this.sliceNode(node);
    } else if (node instanceof CallNode) {
      nt = this.callNode(node);
    } else if (node instanceof BuiltinNode) {
      nt = this.builtinNode(node);
    } else if (node instanceof PredicateNode) {
      nt = this.predicateNode(node);
    } else if (node instanceof PointerNode) {
      nt = this.pointerNode(node);
    } else if (node instanceof VariableDeclaratorNode) {
      nt = this.variableDeclaratorNode(node);
    } else if (node instanceof SequenceNode) {
      nt = this.sequenceNode(node);
    } else if (node instanceof ConditionalNode) {
      nt = this.conditionalNode(node);
    } else if (node instanceof ArrayNode) {
      nt = this.arrayNode(node);
    } else if (node instanceof MapNode) {
      nt = this.mapNode(node);
    } else if (node instanceof PairNode) {
      nt = this.pairNode(node);
    } else {
      throw new Error(`undefined node type (${(node as object)?.constructor?.name})`);
    }
    node.SetNature(nt);
    return nt;
  }

  // error records the first type error and returns an empty Nature.
  // DIVERGENCE: takes a pre-formatted message (Go used fmt.Sprintf varargs).
  private error(node: Node, message: string): Nature {
    if (this.err === null) {
      // show first error
      this.err = new FileError({
        location: node.Location(),
        message: message,
      });
    }
    return new Nature();
  }

  private identifierNode(node: IdentifierNode): Nature {
    for (let i = this.varScopes.length - 1; i >= 0; i--) {
      if (this.varScopes[i]!.name === node.Value) {
        return this.varScopes[i]!.nature;
      }
    }
    if (node.Value === "$env") {
      return new Nature();
    }

    return this.ident(node, node.Value, this.config.Strict, true);
  }

  // ident returns type of environment variable, builtin or function.
  private ident(node: Node, name: string, strict: boolean, builtins: boolean): Nature {
    const [nt, ok] = this.config.Env.Get(this.config.NtCache, name);
    if (ok) {
      return nt;
    }
    if (builtins) {
      const fn = this.config.Functions.get(name);
      if (fn) {
        const n = FromType(fn.Type());
        n.Func = fn;
        return n;
      }
      const bfn = this.config.Builtins.get(name);
      if (bfn) {
        const n = FromType(bfn.Type());
        n.Func = bfn;
        return n;
      }
    }
    if (this.config.Strict && strict) {
      return this.error(node, `unknown name ${name}`);
    }
    return new Nature();
  }

  private unaryNode(node: UnaryNode): Nature {
    let nt = this.visit(node.Node);
    nt = nt.Deref(this.config.NtCache);

    switch (node.Operator) {
      case "!":
      case "not":
        if (nt.IsBool()) {
          return FromType(boolType);
        }
        if (nt.IsUnknown(this.config.NtCache)) {
          return FromType(boolType);
        }
        break;

      case "+":
      case "-":
        if (nt.IsNumber()) {
          return nt;
        }
        if (nt.IsUnknown(this.config.NtCache)) {
          return new Nature();
        }
        break;

      default:
        return this.error(node, `unknown operator (${node.Operator})`);
    }

    return this.error(
      node,
      `invalid operation: ${node.Operator} (mismatched type ${nt.String()})`,
    );
  }

  private binaryNode(node: BinaryNode): Nature {
    let l = this.visit(node.Left);
    let r = this.visit(node.Right);

    l = l.Deref(this.config.NtCache);
    r = r.Deref(this.config.NtCache);

    const c = this.config.NtCache;
    switch (node.Operator) {
      case "==":
      case "!=":
        if (l.ComparableTo(c, r)) {
          return FromType(boolType);
        }
        break;

      case "or":
      case "||":
      case "and":
      case "&&":
        if (l.IsBool() && r.IsBool()) {
          return FromType(boolType);
        }
        if (l.MaybeCompatible(c, r, NatureCheck.BoolCheck)) {
          return FromType(boolType);
        }
        break;

      case "<":
      case ">":
      case ">=":
      case "<=":
        if (l.IsNumber() && r.IsNumber()) {
          return FromType(boolType);
        }
        if (l.IsString() && r.IsString()) {
          return FromType(boolType);
        }
        if (l.IsTime() && r.IsTime()) {
          return FromType(boolType);
        }
        if (l.IsDuration() && r.IsDuration()) {
          return FromType(boolType);
        }
        if (
          l.MaybeCompatible(
            c,
            r,
            NatureCheck.NumberCheck,
            NatureCheck.StringCheck,
            NatureCheck.TimeCheck,
            NatureCheck.DurationCheck,
          )
        ) {
          return FromType(boolType);
        }
        break;

      case "-":
        if (l.IsNumber() && r.IsNumber()) {
          return l.PromoteNumericNature(c, r);
        }
        if (l.IsTime() && r.IsTime()) {
          return FromType(durationType);
        }
        if (l.IsTime() && r.IsDuration()) {
          return FromType(timeType);
        }
        if (l.IsDuration() && r.IsDuration()) {
          return FromType(durationType);
        }
        if (
          l.MaybeCompatible(
            c,
            r,
            NatureCheck.NumberCheck,
            NatureCheck.TimeCheck,
            NatureCheck.DurationCheck,
          )
        ) {
          return new Nature();
        }
        break;

      case "*":
        if (l.IsNumber() && r.IsNumber()) {
          return l.PromoteNumericNature(c, r);
        }
        if (l.IsNumber() && r.IsDuration()) {
          return FromType(durationType);
        }
        if (l.IsDuration() && r.IsNumber()) {
          return FromType(durationType);
        }
        if (l.IsDuration() && r.IsDuration()) {
          return FromType(durationType);
        }
        if (
          l.MaybeCompatible(c, r, NatureCheck.NumberCheck, NatureCheck.DurationCheck)
        ) {
          return new Nature();
        }
        break;

      case "/":
        if (l.IsNumber() && r.IsNumber()) {
          return FromType(floatType);
        }
        if (l.MaybeCompatible(c, r, NatureCheck.NumberCheck)) {
          return FromType(floatType);
        }
        break;

      case "**":
      case "^":
        if (l.IsNumber() && r.IsNumber()) {
          return FromType(floatType);
        }
        if (l.MaybeCompatible(c, r, NatureCheck.NumberCheck)) {
          return FromType(floatType);
        }
        break;

      case "%":
        if (l.IsInteger && r.IsInteger) {
          return FromType(intType);
        }
        if (l.MaybeCompatible(c, r, NatureCheck.IntegerCheck)) {
          return FromType(intType);
        }
        break;

      case "+":
        if (l.IsNumber() && r.IsNumber()) {
          return l.PromoteNumericNature(c, r);
        }
        if (l.IsString() && r.IsString()) {
          return FromType(stringType);
        }
        if (l.IsTime() && r.IsDuration()) {
          return FromType(timeType);
        }
        if (l.IsDuration() && r.IsTime()) {
          return FromType(timeType);
        }
        if (l.IsDuration() && r.IsDuration()) {
          return FromType(durationType);
        }
        if (
          l.MaybeCompatible(
            c,
            r,
            NatureCheck.NumberCheck,
            NatureCheck.StringCheck,
            NatureCheck.TimeCheck,
            NatureCheck.DurationCheck,
          )
        ) {
          return new Nature();
        }
        break;

      case "in":
        if ((l.IsString() || l.IsUnknown(c)) && r.IsStruct()) {
          return FromType(boolType);
        }
        if (r.IsMap()) {
          const rKey = r.Key(c);
          if (!l.IsUnknown(c) && !l.AssignableTo(rKey)) {
            return this.error(
              node,
              `cannot use ${l.String()} as type ${rKey.String()} in map key`,
            );
          }
          return FromType(boolType);
        }
        if (r.IsArray()) {
          const rElem = r.Elem(c);
          if (!l.ComparableTo(c, rElem)) {
            return this.error(
              node,
              `cannot use ${l.String()} as type ${rElem.String()} in array`,
            );
          }
          return FromType(boolType);
        }
        if (
          l.IsUnknown(c) &&
          r.IsAnyOf(NatureCheck.StringCheck, NatureCheck.ArrayCheck, NatureCheck.MapCheck)
        ) {
          return FromType(boolType);
        }
        if (r.IsUnknown(c)) {
          return FromType(boolType);
        }
        break;

      case "matches": {
        if (node.Right instanceof StringNode) {
          try {
            // eslint-disable-next-line no-new
            new RegExp(node.Right.Value);
          } catch (e) {
            return this.error(node, (e as Error).message);
          }
        }
        if ((l.IsString() || l.IsByteSlice()) && r.IsString()) {
          return FromType(boolType);
        }
        if (l.MaybeCompatible(c, r, NatureCheck.StringCheck)) {
          return FromType(boolType);
        }
        break;
      }

      case "contains":
      case "startsWith":
      case "endsWith":
        if (l.IsString() && r.IsString()) {
          return FromType(boolType);
        }
        if (l.MaybeCompatible(c, r, NatureCheck.StringCheck)) {
          return FromType(boolType);
        }
        break;

      case "..":
        if (
          (l.IsInteger && r.IsInteger) ||
          l.MaybeCompatible(c, r, NatureCheck.IntegerCheck)
        ) {
          return ArrayFromType(intType);
        }
        break;

      case "??":
        if (l.Nil && !r.Nil) {
          return r;
        }
        if (!l.Nil && r.Nil) {
          return l;
        }
        if (l.Nil && r.Nil) {
          return NatureOf(null);
        }
        if (r.AssignableTo(l)) {
          return l;
        }
        return new Nature();

      default:
        return this.error(node, `unknown operator (${node.Operator})`);
    }

    return this.error(
      node,
      `invalid operation: ${node.Operator} (mismatched types ${l.String()} and ${r.String()})`,
    );
  }

  private chainNode(node: ChainNode): Nature {
    return this.visit(node.Node);
  }

  private memberNode(node: MemberNode): Nature {
    const c = this.config.NtCache;
    // $env variable
    if (node.Node instanceof IdentifierNode && node.Node.Value === "$env") {
      if (node.Property instanceof StringNode) {
        let strict = this.config.Strict;
        if (node.Optional) {
          // If user explicitly set optional flag, then we should not throw
          // error if field is not found (as user trying to handle this case).
          strict = false;
        }
        return this.ident(node, node.Property.Value, strict, false);
      }
      return new Nature();
    }

    let base = this.visit(node.Node);
    let prop = this.visit(node.Property);

    if (base.IsUnknown(c)) {
      return new Nature();
    }

    if (node.Property instanceof StringNode) {
      const name = node.Property;
      if (base.Nil) {
        return this.error(node, `type nil has no field ${name.Value}`);
      }

      // First, check methods defined on base type itself, independent of which
      // type it is. Without dereferencing.
      const [m, ok] = base.MethodByName(c, name.Value);
      if (ok) {
        return m;
      }
    }

    base = base.Deref(c);

    switch (base.Kind) {
      case Kind.Map: {
        // If the map key is a pointer, we should not dereference the property.
        if (!prop.AssignableTo(base.Key(c))) {
          const propDeref = prop.Deref(c);
          if (propDeref.AssignableTo(base.Key(c))) {
            prop = propDeref;
          }
        }
        if (!prop.AssignableTo(base.Key(c)) && !prop.IsUnknown(c)) {
          return this.error(
            node.Property,
            `cannot use ${prop.String()} to get an element from ${base.String()}`,
          );
        }
        if (node.Property instanceof StringNode && base.Fields !== null) {
          const field = base.Fields.get(node.Property.Value);
          if (field) {
            return field;
          } else if (base.Strict) {
            return this.error(node.Property, `unknown field ${node.Property.Value}`);
          }
        }
        return base.Elem(c);
      }

      case Kind.Array:
      case Kind.Slice:
        prop = prop.Deref(c);
        if (!prop.IsInteger && !prop.IsUnknown(c)) {
          return this.error(
            node.Property,
            `array elements can only be selected using an integer (got ${prop.String()})`,
          );
        }
        return base.Elem(c);

      case Kind.Struct:
        if (node.Property instanceof StringNode) {
          const propertyName = node.Property.Value;
          const [field, ok] = base.FieldByName(c, propertyName);
          if (ok) {
            return FromType(field.Type);
          }
          if (node.Method) {
            return this.error(
              node,
              `type ${base.String()} has no method ${propertyName}`,
            );
          }
          return this.error(
            node,
            `type ${base.String()} has no field ${propertyName}`,
          );
        }
        break;
    }

    // Not found.
    if (node.Property instanceof StringNode) {
      if (node.Method) {
        return this.error(
          node,
          `type ${base.String()} has no method ${node.Property.Value}`,
        );
      }
      return this.error(
        node,
        `type ${base.String()} has no field ${node.Property.Value}`,
      );
    }
    return this.error(node, `type ${base.String()}[${prop.String()}] is undefined`);
  }

  private sliceNode(node: SliceNode): Nature {
    const c = this.config.NtCache;
    const nt = this.visit(node.Node);

    if (nt.IsUnknown(c)) {
      return new Nature();
    }

    switch (nt.Kind) {
      case Kind.String:
      case Kind.Array:
      case Kind.Slice:
        // ok
        break;
      default:
        return this.error(node, `cannot slice ${nt.String()}`);
    }

    if (node.From !== null) {
      let from = this.visit(node.From);
      from = from.Deref(c);
      if (!from.IsInteger && !from.IsUnknown(c)) {
        return this.error(node.From, `non-integer slice index ${from.String()}`);
      }
    }

    if (node.To !== null) {
      let to = this.visit(node.To);
      to = to.Deref(c);
      if (!to.IsInteger && !to.IsUnknown(c)) {
        return this.error(node.To, `non-integer slice index ${to.String()}`);
      }
    }

    return nt;
  }

  private callNode(node: CallNode): Nature {
    const c = this.config.NtCache;
    // Check if type was set on node (for example, by patcher) and use node type
    // instead of function return type.
    //
    // DIVERGENCE: TS node.Type() returns anyType (never null), so we only guard
    // against anyType.
    const typ = node.Type();
    if (typ !== null && typ !== anyType) {
      return node.Nature();
    }

    // $env is not callable.
    if (node.Callee instanceof IdentifierNode && node.Callee.Value === "$env") {
      return this.error(node, `${this.config.Env.String()} is not callable`);
    }

    const nt = this.visit(node.Callee);
    if (nt.IsUnknown(c)) {
      return new Nature();
    }

    if (nt.Func !== null) {
      return this.checkFunction(nt.Func, node, node.Arguments);
    }

    let fnName = "function";
    if (node.Callee instanceof IdentifierNode) {
      fnName = node.Callee.Value;
    }
    if (node.Callee instanceof MemberNode) {
      if (node.Callee.Property instanceof StringNode) {
        fnName = node.Callee.Property.Value;
      }
    }

    if (nt.Nil) {
      return this.error(node, `${fnName} is nil; cannot call nil as function`);
    }

    if (nt.Kind === Kind.Func) {
      const [outType, err] = this.checkArguments(fnName, nt, node.Arguments, node);
      if (err !== null) {
        if (this.err === null) {
          this.err = err;
        }
        return new Nature();
      }
      return outType;
    }
    return this.error(node, `${nt.String()} is not callable`);
  }

  private begin(collectionNature: Nature, ...vars: varScope[]): void {
    this.predicateScopes.push({ collection: collectionNature, vars: vars });
  }

  private end(): void {
    this.predicateScopes.pop();
  }

  private checkBuiltinGet(node: BuiltinNode): Nature {
    const c = this.config.NtCache;
    if (node.Arguments.length !== 2) {
      return this.error(
        node,
        `invalid number of arguments (expected 2, got ${node.Arguments.length})`,
      );
    }

    const base = this.visit(node.Arguments[0]!);
    let prop = this.visit(node.Arguments[1]!);
    prop = prop.Deref(c);

    const arg0 = node.Arguments[0]!;
    if (arg0 instanceof IdentifierNode && arg0.Value === "$env") {
      const arg1 = node.Arguments[1]!;
      if (arg1 instanceof StringNode) {
        const [nt, ok] = this.config.Env.Get(c, arg1.Value);
        if (ok) {
          return nt;
        }
      }
      return new Nature();
    }

    if (base.IsUnknown(c)) {
      return new Nature();
    }

    switch (base.Kind) {
      case Kind.Slice:
      case Kind.Array:
        if (!prop.IsInteger && !prop.IsUnknown(c)) {
          return this.error(
            node.Arguments[1]!,
            `non-integer slice index ${prop.String()}`,
          );
        }
        return base.Elem(c);
      case Kind.Map:
        if (!prop.AssignableTo(base.Key(c)) && !prop.IsUnknown(c)) {
          return this.error(
            node.Arguments[1]!,
            `cannot use ${prop.String()} to get an element from ${base.String()}`,
          );
        }
        return base.Elem(c);
    }
    return this.error(
      node.Arguments[0]!,
      `type ${base.String()} does not support indexing`,
    );
  }

  private checkFunction(f: Func, node: Node, arguments_: Node[]): Nature {
    const c = this.config.NtCache;
    if (f.Validate) {
      const args: Type[] = new Array(arguments_.length);
      for (let i = 0; i < arguments_.length; i++) {
        const argNature = this.visit(arguments_[i]!);
        if (argNature.IsUnknown(c)) {
          args[i] = anyType;
        } else {
          args[i] = argNature.Type!;
        }
      }
      let t: Type;
      try {
        t = f.Validate(args);
      } catch (e) {
        return this.error(node, `${(e as Error).message}`);
      }
      return FromType(t);
    } else if (!f.Types || f.Types.length === 0) {
      const [nt, err] = this.checkArguments(
        f.Name,
        FromType(f.Type()),
        arguments_,
        node,
      );
      if (err !== null) {
        if (this.err === null) {
          this.err = err;
        }
        return new Nature();
      }
      // No type was specified, so we assume the function returns any.
      return nt;
    }
    let lastErr: FileError | null = null;
    for (const t of f.Types) {
      const [outNature, err] = this.checkArguments(
        f.Name,
        FromType(t),
        arguments_,
        node,
      );
      if (err !== null) {
        lastErr = err;
        continue;
      }

      // As we found the correct function overload, we can stop the loop. Also,
      // we need to set the correct nature of the callee so compiler can
      // correctly handle OpDeref opcode.
      if (node instanceof CallNode) {
        node.Callee.SetType(t);
      }

      return outNature;
    }
    if (lastErr !== null) {
      if (this.err === null) {
        this.err = lastErr;
      }
      return new Nature();
    }

    return this.error(node, `no matching overload for ${f.Name}`);
  }

  private checkArguments(
    name: string,
    fn: Nature,
    arguments_: Node[],
    node: Node,
  ): [Nature, FileError | null] {
    const c = this.config.NtCache;
    if (fn.IsUnknown(c)) {
      return [new Nature(), null];
    }

    const numOut = fn.NumOut();
    if (numOut === 0) {
      return [
        new Nature(),
        new FileError({
          location: node.Location(),
          message: `func ${name} doesn't return value`,
        }),
      ];
    }
    if (numOut > 2) {
      return [
        new Nature(),
        new FileError({
          location: node.Location(),
          message: `func ${name} returns more then two values`,
        }),
      ];
    }

    // If func is method on an env, first argument should be a receiver, and
    // actual arguments less than fnNumIn by one.
    let fnNumIn = fn.NumIn();
    if (fn.Method) {
      fnNumIn--;
    }
    // Skip first argument in case of the receiver.
    let fnInOffset = 0;
    if (fn.Method) {
      fnInOffset = 1;
    }

    let err: FileError | null = null;
    const isVariadic = fn.IsVariadic();
    if (isVariadic) {
      if (arguments_.length < fnNumIn - 1) {
        err = new FileError({
          location: node.Location(),
          message: `not enough arguments to call ${name}`,
        });
      }
    } else {
      if (arguments_.length > fnNumIn) {
        err = new FileError({
          location: node.Location(),
          message: `too many arguments to call ${name}`,
        });
      }
      if (arguments_.length < fnNumIn) {
        err = new FileError({
          location: node.Location(),
          message: `not enough arguments to call ${name}`,
        });
      }
    }

    if (err !== null) {
      // If we have an error, we should still visit all arguments to type check
      // them, as a patch can fix the error later.
      for (const arg of arguments_) {
        this.visit(arg);
      }
      return [fn.Out(c, 0), err];
    }

    for (let i = 0; i < arguments_.length; i++) {
      const arg = arguments_[i]!;
      const argNature = this.visit(arg);

      let inN: Nature;
      if (isVariadic && i >= fnNumIn - 1) {
        // For variadic arguments fn(xs ...int), go replaces type of xs (int)
        // with ([]int). As we compare arguments one by one, we need underlying
        // type.
        inN = fn.InElem(c, fnNumIn - 1 + fnInOffset);
      } else {
        inN = fn.In(c, i + fnInOffset);
      }

      if (inN.IsFloat && argNature.IsInteger) {
        const ref: NodeRef = makeArgRef(arguments_, i);
        traverseAndReplaceIntegerNodesWithFloatNodes(ref, inN);
        continue;
      }

      if (inN.IsInteger && argNature.IsInteger && argNature.Kind !== inN.Kind) {
        const ref: NodeRef = makeArgRef(arguments_, i);
        traverseAndReplaceIntegerNodesWithIntegerNodes(ref, inN);
        continue;
      }

      if (argNature.Nil) {
        if (inN.Kind === Kind.Ptr || inN.Kind === Kind.Interface) {
          continue;
        }
        return [
          new Nature(),
          new FileError({
            location: arg.Location(),
            message: `cannot use nil as argument (type ${inN.String()}) to call ${name}`,
          }),
        ];
      }

      // Check if argument is assignable to the function input type. We check
      // original type (like *time.Time), not dereferenced type, as function
      // input type can be pointer to a struct.
      let assignable = argNature.AssignableTo(inN);

      // We also need to check if dereferenced arg type is assignable to the
      // function input type. For example, func(int) and argument *int. In this
      // case we will add OpDeref to the argument.
      if (!assignable && argNature.IsPointer()) {
        const nt = argNature.Deref(c);
        assignable = nt.AssignableTo(inN);
      }

      if (!assignable && !argNature.IsUnknown(c)) {
        return [
          new Nature(),
          new FileError({
            location: arg.Location(),
            message: `cannot use ${argNature.String()} as argument (type ${inN.String()}) to call ${name} `,
          }),
        ];
      }
    }

    return [fn.Out(c, 0), null];
  }

  private builtinNode(node: BuiltinNode): Nature {
    const c = this.config.NtCache;
    switch (node.Name) {
      case "all":
      case "none":
      case "any":
      case "one": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        this.begin(collection);
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (
          predicate.IsFunc() &&
          predicate.NumOut() === 1 &&
          predicate.NumIn() === 1 &&
          predicate.IsFirstArgUnknown(c)
        ) {
          const predicateOut = predicate.Out(c, 0);
          if (!predicateOut.IsBool() && !predicateOut.IsUnknown(c)) {
            return this.error(
              node.Arguments[1]!,
              `predicate should return boolean (got ${predicateOut.String()})`,
            );
          }
          return FromType(boolType);
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has one input and one output param",
        );
      }

      case "filter": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        this.begin(collection);
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (
          predicate.IsFunc() &&
          predicate.NumOut() === 1 &&
          predicate.NumIn() === 1 &&
          predicate.IsFirstArgUnknown(c)
        ) {
          const predicateOut = predicate.Out(c, 0);
          if (!predicateOut.IsBool() && !predicateOut.IsUnknown(c)) {
            return this.error(
              node.Arguments[1]!,
              `predicate should return boolean (got ${predicateOut.String()})`,
            );
          }
          if (collection.IsUnknown(c)) {
            return FromType(arrayType);
          }
          collection = collection.Elem(c);
          return collection.MakeArrayOf(c);
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has one input and one output param",
        );
      }

      case "map": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        this.begin(collection, { name: "index", nature: FromType(intType) });
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (
          predicate.IsFunc() &&
          predicate.NumOut() === 1 &&
          predicate.NumIn() === 1 &&
          predicate.IsFirstArgUnknown(c)
        ) {
          return predicate.Ref!.MakeArrayOf(c);
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has one input and one output param",
        );
      }

      case "count": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        if (node.Arguments.length === 1) {
          return FromType(intType);
        }

        this.begin(collection);
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (
          predicate.IsFunc() &&
          predicate.NumOut() === 1 &&
          predicate.NumIn() === 1 &&
          predicate.IsFirstArgUnknown(c)
        ) {
          const predicateOut = predicate.Out(c, 0);
          if (!predicateOut.IsBool() && !predicateOut.IsUnknown(c)) {
            return this.error(
              node.Arguments[1]!,
              `predicate should return boolean (got ${predicateOut.String()})`,
            );
          }
          return FromType(intType);
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has one input and one output param",
        );
      }

      case "sum": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        if (node.Arguments.length === 2) {
          this.begin(collection);
          const predicate = this.visit(node.Arguments[1]!);
          this.end();

          if (
            predicate.IsFunc() &&
            predicate.NumOut() === 1 &&
            predicate.NumIn() === 1 &&
            predicate.IsFirstArgUnknown(c)
          ) {
            return predicate.Out(c, 0);
          }
        } else {
          if (collection.IsUnknown(c)) {
            return new Nature();
          }
          return collection.Elem(c);
        }
        break;
      }

      case "find":
      case "findLast": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        this.begin(collection);
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (
          predicate.IsFunc() &&
          predicate.NumOut() === 1 &&
          predicate.NumIn() === 1 &&
          predicate.IsFirstArgUnknown(c)
        ) {
          const predicateOut = predicate.Out(c, 0);
          if (!predicateOut.IsBool() && !predicateOut.IsUnknown(c)) {
            return this.error(
              node.Arguments[1]!,
              `predicate should return boolean (got ${predicateOut.String()})`,
            );
          }
          if (collection.IsUnknown(c)) {
            return new Nature();
          }
          return collection.Elem(c);
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has one input and one output param",
        );
      }

      case "findIndex":
      case "findLastIndex": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        this.begin(collection);
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (
          predicate.IsFunc() &&
          predicate.NumOut() === 1 &&
          predicate.NumIn() === 1 &&
          predicate.IsFirstArgUnknown(c)
        ) {
          const predicateOut = predicate.Out(c, 0);
          if (!predicateOut.IsBool() && !predicateOut.IsUnknown(c)) {
            return this.error(
              node.Arguments[1]!,
              `predicate should return boolean (got ${predicateOut.String()})`,
            );
          }
          return FromType(intType);
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has one input and one output param",
        );
      }

      case "groupBy": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        this.begin(collection);
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (
          predicate.IsFunc() &&
          predicate.NumOut() === 1 &&
          predicate.NumIn() === 1 &&
          predicate.IsFirstArgUnknown(c)
        ) {
          collection = collection.Elem(c);
          collection = collection.MakeArrayOf(c);
          const nt = NatureOf(new Map<any, any[]>());
          nt.Ref = collection;
          return nt;
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has one input and one output param",
        );
      }

      case "sortBy": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        this.begin(collection);
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (node.Arguments.length === 3) {
          const order = this.visit(node.Arguments[2]!);
          if (!order.IsString() && !order.IsUnknown(c)) {
            return this.error(
              node.Arguments[2]!,
              `sortBy order argument must be a string (got ${order.String()})`,
            );
          }
        }

        if (
          predicate.IsFunc() &&
          predicate.NumOut() === 1 &&
          predicate.NumIn() === 1 &&
          predicate.IsFirstArgUnknown(c)
        ) {
          return collection;
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has one input and one output param",
        );
      }

      case "reduce": {
        let collection = this.visit(node.Arguments[0]!);
        collection = collection.Deref(c);
        if (!collection.IsArray() && !collection.IsUnknown(c)) {
          return this.error(
            node.Arguments[0]!,
            `builtin ${node.Name} takes only array (got ${collection.String()})`,
          );
        }

        this.begin(
          collection,
          { name: "index", nature: FromType(intType) },
          { name: "acc", nature: new Nature() },
        );
        const predicate = this.visit(node.Arguments[1]!);
        this.end();

        if (node.Arguments.length === 3) {
          this.visit(node.Arguments[2]!);
        }

        if (predicate.IsFunc() && predicate.NumOut() === 1) {
          return predicate.Ref!;
        }
        return this.error(
          node.Arguments[1]!,
          "predicate should has two input and one output param",
        );
      }
    }

    const id = BuiltinIndex.get(node.Name);
    if (id !== undefined) {
      switch (node.Name) {
        case "get":
          return this.checkBuiltinGet(node);
      }
      return this.checkFunction(Builtins[id]!, node, node.Arguments);
    }

    return this.error(node, `unknown builtin ${node.Name}`);
  }

  private predicateNode(node: PredicateNode): Nature {
    const nt = this.visit(node.Node);
    const out: Type[] = [];
    if (nt.IsUnknown(this.config.NtCache)) {
      out.push(anyType);
    } else if (!nt.Nil) {
      out.push(nt.Type!);
    }
    const n = FromType(FuncOf(anyTypeSlice, out, false));
    n.Ref = nt;
    return n;
  }

  private pointerNode(node: PointerNode): Nature {
    const c = this.config.NtCache;
    if (this.predicateScopes.length === 0) {
      return this.error(node, "cannot use pointer accessor outside predicate");
    }
    const scope = this.predicateScopes[this.predicateScopes.length - 1]!;
    if (node.Name === "") {
      if (scope.collection.IsUnknown(c)) {
        return new Nature();
      }
      switch (scope.collection.Kind) {
        case Kind.Array:
        case Kind.Slice:
          return scope.collection.Elem(c);
      }
      return this.error(node, `cannot use ${scope.collection.String()} as array`);
    }
    if (scope.vars !== null) {
      for (let i = 0; i < scope.vars.length; i++) {
        if (node.Name === scope.vars[i]!.name) {
          return scope.vars[i]!.nature;
        }
      }
    }
    return this.error(node, `unknown pointer #${node.Name}`);
  }

  private variableDeclaratorNode(node: VariableDeclaratorNode): Nature {
    const c = this.config.NtCache;
    const [, envOk] = this.config.Env.Get(c, node.Name);
    if (envOk) {
      return this.error(node, `cannot redeclare ${node.Name}`);
    }
    if (this.config.Functions.has(node.Name)) {
      return this.error(node, `cannot redeclare function ${node.Name}`);
    }
    if (this.config.Builtins.has(node.Name)) {
      return this.error(node, `cannot redeclare builtin ${node.Name}`);
    }
    for (let i = this.varScopes.length - 1; i >= 0; i--) {
      if (this.varScopes[i]!.name === node.Name) {
        return this.error(node, `cannot redeclare variable ${node.Name}`);
      }
    }
    const varNature = this.visit(node.Value);
    this.varScopes.push({ name: node.Name, nature: varNature });
    const exprNature = this.visit(node.Expr);
    this.varScopes.pop();
    return exprNature;
  }

  private sequenceNode(node: SequenceNode): Nature {
    if (node.Nodes.length === 0) {
      return this.error(node, "empty sequence expression");
    }
    let last = new Nature();
    for (const n of node.Nodes) {
      last = this.visit(n);
    }
    return last;
  }

  private conditionalNode(node: ConditionalNode): Nature {
    const c = this.config.NtCache;
    let cond = this.visit(node.Cond);
    cond = cond.Deref(c);
    if (!cond.IsBool() && !cond.IsUnknown(c)) {
      return this.error(
        node.Cond,
        `non-bool expression (type ${cond.String()}) used as condition`,
      );
    }

    const t1 = this.visit(node.Exp1);
    const t2 = this.visit(node.Exp2);

    if (t1.Nil && !t2.Nil) {
      return t2;
    }
    if (!t1.Nil && t2.Nil) {
      return t1;
    }
    if (t1.Nil && t2.Nil) {
      return NatureOf(null);
    }
    if (t1.AssignableTo(t2)) {
      if (t1.IsArray() && t2.IsArray()) {
        const e1 = t1.Elem(c);
        const e2 = t2.Elem(c);
        if (!e1.AssignableTo(e2) || !e2.AssignableTo(e1)) {
          return FromType(arrayType);
        }
      }
      return t1;
    }
    return new Nature();
  }

  private arrayNode(node: ArrayNode): Nature {
    const c = this.config.NtCache;
    let prev = new Nature();
    let allElementsAreSameType = true;
    for (let i = 0; i < node.Nodes.length; i++) {
      const curr = this.visit(node.Nodes[i]!);
      if (i > 0) {
        if (curr.Kind !== prev.Kind) {
          allElementsAreSameType = false;
        }
      }
      prev = curr;
    }
    if (allElementsAreSameType) {
      return prev.MakeArrayOf(c);
    }
    return FromType(arrayType);
  }

  private mapNode(node: MapNode): Nature {
    for (const pair of node.Pairs) {
      this.visit(pair);
    }
    return FromType(mapType);
  }

  private pairNode(node: PairNode): Nature {
    this.visit(node.Key);
    this.visit(node.Value);
    return NatureOf(null);
  }
}

// --- module-level helpers ---

// makeArgRef creates a NodeRef bound to an element of the arguments array, so
// that node-replacing traversals (integer->float coercion) write back into the
// array, mirroring Go's &arguments[i].
function makeArgRef(arr: Node[], i: number): NodeRef {
  return {
    get node(): Node {
      return arr[i]!;
    },
    set node(n: Node) {
      arr[i] = n;
    },
  };
}

function traverseAndReplaceIntegerNodesWithFloatNodes(
  ref: NodeRef,
  newNature: Nature,
): void {
  const n = ref.node;
  if (n instanceof IntegerNode) {
    const fn = new FloatNode(Number(n.Value));
    ref.node = fn;
    if (newNature.Type !== null) {
      fn.SetType(newNature.Type);
    }
  } else if (n instanceof UnaryNode) {
    const childRef: NodeRef = {
      get node(): Node {
        return n.Node;
      },
      set node(c: Node) {
        n.Node = c;
      },
    };
    traverseAndReplaceIntegerNodesWithFloatNodes(childRef, newNature);
  } else if (n instanceof BinaryNode) {
    switch (n.Operator) {
      case "+":
      case "-":
      case "*": {
        const leftRef: NodeRef = {
          get node(): Node {
            return n.Left;
          },
          set node(c: Node) {
            n.Left = c;
          },
        };
        const rightRef: NodeRef = {
          get node(): Node {
            return n.Right;
          },
          set node(c: Node) {
            n.Right = c;
          },
        };
        traverseAndReplaceIntegerNodesWithFloatNodes(leftRef, newNature);
        traverseAndReplaceIntegerNodesWithFloatNodes(rightRef, newNature);
      }
    }
  }
}

function traverseAndReplaceIntegerNodesWithIntegerNodes(
  ref: NodeRef,
  newNature: Nature,
): void {
  const n = ref.node;
  if (n instanceof IntegerNode) {
    if (newNature.Type !== null) {
      n.SetType(newNature.Type);
    }
  } else if (n instanceof UnaryNode) {
    if (newNature.Type !== null) {
      n.SetType(newNature.Type);
    }
    const childRef: NodeRef = {
      get node(): Node {
        return n.Node;
      },
      set node(c: Node) {
        n.Node = c;
      },
    };
    traverseAndReplaceIntegerNodesWithIntegerNodes(childRef, newNature);
  } else if (n instanceof BinaryNode) {
    switch (n.Operator) {
      case "+":
      case "-":
      case "*": {
        const leftRef: NodeRef = {
          get node(): Node {
            return n.Left;
          },
          set node(c: Node) {
            n.Left = c;
          },
        };
        const rightRef: NodeRef = {
          get node(): Node {
            return n.Right;
          },
          set node(c: Node) {
            n.Right = c;
          },
        };
        traverseAndReplaceIntegerNodesWithIntegerNodes(leftRef, newNature);
        traverseAndReplaceIntegerNodesWithIntegerNodes(rightRef, newNature);
      }
    }
  }
}

// kindString returns a Go-style kind name for Expect error messages.
function kindString(k: Kind): string {
  switch (k) {
    case Kind.Int:
      return "int";
    case Kind.Int64:
      return "int64";
    case Kind.Float64:
      return "float64";
    default:
      return Kind[k] ? Kind[k].toLowerCase() : String(k);
  }
}
