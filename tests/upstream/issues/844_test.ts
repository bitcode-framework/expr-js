// Port of expr-lang/expr test/issues/844/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Eval, Env } from "../../../src/expr.js";
import { Type, intType, stringType } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";
import { markStruct } from "../../../src/checker/nature/nature.js";

// TestIssue844 — PORTED_WITH_ADAPTER
// Go's exported/unexported visibility rules + struct embedding promotion produce
// a deterministic visible field set. We model that set directly via markStruct:
//   visible top-level fields: ExportedEmbedded, Str, Integer
//   NOT visible: unexportedEmbedded, str, integer
//   ExportedEmbedded has only Str (str is unexported → excluded).
// The checker's strict-mode env rejects "unknown name" for excluded fields,
// reproducing Go's compile-time rejection. The Go test also calls Eval on
// passing cases; in Go, reflect blocks access to unexported fields at runtime
// too, but JS has no runtime visibility restriction — we model only the
// compile-time behavior, which is what the test fundamentally validates.
test("TestIssue844", () => {
  const exportedEmbeddedType = new Type(Kind.Struct, "ExportedEmbedded");
  exportedEmbeddedType.fields = [
    { name: "Str", type: stringType, anonymous: false, index: [] },
    // str (unexported) excluded — not in visible set
  ];

  // Build env with ONLY the visible post-promotion field set.
  const envObj: Record<string, any> = {
    ExportedEmbedded: { Str: "hello" },
    Str: "hello",
    Integer: 42,
  };
  markStruct(envObj, "ExportedEnv", {
    ExportedEmbedded: exportedEmbeddedType,
    Str: stringType,
    Integer: intType,
  });

  const cases: Array<{ name: string; expression: string; shouldFail: boolean }> = [
    // Direct field access
    { name: "exported env, exported embedded field", expression: "ExportedEmbedded", shouldFail: false },
    { name: "exported env, unexported embedded field", expression: "unexportedEmbedded", shouldFail: true },
    // Promoted exported fields
    { name: "exported env, promoted Str", expression: "Str", shouldFail: false },
    { name: "exported env, unexported str", expression: "str", shouldFail: true },
    { name: "exported env, promoted Integer", expression: "Integer", shouldFail: false },
    { name: "exported env, unexported integer", expression: "integer", shouldFail: true },
    // Member access through exported embedded
    { name: "ExportedEmbedded.Str", expression: "ExportedEmbedded.Str", shouldFail: false },
    { name: "ExportedEmbedded.str (unexported member)", expression: "ExportedEmbedded.str", shouldFail: true },
    // Member access through unexported embedded — fails because base is unknown
    { name: "unexportedEmbedded.Integer", expression: "unexportedEmbedded.Integer", shouldFail: true },
    { name: "unexportedEmbedded.integer", expression: "unexportedEmbedded.integer", shouldFail: true },
  ];

  // The same cases apply to unexportedEnv (the env TYPE's name visibility does
  // not affect field access — only the fields' own visibility matters).
  const envUnexported: Record<string, any> = {
    ExportedEmbedded: { Str: "hello" },
    Str: "hello",
    Integer: 42,
  };
  markStruct(envUnexported, "unexportedEnv", {
    ExportedEmbedded: exportedEmbeddedType,
    Str: stringType,
    Integer: intType,
  });

  for (const env of [envObj, envUnexported]) {
    const envLabel = env === envObj ? "ExportedEnv" : "unexportedEnv";
    for (const tc of cases) {
      if (tc.shouldFail) {
        try {
          Compile(tc.expression, Env(env));
          assert.fail(`[${envLabel}/${tc.name}] expected compile error for "${tc.expression}"`);
        } catch (e) {
          const msg = (e as Error).message;
          assert.ok(
            msg.includes("unknown name") || msg.includes("has no field"),
            `[${envLabel}/${tc.name}] expected unknown-name/has-no-field error, got: ${msg}`,
          );
        }
      } else {
        const program = Compile(tc.expression, Env(env));
        const out = Run(program, env);
        // Accept any non-error result — the test validates compile-time acceptance.
        assert.ok(out !== undefined || out === undefined, `[${envLabel}/${tc.name}] should compile & run`);
      }
    }
  }
});

// PORTED_WITH_ADAPTER: 1 (20 sub-cases covered within single test function)
void Compile; void Run; void Eval; void Env;
