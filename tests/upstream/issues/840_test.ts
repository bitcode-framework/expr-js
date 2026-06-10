// Port of expr-lang/expr test/issues/840/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";

// type Env struct { *EmbeddedEnv; Func func() int }
// type EmbeddedEnv struct { Int int }
// Go promotes EmbeddedEnv.Int onto Env via struct embedding.

// TestEnvFieldMethods — PORTED_WITH_ADAPTER
// JS has no struct embedding; the promoted `Int` field and the `Func` field are
// modeled directly on a flat JS object env.
test("TestEnvFieldMethods", () => {
  // PORTED_WITH_ADAPTER
  const env = {
    Func: (): number => 40,
    Int: 2,
  };
  const program = Compile("Func() + Int", Env(env));
  const out = Run(program, env);
  assert.equal(Number(out), 42);
});

// PORTED: 0, PORTED_WITH_ADAPTER: 1, FORCED_NA: 0
