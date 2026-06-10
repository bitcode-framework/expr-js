// Port of expr-lang/expr vm/vm.go
// DIVERGENCE (documented in PARITY.md): Go uses reflect for OpCall function
// invocation and []reflect.Value arg marshaling. This port calls JS functions
// directly. Numeric model: bigint(int64)+number(float64). OpInt pushes an int,
// which we represent as bigint to match Go integer semantics.
import { Program, VMFunction } from "./program.js";
import { Opcode } from "./opcodes.js";
import { Scope, GroupBy } from "./utils.js";
import { Config } from "../conf/config.js";
import { FileError } from "../file/error.js";
import { Location } from "../file/location.js";
import { Builtins } from "../builtin/builtin.js";
import { Field, Method } from "./runtime/runtime.js";
import * as runtime from "./runtime/runtime.js";
import { SortBy } from "./runtime/sort.js";
import { FUNC_TYPES_ARITY } from "../checker/info.js";

const DefaultMemoryBudget = 1e6;

export function Run(program: Program | null, env: any): any {
  if (program === null) {
    throw new Error("program is nil");
  }
  const vm = new VM();
  return vm.Run(program, env);
}

export class VM {
  Stack: any[];
  Scopes: Scope[];
  Variables: any[];
  MemoryBudget: number;
  private ip: number;
  private memory: number;
  private currScope: Scope | null;

  constructor() {
    this.Stack = [];
    this.Scopes = [];
    this.Variables = [];
    this.MemoryBudget = 0;
    this.ip = 0;
    this.memory = 0;
    this.currScope = null;
  }

  Run(program: Program, env: any): any {
    try {
      return this.run(program, env);
    } catch (r) {
      let location = new Location();
      if (this.ip - 1 < program.locations.length && this.ip - 1 >= 0) {
        location = program.locations[this.ip - 1]!;
      }
      const f = new FileError({
        location,
        message: r instanceof Error ? r.message : String(r),
      });
      if (r instanceof Error) {
        f.Wrap(r);
      }
      throw f.Bind(program.source);
    }
  }

  private run(program: Program, env: any): any {
    this.Stack = [];
    this.Scopes = [];
    this.currScope = null;
    if (this.Variables.length < program.variables) {
      this.Variables = new Array(program.variables).fill(null);
    }
    if (this.MemoryBudget === 0) {
      this.MemoryBudget = DefaultMemoryBudget;
    }
    this.memory = 0;
    this.ip = 0;

    const bc = program.Bytecode;
    const argsArr = program.Arguments;
    const constants = program.Constants;

    while (this.ip < bc.length) {
      const op = bc[this.ip]!;
      const arg = argsArr[this.ip]!;
      this.ip += 1;

      switch (op) {
        case Opcode.OpInvalid:
          throw new Error("invalid opcode");
        case Opcode.OpPush:
          this.push(constants[arg]);
          break;
        case Opcode.OpInt:
          // Go pushes an int; represent as bigint to preserve int semantics.
          this.push(BigInt(arg));
          break;
        case Opcode.OpPop:
          this.pop();
          break;
        case Opcode.OpStore:
          this.Variables[arg] = this.pop();
          break;
        case Opcode.OpLoadVar:
          this.push(this.Variables[arg]);
          break;
        case Opcode.OpLoadConst:
          this.push(runtime.Fetch(env, constants[arg]));
          break;
        case Opcode.OpLoadField:
          this.push(runtime.FetchField(env, constants[arg] as Field));
          break;
        case Opcode.OpLoadFast:
          this.push(fastGet(env, constants[arg] as string));
          break;
        case Opcode.OpLoadMethod:
          this.push(runtime.FetchMethod(env, constants[arg] as Method));
          break;
        case Opcode.OpLoadFunc:
          this.push(program.functions[arg]);
          break;
        case Opcode.OpFetch: {
          const b = this.pop();
          const a = this.pop();
          this.push(runtime.Fetch(a, b));
          break;
        }
        case Opcode.OpFetchField: {
          const a = this.pop();
          this.push(runtime.FetchField(a, constants[arg] as Field));
          break;
        }
        case Opcode.OpLoadEnv:
          this.push(env);
          break;
        case Opcode.OpMethod: {
          const a = this.pop();
          this.push(runtime.FetchMethod(a, constants[arg] as Method));
          break;
        }
        case Opcode.OpTrue:
          this.push(true);
          break;
        case Opcode.OpFalse:
          this.push(false);
          break;
        case Opcode.OpNil:
          this.push(null);
          break;
        case Opcode.OpNegate:
          this.push(runtime.Negate(this.pop()));
          break;
        case Opcode.OpNot:
          this.push(!(this.pop() as boolean));
          break;
        case Opcode.OpEqual: {
          const b = this.pop();
          const a = this.pop();
          this.push(runtime.Equal(a, b));
          break;
        }
        case Opcode.OpEqualInt: {
          const b = this.pop();
          const a = this.pop();
          this.push(a === b);
          break;
        }
        case Opcode.OpEqualString: {
          const b = this.pop();
          const a = this.pop();
          this.push(a === b);
          break;
        }
        default:
          this.runOp2(op, arg, program, env, constants);
      }
    }

    if (this.Stack.length > 0) {
      return this.pop();
    }
    return null;
  }

