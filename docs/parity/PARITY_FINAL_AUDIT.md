# expr-js Parity Final Audit Report

> Date: 2026-06-10
> expr-lang/expr version: v1.17.8
> expr-js version: 1.17.8

## Results Summary

| Metric | Before (Closure Follow-up) | After (This Session) | Delta |
|---|:-:|:-:|:-:|
| Total tests | 748 | 749 | +1 |
| Pass | 722 | 738 | **+16** |
| Fail | 0 | 0 | — |
| Skip | 26 | **11** | **-15** |

## Skips Resolved This Session (15 items)

| # | Test | Group | Resolution | Mechanism |
|---|------|-------|-----------|-----------|
| 1 | `TestWithContext` | WithContext | PORTED_WITH_ADAPTER | `Function()` with `FuncOf([ctxType, intType], [intType])` typed signature |
| 2 | `TestWithContext_env_struct` | WithContext | PORTED_WITH_ADAPTER | `Function()` with typed method signature on struct env |
| 3 | `TestWithContext_issue529` | WithContext | PORTED_WITH_ADAPTER | `Function()` with typed signature, pipe expression |
| 4 | `TestIssue461` | Named Types | PORTED_WITH_ADAPTER | `markStruct()` + `new Type(Kind.String, "EnvStr")` + `EnvWithCache` struct support |
| 5 | `TestIssue730_warn_about_different_types` | Named Types | PORTED_WITH_ADAPTER | `markStruct()` + `new Type(Kind.Int, "ModeEnum")` + `ComparableTo` named-type guard |
| 6 | `TestLex_bytes` | Byte Literal | PORTED_WITH_ADAPTER | TS lexer already supported `b"..."` / `B'...'`; wrote test assertions |
| 7 | `TestCompile_panic` | Compiler | PORTED_WITH_ADAPTER | `markStruct()` with Blog-like struct fields |
| 8 | `TestCompile_IntegerArgsFunc` | Compiler | PORTED_WITH_ADAPTER | `markStruct()` with typed method signatures (receiver as In(0)) |
| 9 | `Test_valueAddInt` | Value Patcher | PORTED_WITH_ADAPTER | Implemented `ValuePatcher.Visit()` + `markStruct()` with valuer methods |
| 10 | `Test_valueUntypedAddInt` | Value Patcher | PORTED_WITH_ADAPTER | Same mechanism with `AsAny`-only valuer type |
| 11 | `Test_valueTypedAddInt` | Value Patcher | PORTED_WITH_ADAPTER | Same mechanism with `AsInt`-only valuer type |
| 12 | `Test_valueTypedAddMismatch` | Value Patcher | PORTED_WITH_ADAPTER | Compile error for int valuer + string valuer |
| 13 | `Test_valueUntypedAddMismatch` | Value Patcher | PORTED_WITH_ADAPTER | Runtime error for untyped int + untyped string |
| 14 | `Test_valueTypedArray` | Value Patcher | PORTED_WITH_ADAPTER | `AsArray` valuer + index access |
| 15 | `Test_valueTypedMap` | Value Patcher | PORTED_WITH_ADAPTER | `AsMap` valuer + member access |

## Source Changes Made

| File | Change | Impact |
|------|--------|--------|
| `src/conf/env.ts` | Added `STRUCT_TYPE` check in `EnvWithCache()` | Struct-marked envs now carry declared field types to the checker |
| `src/checker/nature/nature.ts` | Added named-type guard to `ComparableTo()` | User-defined named types (e.g., `EnvStr`, `ModeEnum`) correctly rejected in comparisons |
| `src/patcher/value/value.ts` | Implemented `ValuePatcher.Visit()` with `hasValuerMethods()` | Detects valuer-typed nodes at compile time and wraps with `$patcher_value_getter` |
| `tests/upstream/patcher/with_context_test.ts` | Wrote 3 test bodies using `Function()` adapter | WithContext parity |
| `tests/upstream/issues/461_test.ts` | Wrote full 10-case test with `markStruct()` + named types | Named string type parity |
| `tests/upstream/issues/730_test.ts` | Wrote warn test with `markStruct()` + named int type | Named int type parity |
| `tests/upstream/parser/lexer_test.ts` | Wrote byte literal test assertions | Byte literal parity |
| `tests/upstream/compiler/compiler_test.ts` | Wrote panic + IntegerArgsFunc tests with `markStruct()` | Compiler struct env parity |
| `tests/upstream/patcher/value_test.ts` | Wrote 7 test bodies with valuer type definitions | Value patcher parity |

