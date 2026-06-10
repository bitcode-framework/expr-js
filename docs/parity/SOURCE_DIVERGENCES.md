# SOURCE_DIVERGENCES.md — Level 2: Source Parity

Goal: a maintainer can `diff` `references/expr/foo/bar.go` against
`packages/expr-js/src/foo/bar.ts` with minimal friction.

Rules enforced: no file split, no rename of function/helper/variable, no
TS-style refactor, no new helper, UNLESS impossible. Every exception below has a
technical reason.

## File splits (the ONLY two)

### 1. checker/nature/nature.go → nature.ts + type.ts + kind.ts
- **Why impossible to keep as one file:** nature.go embeds `reflect.Type` and
  `reflect.Kind` directly. TypeScript has no `reflect` package. The replacement
  `Type` descriptor and `Kind` enum are substantial standalone constructs that
  Go gets for free from the stdlib `reflect` package — they are not expr source.
- **What stays 1:1:** every `Nature` method keeps its Go name + control flow in
  nature.ts. Only the reflect-replacement primitives live in type.ts / kind.ts.
- **Diff impact:** nature.go ↔ nature.ts diffs cleanly; type.ts/kind.ts have no
  Go counterpart (they replace stdlib `reflect`).

### 2. vm/runtime/runtime.go → runtime.ts + gotime.ts
- **Why:** runtime.go uses Go stdlib `time.Time`/`time.Duration` inline. JS has
  no `time` package; GoTime/GoDuration are the stdlib replacement, extracted so
  runtime.ts stays a clean mirror of runtime.go.
- **What stays 1:1:** Fetch/In/Slice/ToInt/ToFloat64/etc. keep Go names.

## Forced renames (TypeScript reserved words / globals)

Names kept identical to Go wherever legal. Forced exceptions (still the closest
legal spelling, documented in-file):

| Go name | TS name | Reason |
|---|---|---|
| `unescape` | `unescape` (lint-shadow tolerated) | kept; `tsc` accepts |
| `Function` (option) | `Function` (lint-shadow tolerated) | kept; matches Go |
| `Map`/`Array`/`String` (types pkg) | kept (lint-shadow tolerated) | kept; matches Go |
| `error` (method) | `Error`/`error` per context | Go method names preserved |

No semantic rename was performed. The above are lint advisories only; `tsc`
exits 0. No variable was renamed for style.

## Known residual source-parity gaps (HONEST)

These are areas where the CURRENT TS is NOT yet a line-level mirror and are
tracked as open work toward Level 2:

1. **builtin/builtin.ts** uses TS object/closure style for the Builtins table;
   Go uses struct literals. Functionally equivalent, but not line-diffable.
   Reason: Go `*Function{Fast:..., Validate:...}` struct literals vs TS object
   literals differ syntactically; acceptable but noted.
2. **checker.ts / compiler.ts** preserve visitor method names and order, but
   some helper bodies are rewritten where Go uses reflect. Diff is
   method-aligned, not always line-aligned.
3. **vm helpers** are GENERATED — see GENERATED_DIVERGENCES.md.

## Status

- 2 SPLITs, both FORCED (stdlib reflect / time replacement).
- 0 deliberate function/variable renames.
- Residual line-level gaps documented above; method/file structure is aligned.