  private runOp2(
    op: Opcode,
    arg: number,
    program: Program,
    env: any,
    constants: any[],
  ): void {
    switch (op) {
      case Opcode.OpJump:
        if (arg < 0) throw new Error("negative jump offset is invalid");
        this.ip += arg;
        break;
      case Opcode.OpJumpIfTrue:
        if (arg < 0) throw new Error("negative jump offset is invalid");
        if (this.current() as boolean) this.ip += arg;
        break;
      case Opcode.OpJumpIfFalse:
        if (arg < 0) throw new Error("negative jump offset is invalid");
        if (!(this.current() as boolean)) this.ip += arg;
        break;
      case Opcode.OpJumpIfNil:
        if (arg < 0) throw new Error("negative jump offset is invalid");
        if (runtime.IsNil(this.current())) this.ip += arg;
        break;
      case Opcode.OpJumpIfNotNil:
        if (arg < 0) throw new Error("negative jump offset is invalid");
        if (!runtime.IsNil(this.current())) this.ip += arg;
        break;
      case Opcode.OpJumpIfEnd:
        if (arg < 0) throw new Error("negative jump offset is invalid");
        if (this.currScope!.Index >= this.currScope!.Len) this.ip += arg;
        break;
      case Opcode.OpJumpBackward:
        this.ip -= arg;
        break;
      case Opcode.OpIn: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.In(a, b));
        break;
      }
      case Opcode.OpLess: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.Less(a, b));
        break;
      }
      case Opcode.OpMore: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.More(a, b));
        break;
      }
      case Opcode.OpLessOrEqual: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.LessOrEqual(a, b));
        break;
      }
      case Opcode.OpMoreOrEqual: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.MoreOrEqual(a, b));
        break;
      }
      case Opcode.OpAdd: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.Add(a, b));
        break;
      }
      case Opcode.OpSubtract: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.Subtract(a, b));
        break;
      }
      case Opcode.OpMultiply: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.Multiply(a, b));
        break;
      }
      case Opcode.OpDivide: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.Divide(a, b));
        break;
      }
      case Opcode.OpModulo: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.Modulo(a, b));
        break;
      }
      case Opcode.OpExponent: {
        const b = this.pop();
        const a = this.pop();
        this.push(runtime.Exponent(a, b));
        break;
      }
      case Opcode.OpRange: {
        const b = this.pop();
        const a = this.pop();
        const min = runtime.ToInt(a);
        const max = runtime.ToInt(b);
        let size = max - min + 1;
        if (size <= 0) size = 0;
        this.memGrow(size);
        this.push(runtime.MakeRange(min, max));
        break;
      }
      default:
        this.runOp3(op, arg, program, env, constants);
    }
  }

  private runOp3(
    op: Opcode,
    arg: number,
    program: Program,
    env: any,
    constants: any[],
  ): void {
    switch (op) {
      case Opcode.OpMatches: {
        const b = this.pop();
        const a = this.pop();
        if (runtime.IsNil(a) || runtime.IsNil(b)) {
          this.push(false);
          break;
        }
        const re = new RegExp(b as string);
        this.push(re.test(a as string));
        break;
      }
      case Opcode.OpMatchesConst: {
        const a = this.pop();
        if (runtime.IsNil(a)) {
          this.push(false);
          break;
        }
        const r = constants[arg] as RegExp;
        this.push(new RegExp(r.source, r.flags).test(a as string));
        break;
      }
      case Opcode.OpContains: {
        const b = this.pop();
        const a = this.pop();
        if (runtime.IsNil(a) || runtime.IsNil(b)) {
          this.push(false);
          break;
        }
        this.push((a as string).includes(b as string));
        break;
      }
      case Opcode.OpStartsWith: {
        const b = this.pop();
        const a = this.pop();
        if (runtime.IsNil(a) || runtime.IsNil(b)) {
          this.push(false);
          break;
        }
        this.push((a as string).startsWith(b as string));
        break;
      }
      case Opcode.OpEndsWith: {
        const b = this.pop();
        const a = this.pop();
        if (runtime.IsNil(a) || runtime.IsNil(b)) {
          this.push(false);
          break;
        }
        this.push((a as string).endsWith(b as string));
        break;
      }
      case Opcode.OpSlice: {
        const from = this.pop();
        const to = this.pop();
        const node = this.pop();
        this.push(runtime.Slice(node, from, to));
        break;
      }
      case Opcode.OpCall: {
        const v = this.pop();
        if (v === null || v === undefined) {
          throw new Error("invalid operation: cannot call nil");
        }
        if (typeof v !== "function") {
          throw new Error(
            `invalid operation: cannot call non-function`,
          );
        }
        const size = arg;
        const inArgs = new Array(size);
        for (let i = size - 1; i >= 0; i--) {
          inArgs[i] = this.pop();
        }
        this.push((v as (...a: any[]) => any)(...inArgs));
        break;
      }
      case Opcode.OpCall0:
        this.push(program.functions[arg]!());
        break;
      case Opcode.OpCall1: {
        const a = this.getArgs(1);
        this.push(program.functions[arg]!(...a));
        break;
      }
      case Opcode.OpCall2: {
        const a = this.getArgs(2);
        this.push(program.functions[arg]!(...a));
        break;
      }
      case Opcode.OpCall3: {
        const a = this.getArgs(3);
        this.push(program.functions[arg]!(...a));
        break;
      }
      case Opcode.OpCallN: {
        const fn = this.pop() as VMFunction;
        const a = this.getArgs(arg);
        this.push(fn(...a));
        break;
      }
      case Opcode.OpCallFast: {
        const fn = this.pop() as (...a: any[]) => any;
        const a = this.getArgs(arg);
        this.push(fn(...a));
        break;
      }
      case Opcode.OpCallSafe: {
        const fn = this.pop() as (...a: any[]) => [any, number];
        const a = this.getArgs(arg);
        const [out, mem] = fn(...a);
        this.memGrow(mem);
        this.push(out);
        break;
      }
      case Opcode.OpCallTyped: {
        // OpCallTyped's arg is the FuncTypes index, not the argument count.
        // Look up the arity from FUNC_TYPES_ARITY.
        const fn = this.pop() as (...a: any[]) => any;
        const arity = FUNC_TYPES_ARITY[arg] ?? 0;
        const a = this.getArgs(arity);
        this.push(fn(...a));
        break;
      }
      case Opcode.OpCallBuiltin1:
        this.push(Builtins[arg]!.Fast!(this.pop()));
        break;
      case Opcode.OpArray: {
        const size = Number(this.pop());
        this.memGrow(size);
        const array = new Array(size);
        for (let i = size - 1; i >= 0; i--) {
          array[i] = this.pop();
        }
        this.push(array);
        break;
      }
      case Opcode.OpMap: {
        const size = Number(this.pop());
        this.memGrow(size);
        const pairs: [string, any][] = new Array(size);
        for (let i = size - 1; i >= 0; i--) {
          const value = this.pop();
          const key = this.pop();
          pairs[i] = [key as string, value];
        }
        const m: Record<string, any> = {};
        for (const [key, value] of pairs) {
          m[key] = value;
        }
        this.push(m);
        break;
      }
      case Opcode.OpLen:
        this.push(BigInt(runtime.Len(this.current())));
        break;
      case Opcode.OpCast:
        switch (arg) {
          case 0:
            this.push(BigInt(runtime.ToInt(this.pop())));
            break;
          case 1:
            this.push(runtime.ToInt64(this.pop()));
            break;
          case 2:
            this.push(runtime.ToFloat64(this.pop()));
            break;
          case 3:
            this.push(runtime.ToBool(this.pop()));
            break;
        }
        break;
      case Opcode.OpDeref:
        this.push(this.pop());
        break;
      case Opcode.OpIncrementIndex:
        this.currScope!.Index++;
        break;
      case Opcode.OpDecrementIndex:
        this.currScope!.Index--;
        break;
      case Opcode.OpIncrementCount:
        this.currScope!.Count++;
        break;
      case Opcode.OpGetIndex:
        this.push(BigInt(this.currScope!.Index));
        break;
      case Opcode.OpGetCount:
        this.push(BigInt(this.currScope!.Count));
        break;
      case Opcode.OpGetLen:
        this.push(BigInt(this.currScope!.Len));
        break;
      case Opcode.OpGetAcc:
        this.push(this.currScope!.Acc);
        break;
      case Opcode.OpSetAcc:
        this.currScope!.Acc = this.pop();
        break;
      case Opcode.OpSetIndex:
        this.currScope!.Index = Number(this.pop());
        break;
      case Opcode.OpPointer:
        this.push(this.currScope!.Item());
        break;
      case Opcode.OpThrow:
        throw this.pop() as Error;
      case Opcode.OpCreate:
        switch (arg) {
          case 1:
            this.push(new Map() as GroupBy);
            break;
          case 2: {
            const order = this.pop();
            if (typeof order !== "string") {
              throw new Error("sortBy order argument must be a string");
            }
            let desc: boolean;
            if (order === "asc") desc = false;
            else if (order === "desc") desc = true;
            else throw new Error("unknown order, use asc or desc");
            this.push(new SortBy(desc));
            break;
          }
          default:
            throw new Error(`unknown OpCreate argument ${arg}`);
        }
        break;
      case Opcode.OpGroupBy: {
        const scope = this.currScope!;
        const key = this.pop();
        const gb = scope.Acc as GroupBy;
        const cur = gb.get(key) ?? [];
        cur.push(scope.Item());
        gb.set(key, cur);
        break;
      }
      case Opcode.OpSortBy: {
        const scope = this.currScope!;
        const value = this.pop();
        const sortable = scope.Acc as SortBy;
        sortable.Array.push(scope.Item());
        sortable.Values.push(value);
        break;
      }
      case Opcode.OpSort: {
        const scope = this.currScope!;
        const sortable = scope.Acc as SortBy;
        sortable.sort();
        this.memGrow(scope.Len);
        this.push(sortable.Array);
        break;
      }
      case Opcode.OpProfileStart: {
        // Profiling: record start time on the Span constant.
        const span = constants[arg] as { start: number; Duration: number };
        if (span && typeof span === "object") {
          span.start = Date.now();
        }
        break;
      }
      case Opcode.OpProfileEnd: {
        // Profiling: accumulate elapsed time into the Span.
        const span = constants[arg] as { start: number; Duration: number };
        if (span && typeof span === "object") {
          span.Duration += Date.now() - span.start;
        }
        break;
      }
      case Opcode.OpBegin: {
        const a = this.pop();
        const s = this.allocScope();
        // Numeric fast-path arrays are not distinguished in the TS port; all
        // arrays go through Anys. Behavior is identical.
        s.Anys = a as any[];
        s.Len = (a as any[]).length;
        this.Scopes.push(s);
        this.currScope = s;
        break;
      }
      case Opcode.OpAnd: {
        const a = this.pop();
        const b = this.pop();
        this.push((a as boolean) && (b as boolean));
        break;
      }
      case Opcode.OpOr: {
        const a = this.pop();
        const b = this.pop();
        this.push((a as boolean) || (b as boolean));
        break;
      }
      case Opcode.OpEnd:
        this.Scopes.pop();
        this.currScope =
          this.Scopes.length > 0 ? this.Scopes[this.Scopes.length - 1]! : null;
        break;
      default:
        throw new Error(`unknown bytecode 0x${(op as number).toString(16)}`);
    }
  }

  private push(value: any): void {
    this.Stack.push(value);
  }

  private current(): any {
    if (this.Stack.length === 0) throw new Error("stack underflow");
    return this.Stack[this.Stack.length - 1];
  }

  private pop(): any {
    if (this.Stack.length === 0) throw new Error("stack underflow");
    return this.Stack.pop();
  }

  private memGrow(size: number): void {
    this.memory += size;
    if (this.memory >= this.MemoryBudget) {
      throw new Error("memory budget exceeded");
    }
  }

  private allocScope(): Scope {
    return new Scope();
  }

  private getArgs(needed: number): any[] {
    if (needed === 0) return [];
    const buf = this.Stack.slice(this.Stack.length - needed);
    this.Stack.length -= needed;
    return buf;
  }
}

// helper: fast map get supporting Map and plain object env.
function fastGet(env: any, key: string): any {
  if (env instanceof Map) return env.get(key);
  return env?.[key];
}
