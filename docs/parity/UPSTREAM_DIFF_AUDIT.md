# UPSTREAM_DIFF_AUDIT.md

Maintenance Parity Closure Program — Phase 3.

Simulation: hypothetical upgrade `expr-lang/expr` v1.17.8 → v1.17.9 with changes in:

- `vm/func_types[generated].go`
- `checker/checker.go`
- `builtin/builtin.go`
- `checker/nature/nature.go`
- `vm/runtime/runtime.go`

This is not a claim about actual upstream v1.17.9. It is an impact model for repeatability.

## Summary matrix

| Upstream file changes | Metadata affected | Would current repo auto-update? | Would proposed generator auto-update? | Manual maintainer edit still needed? |
|---|---|---:|---:|---:|
| `vm/func_types[generated].go` | `FUNC_TYPES`, `FUNC_TYPES_ARITY`, typed dispatch tests | No | Yes, if `gen-func-types` exists and is run | No for table; yes for new unsupported Go type mappings if any. |
| `checker/checker.go` | checker visitor behavior, use of Type descriptors, builtin/type validation paths | No | No, mostly source logic | Yes. Source port review/edit required. |
| `builtin/builtin.go` | `Builtins`, per-builtin `Types`, validators, runtime functions | No | Partially for metadata snapshot/fixtures | Yes for executable logic/validators; generated diff can point to exact changes. |
| `checker/nature/nature.go` | TypeDescriptor, Nature, FieldDescriptor, struct/method lookup, strictness | No | Partially for reflection-scan fixtures | Yes. Core reflection adapter must be manually ported. |
| `vm/runtime/runtime.go` | runtime helpers, `Fetch`, `In`, `Equal`, comparison semantics | No | No for logic; fixtures can catch behavior | Yes. Runtime source port required. |

## Detailed impact by metadata area

### 1. `FUNC_TYPES`

Hypothetical upstream change:

- New function signatures are added.
- Existing indices reorder.
- A return/input type changes.

Current outcome:

- `src/checker/info.ts` manual table does not update.
- `TypedFuncIndex()` may emit stale or wrong typed-call indices.
- `src/vm/vm.ts` may pop wrong arity via `FUNC_TYPES_ARITY`.

Generator outcome:

- `GENERATED_FROM_GO` parser of `vm/func_types[generated].go` regenerates table and arity.
- Snapshot diff shows index-level changes.

Manual edit required?

- No for known Go type tokens.
- Yes if upstream introduces new type syntax not mapped by generator, e.g. a new external package type with no TS descriptor mapping.

Tests catching breakage:

- `tests/upstream/compiler/compiler_test.ts`
- full `npx tsx --test 'tests/**/*.test.ts' 'tests/**/*.ts'`

### 2. `TypedFuncIndex()` / `IsFastFunc()` logic

Hypothetical upstream change:

- Go changes named-function exclusion.
- Go changes variadic handling.
- Go changes method receiver offset.

Current outcome:

- TS logic remains stale until source-port review.

Generator outcome:

- Table generator does not help; this is behavior logic.

Manual edit required?

- Yes. Maintainer must diff `references/expr/checker/info.go` and update `src/checker/info.ts`.

Tests catching breakage:

- `TestTypedFuncIndex`, `TestCompile_FuncTypes`, `TestCompile_OpCallFast`.

### 3. Checker descriptors / `Type` / `Nature`

Hypothetical upstream change in `checker.go` or `checker/nature/nature.go`:

- New checker rule needs additional reflect metadata.
- Field lookup starts using more `StructField` fields.
- Method lookup semantics change.
- Strict/any behavior changes.

Current outcome:

- TS `Type`/`Nature` schema may lack needed metadata.
- `markStruct()` data might be insufficient.

Generator outcome:

- Reflection-scanned fixtures can reveal missing fields/methods.
- Cannot auto-rewrite checker behavior.

Manual edit required?

- Yes for schema/logic changes.
- Generated fixture metadata can reduce manual test adapter edits.

Tests catching breakage:

- `tests/go-parity/checker/checker.parity.test.ts`
- `tests/upstream/checker/info_test.ts`
- issue tests involving strict structs and named types.

### 4. Builtin registry and validators

Hypothetical upstream change in `builtin.go`:

- New builtin added.
- Existing builtin signature changes.
- Validator error message/rule changes.
- Predicate metadata changes.

Current outcome:

