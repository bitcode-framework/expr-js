// @bitcode-framework/expr-js — public entrypoint.
// A TypeScript port of expr-lang/expr v1.17.8.
//
// Go-style API (source parity): Compile, Run, Eval, Parse, plus Option helpers.
// camelCase aliases (JS ergonomics): compile, run, evaluate, parse.
export {
  Env,
  AllowUndefinedVariables,
  Operator,
  ConstExpr,
  AsAny,
  AsKind,
  AsBool,
  AsInt,
  AsInt64,
  AsFloat64,
  DisableIfOperator,
  WarnOnAny,
  Optimize,
  DisableShortCircuit,
  Patch,
  Function,
  DisableAllBuiltins,
  DisableBuiltin,
  EnableBuiltin,
  WithContext,
  Timezone,
  MaxNodes,
  Compile,
  Run,
  Eval,
} from "./expr.js";

import { Compile, Run, Eval } from "./expr.js";
import { Parse as goParse } from "./parser/parser.js";

// Parse exposes the parser's Parse (Go-style).
export { Parse } from "./parser/parser.js";

// camelCase aliases for JS ergonomics. Both styles work.
export const compile = Compile;
export const run = Run;
export const evaluate = Eval;
export const parse = goParse;

// Re-export core types and sub-packages for advanced use.
export { Program } from "./vm/program.js";
export { VM } from "./vm/vm.js";
export { Tree } from "./parser/parser.js";
export * as ast from "./ast/node.js";
export * as types from "./types/types.js";
export { GoTime, GoDuration } from "./vm/runtime/gotime.js";
