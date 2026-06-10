// Port of expr-lang/expr patcher/with_timezone_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Timezone } from "../../../src/expr.js";
import { GoTime } from "../../../src/vm/runtime/gotime.js";

// TestWithTimezone_date — PORTED
// Go: date("2024-05-07 23:00:00") with Timezone("Europe/Zurich") → RFC3339 = "2024-05-07T23:00:00+02:00"
// TS: same, using GoTime.Format("RFC3339") with Intl.DateTimeFormat for offset computation.
test("TestWithTimezone_date", () => {
  const program = Compile(`date("2024-05-07 23:00:00")`, Timezone("Europe/Zurich"));
  const out = Run(program, null);
  assert.ok(out instanceof GoTime, `expected GoTime, got ${typeof out}`);
  const formatted = (out as GoTime).Format("RFC3339");
  assert.equal(formatted, "2024-05-07T23:00:00+02:00");
});

// TestWithTimezone_now — PORTED
// Go: now() with Timezone("Asia/Kamchatka") → Location().String() == "Asia/Kamchatka"
// TS: same, using GoTime.Location().String().
test("TestWithTimezone_now", () => {
  const program = Compile(`now()`, Timezone("Asia/Kamchatka"));
  const out = Run(program, null);
  assert.ok(out instanceof GoTime, `expected GoTime, got ${typeof out}`);
  assert.equal((out as GoTime).Location().String(), "Asia/Kamchatka");
});

// PORTED: 2, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
void Compile; void Run; void Timezone; void GoTime;
