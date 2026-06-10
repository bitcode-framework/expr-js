// Port of expr-lang/expr vm/program.go
import type { Node } from "../ast/node.js";
import { Builtins } from "../builtin/builtin.js";
import { Source } from "../file/source.js";
import { Location } from "../file/location.js";
import { Field, Method } from "./runtime/runtime.js";
import { Opcode } from "./opcodes.js";
import type { Span } from "./utils.js";

export type VMFunction = (...params: any[]) => any;

// Program represents a compiled expression.
export class Program {
  Bytecode: Opcode[];
  Arguments: number[];
  Constants: any[];

  source: Source;
  node: Node | null;
  locations: Location[];
  variables: number;
  functions: VMFunction[];
  debugInfo: Map<string, string>;
  span: Span | null;

  constructor(
    source: Source,
    node: Node | null,
    locations: Location[],
    variables: number,
    constants: any[],
    bytecode: Opcode[],
    args: number[],
    functions: VMFunction[],
    debugInfo: Map<string, string>,
    span: Span | null,
  ) {
    this.source = source;
    this.node = node;
    this.locations = locations;
    this.variables = variables;
    this.Constants = constants;
    this.Bytecode = bytecode;
    this.Arguments = args;
    this.functions = functions;
    this.debugInfo = debugInfo;
    this.span = span;
  }

  Source(): Source {
    return this.source;
  }

  Node(): Node | null {
    return this.node;
  }

  Locations(): Location[] {
    return this.locations;
  }

