# MAINTENANCE_PARITY_AUDIT.md

Date: 2026-06-10
Scope: `packages/expr-js` maintenance automation against `references/expr`.

## Source-level inputs audited

- `references/expr/vm/func_types[generated].go`
- `references/expr/patcher/value/value.go`
- `references/expr/builtin/builtin.go`
- Go `reflect.VisibleFields` scan emitted by `scripts/sync-go.mjs`
- Go `reflect.Type` scan emitted by `scripts/sync-go.mjs`
- Go `time.Parse` / `time.Format` fixture scan emitted by `scripts/sync-go.mjs`
- Existing reports listed by the task request were read before coding; their claims were treated as untrusted and rechecked against source files above.

## Implemented automation

| Area | Source | Output | Classification | Evidence |
|---|---|---|---|---|
| `FUNC_TYPES` | `references/expr/vm/func_types[generated].go` | `src/checker/func_types.generated.ts` | `FULLY_AUTOMATED` | `sync:go` extracts 90 generated Go signatures and emits TS descriptors. |
| `FUNC_TYPES_ARITY` | generated from `FUNC_TYPES` | `src/checker/func_types.generated.ts` | `FULLY_AUTOMATED` | `FUNC_TYPES.map((entry) => entry.in.length)`. |
| `VALUER_METHODS` | `references/expr/patcher/value/value.go` | `src/patcher/value/valuer_methods.generated.ts` | `FULLY_AUTOMATED` | Extracted from `supportedInterfaces` order and interface declarations; preserves Go type-switch priority. |
| Visible fields metadata | Go `reflect.VisibleFields` scan | `parity/metadata/visible_fields.generated.json` | `MOSTLY_AUTOMATED` | Fixture scan proves field indexes/pkgPath/exported flags; consuming arbitrary app structs remains adapter-owned. |
| Standard type descriptors | Go reflection scan | `src/checker/nature/std_types.generated.ts` | `MOSTLY_AUTOMATED` | Captures known std descriptors (`time.Time`, `time.Duration`, slices/maps/funcs); descriptor runtime remains manual. |
| Named type metadata | Go reflection scan | `parity/metadata/named_types.generated.json` | `MOSTLY_AUTOMATED` | Captures named type string/pkg/kind/comparable data; branded JS wrapper remains manual. |
| Builtin registry snapshot | `references/expr/builtin/builtin.go` | `parity/metadata/builtins.generated.json` | `FULLY_AUTOMATED` for registry drift | Captures 64 builtin names/order plus per-entry predicate/fast flags. Validation function bodies still require manual porting. |
| Time layout fixture matrix | Go `time.Parse` / `time.Format` | `parity/fixtures/time_layout.generated.json` | `FULLY_AUTOMATED` fixture | Emits deterministic parse/format rows from Go runtime. |

## `npm run sync:go`

Implemented as `scripts/sync-go.mjs`.

It regenerates:

- generated checker func type table
- generated valuer method table
- generated reflection metadata
- generated builtin registry snapshot
- generated time layout fixtures
- generated `GENERATED_DIVERGENCES.md`

It also performs the mechanical source scans needed for drift detection. Existing parity fixture generation (`parity:gen`) remains separate because it evaluates expression corpora and has a different output contract.

## `npm run parity:verify`

Implemented as `scripts/verify-parity.mjs`.

Verification behavior:

1. Reads all generated artifacts.
2. Runs `scripts/sync-go.mjs`.
3. Re-reads generated artifacts.
4. Fails if any generated artifact changed.

Tracked artifacts:

- `src/checker/func_types.generated.ts`
- `src/patcher/value/valuer_methods.generated.ts`
- `src/checker/nature/std_types.generated.ts`
- `parity/metadata/visible_fields.generated.json`
- `parity/metadata/named_types.generated.json`
- `parity/metadata/builtins.generated.json`
- `parity/fixtures/time_layout.generated.json`
- `GENERATED_DIVERGENCES.md`

## Mechanical upgrade audit

Requested simulation: `references/expr v1.17.8 -> latest available in repository`.

Actual repository state:

- The workspace only contains one local upstream checkout at `references/expr`.
- No second version snapshot is present in this repository for a real file-to-file upgrade diff.
- Therefore no source files were mutated to simulate a fake upgrade.

Measured automation behavior for a future upstream change:

| Change type | Auto-updated by `sync:go` | Manual follow-up |
|---|---:|---|
| New/changed generated VM func signature in `vm/func_types[generated].go` | Yes | Only if TS `Kind`/descriptor model lacks a newly introduced Go type. |
| New/changed valuer interface or supported order in `patcher/value/value.go` | Yes | Runtime adapter remains duck-typed; unusual method return semantics need tests. |
| Builtin added/removed/reordered in `builtin/builtin.go` | Snapshot yes | Function implementation and validation body still manual. |
| Reflect-visible field behavior for known fixtures | Yes | Real user structs still require explicit TS metadata or `markStruct` adapters. |
| New std/named types in scan list | Yes if added to generator scan | Deciding which types matter is manual. |
| Time layout parse/format expected outputs | Yes | Parser/formatter implementation changes are manual. |
| Checker/runtime/compiler semantic changes | No | Manual source port plus tests required. |

## Honest final classification

### `FULLY_AUTOMATED`

- `FUNC_TYPES`
- `FUNC_TYPES_ARITY`
- `VALUER_METHODS`
- builtin registry drift snapshot
- deterministic time layout fixture rows

Evidence: all are generated directly from Go source/runtime and checked by `npm run parity:verify`.

### `MOSTLY_AUTOMATED`

- visible field metadata for known scan fixtures
- standard type descriptor metadata for known scan set
- named type metadata for known scan set

Evidence: Go reflection produces the metadata, but deciding the JS adapter surface and expanding the scan corpus remains manual.

### `PARTIALLY_AUTOMATED`

- checker reflection parity
- builtin validation parity
- bytecode typed-call parity
- time runtime implementation parity

Evidence: generated metadata now feeds or snapshots these areas, but behavior remains implemented in TypeScript source and must be ported/reviewed manually when Go logic changes.

### `MANUAL_ONLY`

- arbitrary Go reflection semantics that depend on runtime `reflect.Type` identity, pointers, typed nil, method sets from real Go values, or unexported package visibility outside generated fixture scans
- Go runtime implementation changes inside VM/compiler/checker/optimizer bodies
- JavaScript/TypeScript adapter design for branded/named values, pointers, and method receivers

Evidence: these require semantic translation from Go runtime/reflection into explicit JS descriptors/adapters; no generated table can safely synthesize the implementation.

## Verification evidence

Commands run from `packages/expr-js`:

- `npm run sync:go` — generated 90 func types, 19 valuer methods, 64 builtin entries, 6 time fixture rows.
- `npm run typecheck` — passed, `tsc -p tsconfig.json --noEmit`.
- `npx tsx --test 'tests/**/*.test.ts' 'tests/**/*.ts'` — passed: 755 tests, 754 pass, 0 fail, 1 skipped.
- `npm run build` — passed: ESM, CJS, and declaration builds.
- `npm run parity:verify` — passed: 8 generated artifacts stable after regeneration.

## Verdict

Maintenance parity is now `MOSTLY_AUTOMATED` for source-derived metadata and fixture drift. It is not `FULLY_AUTOMATED` overall because checker/runtime/compiler semantic changes still require manual TypeScript porting and adapter review.
