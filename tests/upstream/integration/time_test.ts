// Port of expr-lang/expr test/time/time_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Compile, Run, Env } from "../../../src/expr.js";
import { GoTime, GoDuration } from "../../../src/vm/runtime/gotime.js";
import { mockEnv } from "../../go-parity/mock-env.js";

// TestTime — ported from Go's test/time/time_test.go TestTime.
// Tests time arithmetic and comparison with env-provided GoTime/GoDuration values.
test("TestTime", () => {
  const env = mockEnv();
  const tests = [
    { expr: "Time.Sub(Time).String() == '0s'", want: true },
    { expr: "Time < Time + Duration", want: false },    // Duration is 0, so Time < Time = false
    { expr: "Time + Duration > Time", want: false },     // Duration is 0
    { expr: "Time == Time", want: true },
    { expr: "Time >= Time", want: true },
    { expr: "Time <= Time", want: true },
    { expr: "Time != Time", want: false },
    { expr: "TimePlusDay - Time >= duration('24h')", want: true },
    { expr: "Time == Time + Duration", want: true },     // Duration is 0
  ];
  for (const tc of tests) {
    const program = Compile(tc.expr, Env(env));
    const output = Run(program, env);
    assert.equal(output, tc.want, `${tc.expr} should be ${tc.want}`);
  }
});

// TestTime_duration — PORTED
test("TestTime_duration", () => {
  const env = {
    foo: new GoTime(Date.UTC(2000, 0, 1, 0, 0, 0, 0)),
  };
  const program = Compile(
    'now() - duration("1h") < now() && foo + duration("24h") < now()',
    Env(env),
  );
  const output = Run(program, env);
  assert.equal(output, true);
});

// TestTime_date — PORTED (ISO case)
test("TestTime_date", () => {
  const program = Compile("date('2017-10-23')");
  const output = Run(program, null);
  assert.ok(output instanceof GoTime, "date() should return a GoTime");
  assert.equal(Number(output.Year()), 2017);
});

// TestTime_date_layout — ported using Go layout parser.
test("TestTime_date_layout", () => {
  const program = Compile('date("24.11.1987 20:30", "02.01.2006 15:04", "Europe/Zurich")');
  const output = Run(program, null);
  assert.ok(output instanceof GoTime, "date() should return a GoTime");
  assert.equal(Number(output.Year()), 1987);
  assert.equal(Number(output.Month()), 11);
  assert.equal(Number(output.Day()), 24);
});

// PORTED: 4, FORCED_NA: 0
