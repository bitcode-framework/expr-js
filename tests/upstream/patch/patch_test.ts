// Port of expr-lang/expr test/patch/patch_test.go + test/patch/patch_count_test.go
// Classification:
//   patch_test.go: TestPatch_length — PORTED
//   patch_count_test.go: TestPatch_Count — PORTED, TestPatchOperator_Count — FORCED_NA
//   change_ident_test.go: TestPatch_change_ident — FORCED_NA (Go bytecode + struct tags)
//   set_type/set_type_test.go: TestPatch_SetType — FORCED_NA (reflect.TypeOf)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as expr from "../../../src/expr.js";
import {
  Node,
  MemberNode,
  StringNode,
  IntegerNode,
  BuiltinNode,
  Patch,
} from "../../../src/ast/node.js";
import type { NodeRef, Visitor } from "../../../src/ast/visitor.js";

// lengthPatcher: replaces .length member access with len() builtin.
// Go: type lengthPatcher struct{}; func (p *lengthPatcher) Visit(node *ast.Node) {...}
class lengthPatcher implements Visitor {
  Visit(ref: NodeRef): void {
    const n = ref.node;
    if (n instanceof MemberNode) {
      if (n.Property instanceof StringNode && n.Property.Value === "length") {
        Patch(ref, new BuiltinNode("len", [n.Node]));
      }
    }
  }
}

// countingPatcher: counts IntegerNode visits.
// Go: type countingPatcher struct{ PatchCount int }; func (c *countingPatcher) Visit(node *ast.Node) {...}
class countingPatcher implements Visitor {
  PatchCount = 0;
  Visit(ref: NodeRef): void {
    if (ref.node instanceof IntegerNode) {
      this.PatchCount++;
    }
  }
}

// TestPatch_length — PORTED
// Go: compiles `String.length == 5` with lengthPatcher, runs with env{String: "hello"}, asserts true.
test("TestPatch_length", () => {
  const envType = { String: "string" };

  const program = expr.Compile(
    `String.length == 5`,
    expr.Env(envType),
    expr.Patch(new lengthPatcher()),
  );

  const env = { String: "hello" };
  const output = expr.Run(program, env);
  assert.equal(output, true);
});

// TestPatch_Count — PORTED
// Go: compiles `5 + 5` with countingPatcher, asserts PatchCount == 2.
test("TestPatch_Count", () => {
  const patcher = new countingPatcher();
  const envType = {};

  expr.Compile(`5 + 5`, expr.Env(envType), expr.Patch(patcher));

  assert.equal(patcher.PatchCount, 2, "Patcher run an unexpected number of times during compile");
});

// ---------- FORCED_NA TESTS (documented, not ported) ----------

// TestPatchOperator_Count (patch_count_test.go) — FORCED_NA
// Reason: uses expr.Operator("+", "_intAdd") with expr.Function("_intAdd", fn, new(func(int, int) int)).
// The Go `new(func(int, int) int)` pattern creates a typed function signature for operator overload
// matching via reflect. TS Operator() exists but the typed-signature validation is reflect-dependent.

// TestPatch_change_ident (change_ident_test.go) — FORCED_NA
// Reason: asserts against Go VM bytecode layout (OpLoadField opcode, runtime.Field{Path, Index}),
// driven by Go struct tags (`expr:"foo"`). TS has no struct tag mechanism.

// TestPatch_SetType (set_type/set_type_test.go) — FORCED_NA
// Reason: uses reflect.TypeOf((*Value)(nil)).Elem() to derive types at runtime,
// node.Type() comparison against reflect.Type, and SetType(reflect.TypeOf(0)).
// TS TypeDescriptor system replaces reflect.Type but the test's setup requires
// deriving types from Go struct definitions via reflect.

// PORTED: 2, FORCED_NA: 3 — total: 5 (matches upstream patch test files)
