// Port of expr-lang/expr test/issues/888/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";

// TestIssue888 — PORTED_WITH_ADAPTER
// Go: Container.IncludesAny("nope", "nope again", "bar") where Container is a
// struct with a variadic method IncludesAny(s ...string) bool.
// JS adapter: object method with rest params.
test("TestIssue888", () => {
  const env: Record<string, any> = {
    Container: {
      ID: "id",
      List: ["foo", "bar", "baz"],
      IncludesAny(...s: string[]): boolean {
        for (const l of this.List) {
          for (const v of s) {
            if (v === l) return true;
          }
        }
        return false;
      },
    },
  };

  const code = `Container.IncludesAny("nope", "nope again", "bar")`;
  const program = Compile(code, Env(env));
  const out = Run(program, env);
  assert.equal(out, true);
});

// PORTED: 0, PORTED_WITH_ADAPTER: 1, FORCED_DIVERGENCE: 0
