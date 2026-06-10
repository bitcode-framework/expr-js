# LAST_SKIP_AUDIT.md

Audit of the final skipped fixture: `now().Format("2006-01-02T15:04Z")`.

## Files checked

- `parity/fixtures/builtin_mock.json`
- `tests/go-parity/builtin/builtin.parity.test.ts`
- `tests/upstream/builtin/now_test.ts`
- `src/builtin/builtin.ts`
- `src/vm/runtime/gotime.ts`

## Fixture under audit

Expression:

```expr
now().Format("2006-01-02T15:04Z")
```

The parity runner reports it as the single skipped test:

```text
# Subtest: [builtin][N/A] now().Format("2006-01-02T15:04Z") — Dynamic: now() returns current time, expected value changes per run # SKIP
# tests 755
# pass 754
# fail 0
# skipped 1
```

## Questions

### 1. Is it truly only a nondeterministic fixture problem?

Yes. The expression calls `now()`, so the expected value captured by the Go fixture generator is a wall-clock value at fixture-generation time. Replaying that same fixture later in TS necessarily calls `now()` at a different instant.

This is not a stable equality assertion unless the fixture harness supports fixed clock injection, regex expected values, or dynamic expected functions.

### 2. Is engine behavior verified with deterministic clock injection or equivalent deterministic test?

Equivalent deterministic tests exist in `tests/upstream/builtin/now_test.ts`:

- `now().Format("2006-01-02T15:04Z")` must return a string matching `YYYY-MM-DDTHH:MMZ`.
- Additional layouts are checked for output shape:
  - `2006-01-02`
  - `15:04:05`
  - `2006-01-02 15:04:05`

This is not clock injection, but it is a deterministic assertion of the same observable formatting behavior that the dynamic fixture can safely verify without depending on a fixed instant.

### 3. Can the skip be removed if fixture generation uses fixed clock?

Yes. The skip can be removed if one of these harness changes is made:

1. Add a fixed clock option to the expr-js builtin runtime and the Go fixture generator.
2. Replace the fixture expected value with a regex/dynamic predicate for time-dependent outputs.
3. Generate the fixture and replay it in the same process with a shared frozen clock.

Those are test-harness changes, not expression-engine changes.

### 4. Is there an engine behavior gap or only harness limitation?

Only a harness limitation is proven by current evidence.

Runtime behavior is implemented in:

- `src/builtin/builtin.ts`: `now` builtin creates the current time value.
- `src/vm/runtime/gotime.ts`: `GoTime.Format()` implements Go layout formatting.

The surrounding builtin parity fixtures also pass deterministic time/date cases:

- `date("2006-01-02T15:04:05Z")`
- `date("2006.01.02", "2006.01.02")`
- timezone-aware `date(...).Format("2006-01-02")`
- `timezone("UTC").String()`
- `timezone("Europe/Moscow").String()`

## Classification

`TEST_GAP`

Reason: the skipped item is a nondeterministic fixture/harness gap. The engine behavior has deterministic coverage and no source-proven runtime gap was found.

## Verification evidence

Fresh baseline command:

```powershell
cd packages/expr-js
npx tsx --test 'tests/**/*.test.ts' 'tests/**/*.ts'
```

Observed summary:

```text
# tests 755
# pass 754
# fail 0
# skipped 1
```

The one skipped test is the audited `now().Format("2006-01-02T15:04Z")` dynamic fixture.
