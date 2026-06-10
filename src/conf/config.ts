// Port of expr-lang/expr conf/config.go
import type { Visitor } from "../ast/visitor.js";
import { Func } from "../builtin/function.js";
import { Nature, Cache } from "../checker/nature/nature.js";
import { Kind } from "../checker/nature/kind.js";
import { Builtins } from "../builtin/builtin.js";
import { EnvWithCache } from "./env.js";

// Re-export so existing importers of conf get Env/EnvWithCache (source parity
// with Go's conf package, where env.go and config.go are siblings).
export { Env, EnvWithCache } from "./env.js";

// DefaultMemoryBudget: default max allowed memory usage by the VM.
export const DefaultMemoryBudget = 1e6;
// DefaultMaxNodes: default max allowed AST nodes by the compiler.
export const DefaultMaxNodes = 1e4;

export type FunctionsTable = Map<string, Func>;

export class Config {
  EnvObject: any;
  Env: Nature;
  Expect: Kind;
  ExpectAny: boolean;
  Optimize: boolean;
  Strict: boolean;
  ShortCircuit: boolean;
  Profile: boolean;
  MaxNodes: number;
  ConstFns: Map<string, any>;
  Visitors: Visitor[];
  Functions: FunctionsTable;
  Builtins: FunctionsTable;
  Disabled: Map<string, boolean>;
  NtCache: Cache;
  DisableIfOperator: boolean;

  constructor() {
    this.EnvObject = null;
    this.Env = new Nature();
    this.Expect = Kind.Invalid;
    this.ExpectAny = false;
    this.Optimize = true;
    this.Strict = false;
    this.ShortCircuit = true;
    this.Profile = false;
    this.MaxNodes = DefaultMaxNodes;
    this.ConstFns = new Map();
    this.Visitors = [];
    this.Functions = new Map();
    this.Builtins = new Map();
    this.Disabled = new Map();
    this.NtCache = new Cache();
    this.DisableIfOperator = false;
  }

  WithEnv(env: any): void {
    this.EnvObject = env;
    this.Env = EnvWithCache(this.NtCache, env);
    this.Strict = this.Env.Strict;
  }

  ConstExpr(name: string): void {
    if (this.EnvObject === null) {
      throw new Error("no environment is specified for ConstExpr()");
    }
    const fn = fetchEnv(this.EnvObject, name);
    if (typeof fn !== "function") {
      throw new Error(`const expression "${name}" must be a function`);
    }
    this.ConstFns.set(name, fn);
  }

  Check(): void {
    for (const v of this.Visitors) {
      const c = v as unknown as { Check?: () => void };
      if (typeof c.Check === "function") {
        c.Check();
      }
    }
  }

  IsOverridden(name: string): boolean {
    if (this.Functions.has(name)) {
      return true;
    }
    const [, ok] = this.Env.Get(this.NtCache, name);
    if (ok) {
      return true;
    }
    return false;
  }
}

export function CreateNew(): Config {
  const c = new Config();
  c.Optimize = true;
  c.ShortCircuit = true;
  c.MaxNodes = DefaultMaxNodes;
  for (const f of Builtins) {
    c.Builtins.set(f.Name, f);
  }
  return c;
}

export function New(env: any): Config {
  const c = CreateNew();
  c.WithEnv(env);
  return c;
}

function fetchEnv(env: any, name: string): any {
  if (env instanceof Map) return env.get(name);
  return env?.[name];
}
