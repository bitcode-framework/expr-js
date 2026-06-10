// Port of expr-lang/expr test/issues/730/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Eval, Env } from "../../../src/expr.js";
import { Type } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";
import { markStruct } from "../../../src/checker/nature/nature.js";
import { brand } from "../../../src/vm/runtime/branded.js";

// type ModeEnum int; const ModeEnumA ModeEnum = 1
// type Env struct { Mode *ModeEnum }

// TestIssue730 — PORTED_WITH_ADAPTER
// Go: int(Mode) == 1 where Mode is *ModeEnum (pointer to named int).
// JS: no pointers/named types. Adapter: Mode is a plain number.
// int(1) → BigInt(1) = 1n; OpInt 1 → 1n; 1n == 1n → true.
test("TestIssue730", () => {
  const env: Record<string, any> = { Mode: 1 };
  const program = Compile(`int(Mode) == 1`, Env(env));
  const out = Run(program, env);
  assert.equal(out, true);
});

// TestIssue730_warn_about_different_types — PORTED_WITH_ADAPTER
// Go: Mode == 1 with Env{} struct where Mode is *ModeEnum (named int).
// Checker detects mismatched types ModeEnum and int via named type distinction.
// TS adapter: markStruct with Mode field typed as new Type(Kind.Int, "ModeEnum").
test("TestIssue730_warn_about_different_types", () => {
  const modeEnumType = new Type(Kind.Int, "ModeEnum");
  const env: any = { Mode: 1n };
  markStruct(env, "Env", { Mode: modeEnumType });
  try {
    Compile("Mode == 1", Env(env));
    assert.fail("expected error for Mode == 1");
  } catch (e) {
    assert.ok(
      (e as Error).message.includes("mismatched types ModeEnum and int"),
      `expected mismatched types error, got: ${(e as Error).message}`,
    );
  }
});

// TestIssue730_eval — PORTED_WITH_ADAPTER
// Go: Mode == 1 with Mode: &tmp (ModeEnum pointer). Eval compares ModeEnum(1)
// with int(1) — Go returns false because named types are distinct.
// JS adapter: use Branded wrapper to carry the named type through runtime.
// Equal detects brand mismatch and returns false.
test("TestIssue730_eval", () => {
  const env: Record<string, any> = {
    Mode: brand(1n, "ModeEnum"),
  };
  const out = Eval("Mode == 1", env);
  assert.equal(out, false, "ModeEnum(1) == int(1) should be false (named type distinction)");
});

// PORTED: 1, PORTED_WITH_ADAPTER: 2, FORCED_DIVERGENCE: 0
void Compile; void Run; void Eval; void Env;
