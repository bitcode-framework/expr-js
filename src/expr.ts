// Port of expr-lang/expr expr.go — public API.
import { Visitor } from "./ast/visitor.js";
import { Func } from "./builtin/function.js";
import * as checker from "./checker/checker.js";
import * as compiler from "./compiler/compiler.js";
import { Config, CreateNew } from "./conf/config.js";
import { FileError } from "./file/error.js";
import * as optimizer from "./optimizer/optimizer.js";
import * as parser from "./parser/parser.js";
import { OperatorOverloading } from "./patcher/operator_override.js";
import { WithContext } from "./patcher/with_context.js";
import { WithTimezone } from "./patcher/with_timezone.js";
import { Kind } from "./checker/nature/kind.js";
import { Type } from "./checker/nature/type.js";
import { Program } from "./vm/program.js";
import { Run as vmRun } from "./vm/vm.js";

// GoLocation marker for Timezone(). Uses the shared GoLocation from
// vm/runtime/gotime.ts so that the WithTimezone patcher and the date()/now()
// builtins recognize the same type.
import { GoLocation } from "./vm/runtime/gotime.js";

// Option for configuring config.
export type Option = (c: Config) => void;

// Env specifies expected input of env for type checks.
export function Env(env: any): Option {
  return (c: Config) => {
    c.WithEnv(env);
  };
}

// AllowUndefinedVariables allows undefined variables inside expressions.
export function AllowUndefinedVariables(): Option {
  return (c: Config) => {
    c.Strict = false;
  };
}

// Operator allows replacing a binary operator with a function.
export function Operator(operator: string, ...fn: string[]): Option {
  return (c: Config) => {
    const p = new OperatorOverloading({
      Operator: operator,
      Overloads: fn,
      Env: c.Env,
      Functions: c.Functions,
      NtCache: c.NtCache,
    });
    c.Visitors.push(p as unknown as Visitor);
  };
}

// ConstExpr defines func expression as constant.
export function ConstExpr(fn: string): Option {
  return (c: Config) => {
    c.ConstExpr(fn);
  };
}

// AsAny tells the compiler to expect any result.
export function AsAny(): Option {
  return (c: Config) => {
    c.ExpectAny = true;
  };
}

// AsKind tells the compiler to expect a kind of the result.
export function AsKind(kind: Kind): Option {
  return (c: Config) => {
    c.Expect = kind;
    c.ExpectAny = true;
  };
}

export function AsBool(): Option {
  return (c: Config) => {
    c.Expect = Kind.Bool;
    c.ExpectAny = true;
  };
}

export function AsInt(): Option {
  return (c: Config) => {
    c.Expect = Kind.Int;
    c.ExpectAny = true;
  };
}

export function AsInt64(): Option {
  return (c: Config) => {
    c.Expect = Kind.Int64;
    c.ExpectAny = true;
  };
}

export function AsFloat64(): Option {
  return (c: Config) => {
    c.Expect = Kind.Float64;
    c.ExpectAny = true;
  };
}

// DisableIfOperator disables the `if ... else ...` operator syntax.
export function DisableIfOperator(): Option {
  return (c: Config) => {
    c.DisableIfOperator = true;
  };
}

// WarnOnAny tells the compiler to warn if expression returns any type.
export function WarnOnAny(): Option {
  return (c: Config) => {
    if (c.Expect === Kind.Invalid) {
      throw new Error(
        "WarnOnAny() works only with combination with AsInt(), AsBool(), etc. options",
      );
    }
    c.ExpectAny = false;
  };
}

// Optimize turns optimizations on or off.
export function Optimize(b: boolean): Option {
  return (c: Config) => {
    c.Optimize = b;
  };
}

// DisableShortCircuit turns short circuit off.
export function DisableShortCircuit(): Option {
  return (c: Config) => {
    c.ShortCircuit = false;
  };
}

// Patch adds a visitor applied before compiling AST to bytecode.
export function Patch(visitor: Visitor): Option {
  return (c: Config) => {
    c.Visitors.push(visitor);
  };
}

// Function adds a function available in expressions.
export function Function(
  name: string,
  fn: (...params: any[]) => any,
  ...types: Type[]
): Option {
  return (c: Config) => {
    c.Functions.set(
      name,
      new Func({ Name: name, Func: fn, Types: types }),
    );
  };
}

// DisableAllBuiltins disables all builtins.
export function DisableAllBuiltins(): Option {
  return (c: Config) => {
    for (const name of c.Builtins.keys()) {
      c.Disabled.set(name, true);
    }
  };
}

// DisableBuiltin disables a builtin function.
export function DisableBuiltin(name: string): Option {
  return (c: Config) => {
    c.Disabled.set(name, true);
  };
}

// EnableBuiltin enables a builtin function.
export function EnableBuiltin(name: string): Option {
  return (c: Config) => {
    c.Disabled.delete(name);
  };
}

// WithContext passes context to function calls with a context argument.
export function WithContextOption(name: string): Option {
  return (c: Config) => {
    c.Visitors.push(
      new WithContext({
        Name: name,
        Functions: c.Functions,
        Env: c.Env,
        NtCache: c.NtCache,
      }) as unknown as Visitor,
    );
  };
}
export { WithContextOption as WithContext };

// Timezone sets default timezone for date() and now() builtin functions.
export function Timezone(name: string): Option {
  const tz = new GoLocation(name);
  return Patch(new WithTimezone({ Location: tz }) as unknown as Visitor);
}

// MaxNodes sets the maximum number of nodes allowed in the expression.
export function MaxNodes(n: number): Option {
  return (c: Config) => {
    c.MaxNodes = n;
  };
}

// Compile parses and compiles a given input expression to a bytecode program.
export function Compile(input: string, ...ops: Option[]): Program {
  const config = CreateNew();
  for (const op of ops) {
    op(config);
  }
  for (const name of config.Disabled.keys()) {
    config.Builtins.delete(name);
  }
  config.Check();

  const tree = checker.ParseCheck(input, config);

  if (config.Optimize) {
    try {
      const ref = { node: tree.Node };
      optimizer.Optimize(ref, config);
      tree.Node = ref.node;
    } catch (err) {
      if (err instanceof FileError) {
        throw err.Bind(tree.Source);
      }
      throw err;
    }
  }

  return compiler.Compile(tree, config);
}

// Run evaluates a given bytecode program.
export function Run(program: Program, env: any): any {
  return vmRun(program, env);
}

// Eval parses, compiles and runs a given input.
export function Eval(input: string, env: any): any {
  if (typeof env === "function") {
    throw new Error(
      "misused expr.Eval: second argument (env) should be passed without expr.Env",
    );
  }
  const tree = parser.Parse(input);
  const program = compiler.Compile(tree, null);
  return Run(program, env);
}