- `src/builtin/builtin.ts` remains stale.
- Checker/runtime may diverge silently unless tests cover the changed builtin.

Generator outcome:

- AST metadata extractor can detect builtin `Name`, `Predicate`, declared `Types`, and `Validate` presence changes.
- Go fixture generator can create expected behavior cases.
- Executable TS implementation still requires manual port.

Manual edit required?

- Yes for runtime implementation and validators.
- No/less for detecting inventory differences.

Tests catching breakage:

- `tests/go-parity/builtin/builtin.parity.test.ts`
- generated builtin metadata snapshot test.
- full test suite.

### 5. Primitive / standard Type descriptors

Hypothetical upstream change:

- More stdlib methods are used on `time.Time`, `time.Duration`, or `*time.Location`.
- New reflect kinds/types are introduced in builtin/func_types/checker usage.

Current outcome:

- Manual `timeType.methods`, `durationType.methods`, `locationType` must be updated.
- Duplication between `locationType` and `locationTypeRef` may drift.

Generator outcome:

- Reflection scan regenerates std type descriptors and method sets.
- Generated `std_types.generated.ts` removes duplicate definitions.

Manual edit required?

- No for known reflect kind mapping.
- Yes if generated method signatures require TS runtime methods that do not exist on `GoTime`/`GoDuration`.

Tests catching breakage:

- time/builtin parity tests.
- typecheck if generated descriptors reference missing constructors.

### 6. Branded named-type metadata

Hypothetical upstream change:

- New named primitive issue/test requires runtime distinction.
- Equality semantics change for named types.

Current outcome:

- Tests must manually call `brand()` or construct branded env values.

Generator outcome:

- Fixture generator can reflect env field/value named type and emit a type tag.
- TS fixture loader can automatically `brand()` values with `typeName`.

Manual edit required?

- No for fixture/env values once generator supports type tags.
- Yes for runtime operations if named type distinction becomes relevant outside equality.

Tests catching breakage:

- issue 730 tests, generated named-type fixtures.

### 7. Visibility metadata / struct metadata

Hypothetical upstream change:

- New tests rely on embedded struct promotion, unexported fields, `PkgPath`, anonymous fields, or method promotion.

Current outcome:

- TS tests need manual visible-field-set `markStruct()` metadata.

Generator outcome:

- Reflection scan with `reflect.VisibleFields()` can emit visible fields, hidden fields, indexes, `PkgPath`, and anonymous flags.
- TS `markStruct()` calls can import generated metadata.

Manual edit required?

- Usually no for test metadata.
- Yes if checker itself lacks a field lookup rule needed to consume new metadata.

Tests catching breakage:

- issue 844 tests.
- generated visibility fixture tests.

### 8. `ValuePatcher` / valuer methods

Hypothetical upstream change:

- New valuer interface method added.
- Type-switch priority changes.
- Compile-time interface check changes.

Current outcome:

- `VALUER_METHODS` can drift.
- TS duck-type order can diverge.

Generator outcome:

- Parse Go `patcher/value/value.go` type-switch/interface declarations and regenerate method list.
- Reflection-generated type metadata can identify valuer method sets in fixture envs.

Manual edit required?

- No for method list/order.
- Yes for compile-time wrapping strategy if Go changes AST rewrite semantics.

Tests catching breakage:

- `tests/upstream/patcher/*`.

### 9. Runtime helpers / `runtime.go`

Hypothetical upstream change:

- `Equal`, `Fetch`, `In`, `Less`, range behavior, or nil handling changes.

Current outcome:

- TS runtime remains stale until manually ported.

Generator outcome:

- No direct code generation recommended.
- Generate behavior fixtures from Go instead.

Manual edit required?

- Yes.

Tests catching breakage:

- VM tests, eval parity, issue tests, full suite.

## Phase 3 conclusion

A future upgrade can become repeatable for metadata data, but not fully automatic for behavior logic.

Expected automation after proposed generators:

- Automatic: `FUNC_TYPES`, arity, valuer method list, std type/method descriptors, visible field sets, named-type fixture tags.
- Semi-automatic: builtin registry/signature diff detection and behavior fixture generation.
- Manual: checker visitor logic, runtime semantics, JS adapter architecture, builtin executable implementations.

Therefore maintenance parity can realistically become `MOSTLY_AUTOMATED` for metadata, but not `FULLY_AUTOMATED` for the entire port.
