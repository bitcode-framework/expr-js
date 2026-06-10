# FINAL_PARITY_VERDICT.md

Final cautious verdict for `expr-js` as a TypeScript port of `expr-lang/expr` v1.17.8.

## Evidence files

This verdict is based on current code plus these audit documents:

- `PARITY.md`
- `SOURCE_MAPPING.md`
- `SOURCE_DIVERGENCES.md`
- `GENERATED_DIVERGENCES.md`
- `TEST_MAPPING.md`
- `NON_CORE_PARITY.md`
- `CHECKER_PARITY.md`
- `NUMERIC_PARITY.md`
- `BYTECODE_PARITY.md`
- `MAXIMUM_PARITY_REPORT.md`
- `REMAINING_11_AUDIT.md`
- `GENERATOR_AUDIT.md`
- `MAINTENANCE_AUDIT.md`
- `SOURCE_MIRROR_FINAL.md`
- `LAST_SKIP_AUDIT.md`

## Fresh verification evidence

Commands run from `packages/expr-js`:

```powershell
npx tsc --noEmit
npx tsx --test 'tests/**/*.test.ts' 'tests/**/*.ts'
npm run build
```

Observed results:

```text
npx tsc --noEmit
# 0 errors / no output

npx tsx --test 'tests/**/*.test.ts' 'tests/**/*.ts'
# tests 755
# pass 754
# fail 0
# skipped 1

npm run build
# build:esm OK
# build:cjs OK, CJS rename complete
# build:types OK
```

The single skipped test is classified in `LAST_SKIP_AUDIT.md` as `TEST_GAP`: dynamic `now()` fixture nondeterminism, not a proven engine gap.

## Required questions

### 1. Is functional parity achieved?

Supported by audit evidence with one test-harness caveat.

Evidence:

- Full test command passes with 754 passing tests, 0 failures, 1 skipped dynamic fixture.
- `REMAINING_11_AUDIT.md` shows 10 of the prior 11 skips were implemented/reclassified with tests, leaving only `now().Format(...)` nondeterminism.
- `LAST_SKIP_AUDIT.md` classifies the remaining skip as `TEST_GAP`, with deterministic behavior coverage in `tests/upstream/builtin/now_test.ts`.

Caveat: functional parity is supported for audited and fixture-covered behavior; any unexercised upstream behavior still requires normal source-diff review on upgrade.

### 2. Is semantic parity achieved?

Supported by audit evidence for the language semantics currently audited.

Evidence:

- Numeric behavior is documented in `NUMERIC_PARITY.md` and exercised by parity tests.
- Go time/date/layout behavior is exercised by builtin parity tests and `now_test.ts` shape tests.
- Named type equality, pointer auto-deref adapter cases, exported/unexported visibility adapter cases, and typed/fast dispatch cases are covered in `REMAINING_11_AUDIT.md` and upstream tests.

Caveat: semantic parity relies on explicit TypeDescriptor/adapter metadata where Go would use reflection.

### 3. Is API parity achieved?

Supported by audit evidence.

Evidence:

- `PARITY.md` lists Go-style public API names: `Compile`, `Run`, `Eval`, `Parse`.
- JS ergonomic aliases are additive: `compile`, `run`, `evaluate`, `parse`.
- Options listed in `PARITY.md` are ported, including `Env`, `AllowUndefinedVariables`, `Operator`, `ConstExpr`, `AsKind`, `WarnOnAny`, `WithContext`, `Timezone`, and `Patch`.

Caveat: Go `(value, error)` return style is intentionally represented as thrown errors / direct return values in TS.

### 4. Is folder parity achieved?

Supported by audit evidence for production packages.

Evidence:

- `SOURCE_MAPPING.md` maps upstream packages to `src/`: `file`, `ast`, `parser`, `conf`, `builtin`, `checker`, `compiler`, `vm`, `optimizer`, `patcher`, `types`, `internal/ring`, `internal/deref`, `docgen`, `repl`, `debug`.
- `SOURCE_MIRROR_FINAL.md` expands the audit to 77 Go non-test/support files and classifies all of them.

Caveat: `test/**` Go support files map to parity harnesses/adapters rather than production `src` files.

### 5. Is source parity achieved?

