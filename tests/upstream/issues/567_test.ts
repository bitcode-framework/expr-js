// Port of expr-lang/expr test/issues/567/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile } from "../../../src/expr.js";

// TestIssue567 — PORTED
test("TestIssue567", () => {
  // PORTED
  const program = Compile("concat(1..2, 3..4)");
  const output = program.Disassemble();

  // Check if "concat" is mentioned in the output
  assert.ok(output.includes("concat"), "expected 'concat' in disassembly output");

  // It should appear as a pushed constant
  assert.ok(output.includes("OpPush\t<4>\tconcat"), "expected 'OpPush <4> concat' in disassembly output");
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