---

## Remaining 11 Skips — FORCED_DIVERGENCE Evidence

### 1. `TestCompile_FuncTypes` — FORCED_DIVERGENCE

**Go source:** `references/expr/compiler/compiler_test.go:426-436`
```go
func TestCompile_FuncTypes(t *testing.T) {
    env := map[string]any{
        "fn": func([]any, string) string { return "foo" },
    }
    program, err := expr.Compile("fn([1, 2], 'bar')", expr.Env(env))
    require.Equal(t, vm.OpCallTyped, program.Bytecode[3])
    require.Equal(t, 32, program.Arguments[3])
}
```

**TS source:** `tests/upstream/compiler/compiler_test.ts` (skipped)

**Evidence:** Tests emission of `OpCallTyped` opcode, which requires `vm.FuncTypes` — a code-generated table of 90 `*func(...)` type pointers. `TypedFuncIndex()` in Go uses `reflect.ValueOf(vm.FuncTypes[i]).Elem().Type()` with exact `reflect.Type` equality to match function signatures. TS functions are opaque — no mechanism exists to compare function signatures at compile time.

**Observable behavior impact:** NONE. `OpCallTyped` produces identical results to `OpCall`; it exists solely to avoid `reflect.Call()` overhead in Go. The TS VM already calls functions directly.

**Approach attempted:** Building a TS-side type registry mapping `FuncOf()` descriptors to indices. Would only work for functions registered via `Function()` — NOT for env-map functions. The Go test specifically tests env-map functions detected via reflect.

---

### 2. `TestCompile_FuncTypes_with_Method` — FORCED_DIVERGENCE

**Go source:** `references/expr/compiler/compiler_test.go:438-444`
```go
func TestCompile_FuncTypes_with_Method(t *testing.T) {
    env := mock.Env{}
    program, err := expr.Compile("FuncTyped('bar')", expr.Env(env))
    require.Equal(t, vm.OpCallTyped, program.Bytecode[2])
}
```

**Evidence:** Same root cause as #1. Tests method-level typed dispatch via `vm.FuncTypes` and reflect on `mock.Env` struct methods. TS has no struct method reflection.

---

### 3. `TestCompile_FuncTypes_excludes_named_functions` — FORCED_DIVERGENCE

**Go source:** `references/expr/compiler/compiler_test.go:446-452`
```go
func TestCompile_FuncTypes_excludes_named_functions(t *testing.T) {
    env := mock.Env{}
    program, err := expr.Compile("FuncNamed('bar')", expr.Env(env))
    require.Equal(t, vm.OpCall, program.Bytecode[2])
}
```

**Evidence:** Tests that `fn.PkgPath() != ""` excludes named function types from typed dispatch. Go's `reflect.Type.PkgPath()` returns the package path for named types. JS has no concept of named function packages.

---

### 4. `TestCompile_OpCallFast` — FORCED_DIVERGENCE

**Go source:** `references/expr/compiler/compiler_test.go:454-460`
```go
func TestCompile_OpCallFast(t *testing.T) {
    env := mock.Env{}
    program, err := expr.Compile("Fast(3, 2, 1)", expr.Env(env))
    require.Equal(t, vm.OpCallFast, program.Bytecode[4])
}
```

**Evidence:** Tests `OpCallFast` emission for `func(...any) any` signatures. Go's `IsFastFunc` uses `reflect.Type.IsVariadic()`, `In().Kind()`, `In().Elem().Kind()`. TS functions carry no signature metadata. `OpCallFast` in Go skips `reflect.Call()` overhead; TS `OpCall` already calls functions directly without reflect.

**Observable behavior impact:** NONE. Performance optimization only.

---

### 5. `TestIssue730_eval` — FORCED_DIVERGENCE

**Go source:** `references/expr/test/issues/730/issue_test.go:45-60`
```go
func TestIssue730_eval(t *testing.T) {
    code := `Mode == 1`
    tmp := ModeEnumA
    env := map[string]any{"Mode": &tmp}
    out, err := expr.Eval(code, env)
    require.False(t, out.(bool))  // Go: ModeEnum(1) == int(1) → false
}
```

