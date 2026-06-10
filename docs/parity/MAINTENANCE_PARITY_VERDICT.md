# MAINTENANCE_PARITY_VERDICT.md

Maintenance Parity Closure Program — Phase 5.

Final maintenance automation verdict for `expr-js` against `expr-lang/expr` v1.17.8.

## Inputs

This verdict is based on:

- `METADATA_INVENTORY.md`
- `GENERATOR_FEASIBILITY.md`
- `UPSTREAM_DIFF_AUDIT.md`
- `AUTOMATION_PLAN.md`
- Existing final audit docs: `FINAL_PARITY_VERDICT.md`, `GENERATOR_AUDIT.md`, `MAINTENANCE_AUDIT.md`, `SOURCE_MIRROR_FINAL.md`, `LAST_SKIP_AUDIT.md`
- Current source files under `src/`
- Upstream references under `references/expr/`

## Parity status summary

| Area | Status | Evidence |
|---|---|---|
| Functional parity | Supported by audit evidence | `FINAL_PARITY_VERDICT.md`; full test suite evidence: 755 tests, 754 pass, 0 fail, 1 skipped dynamic fixture. |
| Semantic parity | Supported by audit evidence for audited behavior | `REMAINING_11_AUDIT.md`, `LAST_SKIP_AUDIT.md`, time/numeric/checker/issue tests. |
| API parity | Supported by audit evidence | `PARITY.md`, `FINAL_PARITY_VERDICT.md`; Go-style API and options are present. |
| Source parity | Supported as source-traceable port parity | `SOURCE_MIRROR_FINAL.md`; not line-for-line or byte-for-byte identity. |
| Test parity | Supported with one `TEST_GAP` | `LAST_SKIP_AUDIT.md`; only dynamic `now()` fixture remains skipped. |
| Maintenance parity | `PARTIALLY_AUTOMATED` currently; `MOSTLY_AUTOMATED` achievable with proposed generators | `METADATA_INVENTORY.md`, `GENERATOR_FEASIBILITY.md`, `AUTOMATION_PLAN.md`. |

## Maintenance parity classification

Current classification: `PARTIALLY_AUTOMATED`.

Reason:

- Some generated-source support already exists (`scripts/gen-helpers.mjs`, fixture generation infrastructure), and source mapping/audits are detailed.
- But critical metadata remains manual today: `FUNC_TYPES`, standard method descriptors, visibility metadata, branded fixture metadata, valuer method order, and builtin metadata drift detection.
- The port still requires manual source-porting for checker/runtime/builtin behavior changes.

Target after implementing `AUTOMATION_PLAN.md`: `MOSTLY_AUTOMATED` for metadata maintenance.

`FULLY_AUTOMATED` is not supported by evidence because Go reflection/runtime semantics cannot be mechanically converted into TypeScript behavior in all cases.

## Required area verdicts

### 1. `FUNC_TYPES`

Current status: `MANUAL` / `PARTIALLY_AUTOMATED`.

Evidence:

- Current table is in `src/checker/info.ts` as `const FUNC_TYPES`.
- Upstream source is `references/expr/vm/func_types[generated].go`.
- `FUNC_TYPES_ARITY` is derived from the manual TS table.

Can it be generated?

Yes: `GENERATED_FROM_GO`.

Verdict:

- Current maintenance parity: `PARTIALLY_AUTOMATED`.
- After `gen-func-types`: `FULLY_AUTOMATED` for table/arity data.
- Manual logic remains for `TypedFuncIndex()` itself.

### 2. Checker descriptors

Current status: `MANUAL_ONLY` adapter with generated-test opportunity.

Evidence:

- `src/checker/nature/type.ts` implements `Type`, `FieldDescriptor`, primitive descriptors, `SliceOf`, `MapOf`, `FuncOf`.
- `src/checker/nature/nature.ts` maps runtime JS values into Type/Nature.
- Upstream uses Go `reflect.Type`, `reflect.Kind`, `reflect.StructField`, and method sets.

Can it be generated?

Partially:

- Descriptor instances for known Go/std/test types can be `GENERATED_FROM_REFLECTION_SCAN`.
- The `Type` class/schema and checker strategy are `MANUAL_ONLY`.

Verdict:

- Current maintenance parity: `MANUAL` for schema/logic, `PARTIALLY_AUTOMATED` if fed by generated fixtures later.
- Cannot honestly be classified as fully automated.

### 3. Branded types

Current status: manual runtime adapter plus manual test usage.

Evidence:

- `src/vm/runtime/branded.ts` defines `BRANDED`, `brand()`, `getBrand()`, `unbrand()`.
- `src/vm/runtime/helpers.ts` performs brand-aware equality and unbrands arithmetic/comparison inputs.
- Issue 730 tests use named-type behavior.

Can it be generated?

Partially:

- Runtime wrapper design is `MANUAL_ONLY`.
- Named-type fixture tags can be `GENERATED_FROM_FIXTURES` via Go reflection/normalization.

Verdict:

- Current maintenance parity: `PARTIALLY_AUTOMATED` only by tests, mostly manual metadata.
- After fixture type tags: `MOSTLY_AUTOMATED` for data; runtime adapter remains manual.

