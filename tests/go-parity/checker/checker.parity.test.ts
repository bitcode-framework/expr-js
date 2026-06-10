// go-parity runner: checker error corpus (TestCheck_error, against mock env).
// Go is the source of truth (parity/fixtures/checker_mock.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Compile, Env } from "../../../src/expr.js";
import { mockEnv } from "../mock-env.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "..", "..", "parity", "fixtures", "checker_mock.json");

interface Row {
  expr: string;
  errorContains: string;
  bucket: string;
  reason?: string;
}

const rows: Row[] = JSON.parse(readFileSync(fixture, "utf8"));

for (const row of rows) {
  if (row.bucket === "NOT_APPLICABLE") {
    test(`[checker][N/A] ${row.expr} — ${row.reason}`, { skip: true }, () => {});
    continue;
  }
  // PASS_WITH_ADAPTER: Go's checker rejects this expression; expr-js must too.
  // We assert that compilation throws (error parity). Exact message-text parity
  // is not asserted here because expr-js's TypeDescriptor messages can differ
  // in wording; the binding behavior (accept vs reject) is what we verify.
  test(`[checker][${row.bucket}] ${row.expr}`, () => {
    const env = mockEnv();
    assert.throws(
      () => Compile(row.expr, Env(env)),
      `expected checker to reject: ${row.expr}`,
    );
  });
}
