// Port of expr-lang/expr test/issues/461/issue_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env, AsBool } from "../../../src/expr.js";
import { Type, stringType } from "../../../src/checker/nature/type.js";
import { Kind } from "../../../src/checker/nature/kind.js";
import { markStruct } from "../../../src/checker/nature/nature.js";

// Named string type: EnvStr is distinct from string via AssignableTo name check.
const envStrType = new Type(Kind.String, "EnvStr");

// EnvField struct: { S EnvStr; Str string }
const envFieldType = new Type(Kind.Struct, "EnvField");
envFieldType.fields = [
  { name: "S", type: envStrType, anonymous: false, index: [0] },
  { name: "Str", type: stringType, anonymous: false, index: [1] },
];

// TestIssue461 — PORTED_WITH_ADAPTER
// Uses markStruct + named Type to reproduce Go's named string type distinction.
// The checker's ComparableTo() → AssignableTo() checks this.name === t.name,
// so "string" !== "EnvStr" produces a type mismatch error.
test("TestIssue461", () => {
  const tests: Array<{
    input: string;
    env: Record<string, any>;
    want?: boolean;
    err?: string;
  }> = [
    {
      input: "Str == S",
      env: { S: "string", Str: "string" },
      err: "mismatched types string and EnvStr",
    },
    {
      input: "Str == Str",
      env: { Str: "string" },
      want: true,
    },
    {
      input: "S == S",
      env: { Str: "string" },
      want: true,
    },
    {
      input: `Str == "string"`,
      env: { Str: "string" },
      want: true,
    },
    {
      input: `S == "string"`,
      env: { Str: "string" },
      err: "mismatched types EnvStr and string",
    },
    {
      input: "EnvField.Str == EnvField.S",
      env: { EnvField: { S: "string", Str: "string" } },
      err: "mismatched types string and EnvStr",
    },
    {
      input: "EnvField.Str == EnvField.Str",
      env: { EnvField: { Str: "string" } },
      want: true,
    },
    {
      input: "EnvField.S == EnvField.S",
      env: { EnvField: { Str: "string" } },
      want: true,
    },
    {
      input: `EnvField.Str == "string"`,
      env: { EnvField: { Str: "string" } },
      want: true,
    },
    {
      input: `EnvField.S == "string"`,
      env: { EnvField: { Str: "string" } },
      err: "mismatched types EnvStr and string",
    },
  ];

  for (const tt of tests) {
    // Build typed env with markStruct. Go structs have zero-value defaults
    // for unset fields (EnvStr="" for strings, EnvField={} for structs).
    const rawEF = tt.env.EnvField ?? {};
    const envObj: Record<string, any> = {
      S: tt.env.S ?? "",
      Str: tt.env.Str ?? "",
      EnvField: {
        S: rawEF.S ?? "",
        Str: rawEF.Str ?? "",
      },
    };
    // Mark nested EnvField
    markStruct(envObj.EnvField as Record<string, any>, "EnvField", {
      S: envStrType,
      Str: stringType,
    });
    markStruct(envObj, "Env", {
      S: envStrType,
      Str: stringType,
      EnvField: envFieldType,
    });

    if (tt.err) {
      try {
        Compile(tt.input, Env(envObj), AsBool());
        assert.fail(`expected error for "${tt.input}"`);
      } catch (e) {
        assert.ok(
          (e as Error).message.includes(tt.err),
          `"${tt.input}": expected error containing "${tt.err}", got: ${(e as Error).message}`,
        );
      }
    } else {
      const program = Compile(tt.input, Env(envObj), AsBool());
      const out = Run(program, envObj);
      assert.equal(out, tt.want, `"${tt.input}"`);
    }
  }
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