  Disassemble(): string {
    let out = "";
    let ip = 0;
    const bc = this.Bytecode;
    const args = this.Arguments;
    while (ip < bc.length) {
      const pp = ip;
      const op = bc[ip]!;
      const arg = args[ip]!;
      ip += 1;

      const code = (label: string) => {
        out += `${pp}\t${label}\n`;
      };
      const jump = (label: string) => {
        out += `${pp}\t${label}\t<${arg}>\t(${ip + arg})\n`;
      };
      const jumpBack = (label: string) => {
        out += `${pp}\t${label}\t<${arg}>\t(${ip - arg})\n`;
      };
      const argument = (label: string) => {
        out += `${pp}\t${label}\t<${arg}>\n`;
      };
      const argumentWithInfo = (label: string, prefix: string) => {
        const info = this.debugInfo.get(`${prefix}_${arg}`) ?? "";
        out += `${pp}\t${label}\t<${arg}>\t${info}\n`;
      };
      const constant = (label: string) => {
        let c: any;
        if (arg < this.Constants.length) {
          c = this.Constants[arg];
        } else {
          c = "out of range";
        }
        const name = this.debugInfo.get(`const_${arg}`);
        if (name !== undefined) {
          c = name;
        }
        if (c instanceof RegExp) {
          c = c.source;
        }
        if (c instanceof Field) {
          c = `{${c.Path.join(".")} ${JSON.stringify(c.Index)}}`;
        }
        if (c instanceof Method) {
          c = `{${c.Name} ${c.Index}}`;
        }
        out += `${pp}\t${label}\t<${arg}>\t${c}\n`;
      };
      const builtinArg = (label: string) => {
        out += `${pp}\t${label}\t<${arg}>\t${Builtins[arg]!.Name}\n`;
      };

      switch (op) {
        case Opcode.OpInvalid: code("OpInvalid"); break;
        case Opcode.OpPush: constant("OpPush"); break;
        case Opcode.OpInt: argument("OpInt"); break;
        case Opcode.OpPop: code("OpPop"); break;
        case Opcode.OpStore: argumentWithInfo("OpStore", "var"); break;
        case Opcode.OpLoadVar: argumentWithInfo("OpLoadVar", "var"); break;
        case Opcode.OpLoadConst: constant("OpLoadConst"); break;
        case Opcode.OpLoadField: constant("OpLoadField"); break;
        case Opcode.OpLoadFast: constant("OpLoadFast"); break;
        case Opcode.OpLoadMethod: constant("OpLoadMethod"); break;
        case Opcode.OpLoadFunc: argumentWithInfo("OpLoadFunc", "func"); break;
        case Opcode.OpLoadEnv: code("OpLoadEnv"); break;
        case Opcode.OpFetch: code("OpFetch"); break;
        case Opcode.OpFetchField: constant("OpFetchField"); break;
        case Opcode.OpMethod: constant("OpMethod"); break;
        case Opcode.OpTrue: code("OpTrue"); break;
        case Opcode.OpFalse: code("OpFalse"); break;
        case Opcode.OpNil: code("OpNil"); break;
        case Opcode.OpNegate: code("OpNegate"); break;
        case Opcode.OpNot: code("OpNot"); break;
        case Opcode.OpEqual: code("OpEqual"); break;
        case Opcode.OpEqualInt: code("OpEqualInt"); break;
        case Opcode.OpEqualString: code("OpEqualString"); break;
        case Opcode.OpJump: jump("OpJump"); break;
        case Opcode.OpJumpIfTrue: jump("OpJumpIfTrue"); break;
        case Opcode.OpJumpIfFalse: jump("OpJumpIfFalse"); break;
        case Opcode.OpJumpIfNil: jump("OpJumpIfNil"); break;
        case Opcode.OpJumpIfNotNil: jump("OpJumpIfNotNil"); break;
        case Opcode.OpJumpIfEnd: jump("OpJumpIfEnd"); break;
        case Opcode.OpJumpBackward: jumpBack("OpJumpBackward"); break;
        case Opcode.OpIn: code("OpIn"); break;
        case Opcode.OpLess: code("OpLess"); break;
        case Opcode.OpMore: code("OpMore"); break;
        case Opcode.OpLessOrEqual: code("OpLessOrEqual"); break;
        case Opcode.OpMoreOrEqual: code("OpMoreOrEqual"); break;
        case Opcode.OpAdd: code("OpAdd"); break;
        case Opcode.OpSubtract: code("OpSubtract"); break;
        case Opcode.OpMultiply: code("OpMultiply"); break;
        case Opcode.OpDivide: code("OpDivide"); break;
        case Opcode.OpModulo: code("OpModulo"); break;
        case Opcode.OpExponent: code("OpExponent"); break;
        case Opcode.OpRange: code("OpRange"); break;
        case Opcode.OpMatches: code("OpMatches"); break;
        case Opcode.OpMatchesConst: constant("OpMatchesConst"); break;
        case Opcode.OpContains: code("OpContains"); break;
        case Opcode.OpStartsWith: code("OpStartsWith"); break;
        case Opcode.OpEndsWith: code("OpEndsWith"); break;
        case Opcode.OpSlice: code("OpSlice"); break;
        case Opcode.OpCall: argument("OpCall"); break;
        case Opcode.OpCall0: argumentWithInfo("OpCall0", "func"); break;
        case Opcode.OpCall1: argumentWithInfo("OpCall1", "func"); break;
        case Opcode.OpCall2: argumentWithInfo("OpCall2", "func"); break;
        case Opcode.OpCall3: argumentWithInfo("OpCall3", "func"); break;
        case Opcode.OpCallN: argument("OpCallN"); break;
        case Opcode.OpCallFast: argument("OpCallFast"); break;
        case Opcode.OpCallSafe: argument("OpCallSafe"); break;
        case Opcode.OpCallTyped: argument("OpCallTyped"); break;
        case Opcode.OpCallBuiltin1: builtinArg("OpCallBuiltin1"); break;
        case Opcode.OpArray: code("OpArray"); break;
        case Opcode.OpMap: code("OpMap"); break;
        case Opcode.OpLen: code("OpLen"); break;
        case Opcode.OpCast: argument("OpCast"); break;
        case Opcode.OpDeref: code("OpDeref"); break;
        case Opcode.OpIncrementIndex: code("OpIncrementIndex"); break;
        case Opcode.OpDecrementIndex: code("OpDecrementIndex"); break;
        case Opcode.OpIncrementCount: code("OpIncrementCount"); break;
        case Opcode.OpGetIndex: code("OpGetIndex"); break;
        case Opcode.OpGetCount: code("OpGetCount"); break;
        case Opcode.OpGetLen: code("OpGetLen"); break;
        case Opcode.OpGetAcc: code("OpGetAcc"); break;
        case Opcode.OpSetAcc: code("OpSetAcc"); break;
        case Opcode.OpSetIndex: code("OpSetIndex"); break;
        case Opcode.OpPointer: code("OpPointer"); break;
        case Opcode.OpThrow: code("OpThrow"); break;
        case Opcode.OpCreate: argument("OpCreate"); break;
        case Opcode.OpGroupBy: code("OpGroupBy"); break;
        case Opcode.OpSortBy: code("OpSortBy"); break;
        case Opcode.OpSort: code("OpSort"); break;
        case Opcode.OpProfileStart: code("OpProfileStart"); break;
        case Opcode.OpProfileEnd: code("OpProfileEnd"); break;
        case Opcode.OpBegin: code("OpBegin"); break;
        case Opcode.OpAnd: code("OpAnd"); break;
        case Opcode.OpOr: code("OpOr"); break;
        case Opcode.OpEnd: code("OpEnd"); break;
        default:
          out += `${ip}\t0x${(op as number).toString(16)} (unknown)\n`;
      }
    }
    return out;
  }
}

export function NewProgram(
  source: Source,
  node: Node | null,
  locations: Location[],
  variables: number,
  constants: any[],
  bytecode: Opcode[],
  args: number[],
  functions: VMFunction[],
  debugInfo: Map<string, string>,
  span: Span | null,
): Program {
  return new Program(
    source,
    node,
    locations,
    variables,
    constants,
    bytecode,
    args,
    functions,
    debugInfo,
    span,
  );
}
