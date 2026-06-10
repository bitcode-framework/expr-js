# MAINTENANCE_AUDIT.md

Diff-maintenance audit for `expr-js` against `expr-lang/expr` v1.17.8.

## Purpose

This file answers, for each remaining divergence/adapter, what must change when upstream moves to a new version, whether the update is mechanical, what hidden coupling exists, and what verification catches regressions.

## Audit table

| Area | If upstream changes v1.17.9, TS files to inspect/change | Mechanical? | Hidden coupling | Breakage-catching command/test |
|---|---|---|---|---|
| `FUNC_TYPES` | `src/checker/info.ts`; `src/vm/vm.ts` for `OpCallTyped`; `tests/upstream/compiler/compiler_test.ts` | Partially. Table entries are mechanically transcribable from `vm/func_types[generated].go`; type descriptor names/kinds still need review. | Compiler emits `OpCallTyped`; VM interprets opcode arg as table index; tests assert exact typed index for selected signatures. | `npx tsx --test tests/upstream/compiler/compiler_test.ts`; full `npx tsx --test 'tests/**/*.test.ts' 'tests/**/*.ts'` |
| `FUNC_TYPES_ARITY` | `src/checker/info.ts`; `src/vm/vm.ts` | Yes if `FUNC_TYPES` is correct; arity is computed from table. | Wrong arity causes VM stack pop/call bugs while bytecode still looks valid. | `tests/upstream/compiler/compiler_test.ts`; full test suite. |
| `TypedFuncIndex` | `src/checker/info.ts`; possibly `src/checker/nature/type.ts` if reflect comparison semantics need descriptor support. | Mostly source-portable; reflect equality maps to descriptor equality. | Depends on Type descriptor naming for named function exclusion and method receiver offset. | Compiler typed dispatch tests plus typecheck. |
| `IsFastFunc` | `src/checker/info.ts`; Type descriptor func/variadic helpers in `src/checker/nature/type.ts` | Yes; predicate mirrors Go. | Compiler and VM must agree on `OpCallFast` arg count. | `tests/upstream/compiler/compiler_test.ts`. |
| Branded runtime values | `src/vm/runtime/branded.ts`; equality/arithmetic in `src/vm/runtime/helpers.ts`; tests `tests/upstream/issues/730_test.ts` | No. This is a targeted JS adapter for Go named primitive runtime identity. | Runtime equality preserves brand; arithmetic/comparison unbrands. New named-type-sensitive operations could bypass `unbrand()`. | `npx tsx --test tests/upstream/issues/730_test.ts`; full suite. |
| Visibility metadata / visible-field-set adapter | `src/checker/nature/nature.ts`; tests/env adapters using `markStruct()`, especially `tests/upstream/issues/844_test.ts` | No for arbitrary Go embedding; yes for generated visible-field sets if produced by Go fixture tooling. | Checker field lookup, test adapter metadata, and struct field promotion expectations are coupled. | `npx tsx --test tests/upstream/issues/844_test.ts`; checker parity tests. |
| Checker descriptors | `src/checker/nature/type.ts`, `kind.ts`, `nature.ts`, `utils.ts`; `src/checker/checker.ts`; `src/checker/info.ts` | Partially. Control flow can mirror Go, but reflect operations require descriptor equivalents. | Builtins, patchers, compiler optimizations, and env adapters all consume Type descriptors. Descriptor changes are cross-cutting. | `npx tsc --noEmit`; `tests/go-parity/checker/checker.parity.test.ts`; `tests/upstream/checker/info_test.ts`; full suite. |
| Typed struct metadata | `src/checker/nature/nature.ts`; env adapters in tests; public docs if API changes | No automatic reflection; metadata must be supplied. | `markStruct()` metadata must match runtime object shape; methods need `FuncOf()` signatures for compiler/patchers. | Issue 844, compiler typed method tests, checker corpus. |
| Timezone support | `src/vm/runtime/gotime.ts`; `src/builtin/builtin.ts`; `src/builtin/utils.ts`; tests/go-parity builtin fixtures | Partially; behavior depends on JS `Intl`. | Time parsing, formatting, `timezone().String()`, and checker `*time.Location` metadata are coupled. | `tests/go-parity/builtin/builtin.parity.test.ts`; `tests/upstream/builtin/now_test.ts`; full suite. |
| `GoLocation` | `src/vm/runtime/gotime.ts`; type marker in `src/checker/nature/nature.ts`; builtin timezone helpers | Mostly manual adapter. | Runtime object identity, `String()`, and type descriptor for `*time.Location` must stay aligned. | Builtin parity timezone cases; typecheck. |
| Time layout/parser/formatter | `src/vm/runtime/gotime.ts`; date/now builtins in `src/builtin/builtin.ts` | No; Go layout semantics require manual port or generated test fixtures. | Fixture generator, dynamic now skip, date parsing, timezone offsets, and GoTime formatting all interact. | Builtin parity date/time cases; `tests/upstream/builtin/now_test.ts`; full suite. |
| `markStruct()` adapter strategy | `src/checker/nature/nature.ts`; tests and user env adapters | No. It is the replacement for Go reflection. | EnvWithCache, checker strict field/method rules, compiler typed calls, WithContext/ValueGetter all depend on explicit metadata. | Checker corpus, issues 844/730/461, compiler typed method tests. |
| `ValuePatcher` adapter strategy | `src/patcher/value/value.ts`; checker `Node.Type()` metadata; tests under `tests/upstream/patcher` | Partially. Runtime duck-typing is mechanical; compile-time interface detection requires metadata. | Checker must annotate node types; ValuePatcher wraps identifiers/members; runtime `$patcher_value_getter` must be registered before execution. | `npx tsx --test tests/upstream/patcher/*.ts`; full suite. |
| Builtin descriptors / validations | `src/builtin/builtin.ts`; `src/builtin/validation.ts`; `src/builtin/lib.ts`; `src/checker/checker.ts` | Partially; tables and validators are source-portable but not generated. | Builtin Types affect checker, compiler predicate handling, VM aggregate opcodes, and parity fixtures. | Builtin parity corpus; full suite. |
| Numeric helper collapse | `src/vm/runtime/helpers.ts`; optional reference `src/vm/runtime/helpers.generated.ts`; `scripts/gen-helpers.mjs` | Not line-mechanical; semantic changes must be ported to bigint/number model. | Arithmetic helpers drive VM, builtins, comparisons, equality, ranges, in-operator, branded values, GoTime/GoDuration. | Numeric/eval parity, upstream VM tests, full suite. |

## Upgrade recipe

1. Diff upstream `references/expr` against the pinned v1.17.8 tree.
2. For generated Go files, regenerate or re-transcribe first: `func_types[generated].go`, helper generator output.
3. Port source changes package-by-package in this order: `ast/parser` → `checker/nature` → `builtin` → `compiler` → `vm/runtime` → `vm` → `optimizer` → `patcher` → non-core.
4. Add Go-generated fixtures for any behavior whose expected result is not obvious.
5. Run focused tests for changed area, then the full verification gate.

## Minimum verification gate after maintenance changes

```powershell
npx tsc --noEmit
npx tsx --test 'tests/**/*.test.ts' 'tests/**/*.ts'
npm run build
```

## Conclusion

Most code is source-portable, but maintenance is not fully mechanical. The non-mechanical hotspots are reflection replacement (`Type` descriptors and `markStruct()`), generated function dispatch (`FUNC_TYPES`), time layout behavior, and runtime adapters (`brand`, `ValueGetter`). These hotspots are documented and covered by targeted tests, so future upgrades are auditable rather than assumption-based.
