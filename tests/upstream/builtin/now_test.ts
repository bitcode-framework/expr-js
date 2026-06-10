// Deterministic test for now().Format() — covers the dynamic fixture skip.
// The original parity fixture is NOT_APPLICABLE because the expected output
// changes per run (now() returns current time at fixture generation time).
// This test validates the SAME observable behavior deterministically:
// the result must match the format pattern produced by now().Format(layout).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run } from "../../../src/expr.js";

test("now().Format pattern produces RFC3339-like output", () => {
  // Pattern matches Go layout "2006-01-02T15:04Z": YYYY-MM-DDTHH:MMZ
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/;
  const program = Compile('now().Format("2006-01-02T15:04Z")');
  const out = Run(program, {});
  assert.equal(typeof out, "string", "now().Format() must return a string");
  assert.ok(
    pattern.test(out as string),
    `now().Format("2006-01-02T15:04Z") = "${out}" does not match pattern ${pattern}`,
  );
});

test("now().Format consistency across formats", () => {
  // Verify common Go layout strings produce expected output shapes.
  const cases: Array<{ layout: string; pattern: RegExp }> = [
    { layout: "2006-01-02", pattern: /^\d{4}-\d{2}-\d{2}$/ },
    { layout: "15:04:05", pattern: /^\d{2}:\d{2}:\d{2}$/ },
    { layout: "2006-01-02 15:04:05", pattern: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/ },
  ];
  for (const tc of cases) {
    const program = Compile(`now().Format(${JSON.stringify(tc.layout)})`);
    const out = Run(program, {});
    assert.ok(
      tc.pattern.test(out as string),
      `now().Format(${tc.layout}) = "${out}" does not match ${tc.pattern}`,
    );
  }
});