### 4. Visibility metadata

Current status: manual visible-field-set adapters in tests/env metadata.

Evidence:

- `src/checker/nature/nature.ts` has `STRUCT_TYPE`, `StructMeta`, `markStruct()`.
- Issue 844 tests model Go exported/unexported visible field sets manually.
- Go source behavior comes from `reflect.VisibleFields()` and `StructField.PkgPath` semantics.

Can it be generated?

Yes for metadata: `GENERATED_FROM_REFLECTION_SCAN`.

Verdict:

- Current maintenance parity: `MANUAL` for test/env visible metadata.
- After visible-fields scanner: `MOSTLY_AUTOMATED` for metadata.
- Checker consumption logic remains manual adapter.

### 5. Struct metadata

Current status: manual adapter contract.

Evidence:

- `STRUCT_TYPE` symbol and `markStruct()` in `src/checker/nature/nature.ts` attach struct metadata to JS objects.
- `EnvWithCache()` in `src/conf/env.ts` consumes this metadata.
- Tests and mock env use manual metadata.

Can it be generated?

Partially:

- Metadata payloads for Go test/env structs can be generated by reflection scan.
- Carrier design (`STRUCT_TYPE`, `markStruct()`) is `MANUAL_ONLY`.

Verdict:

- Current maintenance parity: `PARTIALLY_AUTOMATED` at best because the adapter is stable but metadata is manual.
- Target: `MOSTLY_AUTOMATED` once generated `StructMeta` payloads replace manual test metadata.

### 6. TypeDescriptor mappings

Current status: manual central reflection replacement.

Evidence:

- `src/checker/nature/type.ts` maps Go reflect concepts into explicit descriptors.
- `src/builtin/utils.ts`, `src/checker/info.ts`, and tests create Type instances manually.

Can it be generated?

Partially:

- Known type instances and method sets can be generated from Go reflection scans.
- The descriptor model and conversion rules are `MANUAL_ONLY`.

Verdict:

- Current maintenance parity: `PARTIALLY_AUTOMATED` because tests cover behavior but descriptor creation remains manual.
- Target: `MOSTLY_AUTOMATED` for standard/test descriptors, not for descriptor architecture.

## Other important metadata areas

| Area | Current classification | Automation verdict |
|---|---|---|
| Builtin registry | Manual source port | `GENERATED_FROM_AST` feasible for drift detection; implementation remains manual. |
| Builtin validators | Manual source port | Behavior fixtures can be generated; code remains manual. |
| Time layout/parser/formatter | Manual adapter | Fixture generation feasible; implementation remains manual. |
| `GoTime`/`GoDuration`/`GoLocation` runtime classes | Manual adapter | Manual-only runtime classes; generated fixtures should guard behavior. |
| `VALUER_METHODS` | Manual list | Can be `GENERATED_FROM_GO`. |
| `ValuePatcher` strategy | Manual adapter | Method list and fixture metadata can be generated; strategy remains manual. |

## Explicit answers

### 1. Functional parity status

Supported by audit evidence. The test suite currently reports 755 tests, 754 pass, 0 fail, 1 skipped dynamic `now()` fixture.

### 2. Semantic parity status

Supported by audit evidence for audited behavior. Known semantic-sensitive areas — numeric behavior, named-type equality, pointer auto-deref adapters, time/date behavior, visibility adapters — are covered by tests and audit docs.

### 3. API parity status

Supported by audit evidence. Go-style `Compile`, `Run`, `Eval`, `Parse` and documented options are present; JS aliases are additive.

### 4. Source parity status

Supported as source-traceable TypeScript port parity. It is not line-for-line, byte-for-byte, or generated-transpiler parity.

### 5. Test parity status

Supported with one `TEST_GAP`: dynamic `now().Format("2006-01-02T15:04Z")` fixture replay. No failing test remains.

### 6. Maintenance parity status

Current: `PARTIALLY_AUTOMATED`.

Reason:

- Metadata inventory found high-risk manual areas.
- Feasibility audit shows many can be generated, but they are not generated yet.
- Some areas cannot be generated away because they are TS-specific reflection/runtime adapters.

Target after automation plan: `MOSTLY_AUTOMATED`.

Not supported: `FULLY_AUTOMATED`.

Reason:

- `checker.go`, `nature.go`, `runtime.go`, and executable builtin validator/runtime logic require human source-porting and design review.
- Go reflection cannot be universally transpiled into TS; it must be represented by explicit descriptors and adapters.

## Final wording

The correct maintenance verdict is:

> expr-js currently has `PARTIALLY_AUTOMATED` maintenance parity. The dangerous manual metadata can be reduced substantially, and metadata maintenance can realistically become `MOSTLY_AUTOMATED` by generating `FUNC_TYPES`, standard descriptors, visible struct metadata, named-type fixture tags, valuer method lists, and builtin drift snapshots from Go. However, `FULLY_AUTOMATED` maintenance parity is not supported because core reflection replacement, checker/runtime behavior, and TS adapter architecture remain manual source-port work.

This verdict does not weaken the current functional/semantic/API parity evidence; it only classifies future upgrade repeatability.