Supported by audit evidence as a source-port mirror, not as line-for-line identical source.

Evidence:

- `SOURCE_MIRROR_FINAL.md` classifies every audited Go source file as `MIRRORED`, `SPLIT`, `GENERATED`, `ADAPTER`, or `NOT_APPLICABLE`.
- `SOURCE_MAPPING.md` shows production source package mapping.

Caveat: `IDENTICAL_STRUCTURE` count is 0 because TypeScript syntax, imports, error handling, and reflection replacement necessarily differ from Go. The supported claim is source-traceable port parity, not byte-for-byte or line-for-line parity.

### 6. Is test parity achieved?

Supported by audit evidence with one known test-harness gap.

Evidence:

- Full suite: 755 tests, 754 pass, 0 fail, 1 skipped.
- The remaining skip is documented in `LAST_SKIP_AUDIT.md` as dynamic `now()` fixture nondeterminism.
- Previous skip reduction and implemented upstream cases are documented in `REMAINING_11_AUDIT.md`.

Caveat: the dynamic fixture requires harness support for fixed clock or regex expected values before skip count can become zero.

### 7. Is maintenance parity achieved?

Partially supported, with explicit non-mechanical hotspots.

Evidence:

- `GENERATOR_AUDIT.md` identifies source origins and classifications for generated tables, adapters, Type descriptors, and metadata.
- `MAINTENANCE_AUDIT.md` lists files to change, hidden coupling, and tests for each adapter/divergence.

Caveat: maintenance is not fully mechanical. High-risk upgrade points are:

1. `FUNC_TYPES` hand-transcribed generated table.
2. TypeDescriptor replacement for Go reflection.
3. Time layout/parser/formatter behavior.
4. Runtime adapters: branded values, visible-field-set, `markStruct()`, and `ValuePatcher`.

### 8. Are there any real gaps remaining?

No source-proven engine behavior gap remains in the audited set.

Known remaining gap:

- `now().Format("2006-01-02T15:04Z")` fixture skip is a `TEST_GAP`, not an engine gap, per `LAST_SKIP_AUDIT.md`.

Known caveats, not classified as current engine gaps:

- Maintenance is not fully generated/mechanical.
- Reflection-heavy Go behavior requires explicit TS metadata/adapters.
- Debug TUI and Go build-tag stubs are host/runtime differences.

### 9. If gaps exist, list them one by one with evidence.

| Gap | Type | Evidence | Impact |
|---|---|---|---|
| Dynamic `now().Format("2006-01-02T15:04Z")` fixture | `TEST_GAP` | `LAST_SKIP_AUDIT.md`; full test suite has 1 skip | Fixture cannot compare current wall-clock output captured at generation time. Engine behavior has deterministic shape tests. |
| `FUNC_TYPES` generated table is hand-transcribed | Maintenance gap | `GENERATOR_AUDIT.md`; `MAINTENANCE_AUDIT.md` | Upstream generated table changes require careful manual or future generated update. |
| Reflection replacement via TypeDescriptor/metadata | Maintenance/adapter caveat | `GENERATOR_AUDIT.md`; `SOURCE_MIRROR_FINAL.md` | JS users must provide metadata where Go would infer from `reflect.Type`. |

### 10. If no gaps remain in a category, cite evidence and verification commands.

Categories with no source-proven engine behavior gaps in the audited set:

- Functional behavior: full suite passes with 0 failures; remaining skip is `TEST_GAP`.
- API surface: `PARITY.md` lists Go-style API and options.
- Production source mapping: `SOURCE_MAPPING.md` and `SOURCE_MIRROR_FINAL.md` classify all files.
- Generated/adapter metadata: `GENERATOR_AUDIT.md` has no unclassified item.

Verification command evidence is listed above.

## Final wording

The careful verdict is:

> `expr-js` parity with `expr-lang/expr` v1.17.8 is supported by audit evidence for functional behavior, semantic behavior, public API, folder/source mapping, and test coverage, with one documented `TEST_GAP` for dynamic `now()` fixture replay and explicit maintenance caveats around generated tables and reflection adapters.

This verdict does not claim byte-for-byte bytecode parity, line-for-line source identity, or fully mechanical future maintenance.