**Evidence:** Go runtime compares `ModeEnum(1)` with `int(1)` and returns `false` because named types are distinct at runtime (Go spec §Comparison: "values are comparable if their types are identical"). In JS: `1n === 1n` always returns `true`. Reproducing this would require wrapping ALL values in type-tagged containers throughout the entire VM, contradicting JS value semantics.

**Approach attempted:** Named wrapper `{ _type: "ModeEnum", value: 1n }` — but then ALL arithmetic, comparisons, assignments would need unwrapping. The entire VM would need a type-tag layer.

---

### 6. `TestIssue836` — FORCED_DIVERGENCE

**Go source:** `references/expr/test/issues/836/issue_test.go` (6 sub-tests, 101 lines)

Tests:
- `*string` as map key (pointer identity comparison)
- `*bool` in ternary (auto-dereference)
- `*int` nil check
- `get()` with pointer key
- slice with pointer indices

**Evidence:** All sub-tests require:
1. **Pointer identity:** Go map keys `map[*string]bool` compare pointers by memory address. JS objects compared by reference, but two wrapper instances are different objects.
2. **Auto-dereference:** Go transparently dereferences pointers in ALL operations. Would need to modify EVERY VM opcode.
3. **Pointer-to-slice:** `*[]string` is a pointer to a slice. Double wrapping: `Ptr<Array<string>>`.

**Approach attempted:** `class Ptr<T> { value: T | null }` wrapper. Failed because:
- Auto-dereference needed in every opcode
- Pointer identity cannot be simulated with object references
- Typed nil: `Ptr(null)` must be simultaneously nil (pointer) and non-nil (interface value)

---

### 7. `TestIssue844` — FORCED_DIVERGENCE

**Go source:** `references/expr/test/issues/844/issue_test.go` (20 sub-tests, 194 lines)

**Evidence:** Tests Go's capitalization-based field visibility through embedded struct promotion. `reflect.Type.FieldByName()` returns all fields including unexported ones; the checker filters based on `field.PkgPath == ""`. JS has no visibility concept — all object properties are accessible.

**Approach considered:** `markStruct()` with only exported fields. Failed because Go's embedded struct promotion has complex visibility rules:
- Unexported embedded struct's exported fields ARE promoted
- Exported embedded struct's unexported fields are NOT promoted
- Multi-level embedding visibility cascading
- 20 sub-tests covering all combinations

---

### 8. `now().Format("2006-01-02T15:04Z")` — NOT_APPLICABLE

**Evidence:** Dynamic fixture — `now()` returns the current time, so the expected output changes per run. Legitimate skip due to test infrastructure limitation, not a parity gap.

---

### 9. `NilStruct` — FORCED_DIVERGENCE

**Go source:** `references/expr/test/mock/mock.go` — `NilStruct *Foo = nil`

**Evidence:** Go typed-nil: `(*Foo)(nil)` is a non-nil interface value wrapping a nil pointer. `NilStruct == nil` → `false` in Go. JS: `null === null` → `true`. The Go behavior depends on the distinction between a nil interface and a nil pointer inside a non-nil interface — no JS analog exists.

---

### 10. `NilAny == nil && ... && NilStruct == nil` — FORCED_DIVERGENCE

**Evidence:** Same root cause as #9. The expression includes `NilStruct == nil` which evaluates to `false` in Go (typed nil) but `true` in JS (null). The entire compound expression produces different results.

---

### 11. `concat(PtrArrayWithNil, [nil])` — FORCED_DIVERGENCE

**Go source:** `references/expr/test/mock/mock.go` — `PtrArrayWithNil *[]string`

**Evidence:** Go `*[]string` is a pointer to a slice. The `concat()` function auto-dereferences the pointer to access the underlying slice. JS has no pointer type; cannot represent a pointer-to-array with auto-dereference semantics.

---

## Classification Summary

| Classification | Count | Items |
|---|:-:|-------|
| **FORCED_DIVERGENCE** (proven with source evidence) | 10 | #1-7, #9-11 |
| **NOT_APPLICABLE** (dynamic output) | 1 | #8 |
| **Total remaining skips** | **11** | |

## Verification Commands

```bash
cd packages/expr-js

# TypeCheck
npx tsc --noEmit     # PASS: 0 errors

# Build
npm run build         # PASS: ESM + CJS + types

# Full test suite
npx tsx --test 'tests/**/*.test.ts' 'tests/**/*.ts'
# PASS: 749 tests, 738 pass, 0 fail, 11 skipped
```
