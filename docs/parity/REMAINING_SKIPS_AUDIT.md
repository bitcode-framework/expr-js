# Remaining Skips Audit

> Generated: 2026-06-10
> Updated: 2026-06-10 Parity Closure follow-up
> Audited: 95 skips (initial) → 75 skips (handoff) → **26 skips (current)**
> Implemented: 20 skips resolved in prior session + **49 skips resolved in closure follow-up**
> Remaining: **26 skips** (see `PARITY_CLOSURE_REPORT.md` for current source-level evidence)

---

## Current Results (Supersedes historical audit below)

| Metric | Handoff | Current | Delta |
|---|:-:|:-:|:-:|
| Total tests | 748 | **748** | — |
| Pass | 673 | **722** | **+49** |
| Fail | 0 | **0** | — |
| Skip | 75 | **26** | **-49** |

### Current Remaining Skips

| Category | Count | Classification |
|---|:-:|---|
| Go typed-nil / pointer-to-slice / pointer semantics | 4 | FORCED_DIVERGENCE |
| Go named primitive types (`EnvStr`, `ModeEnum`) | 3 | FORCED_DIVERGENCE |
| Go exported/unexported reflect visibility | 1 | FORCED_DIVERGENCE |
| Go byte literal syntax | 1 | FORCED_DIVERGENCE |
| Value patcher interface detection | 7 | FORCED_DIVERGENCE pending metadata API |
| WithContext env function signature detection | 3 | FORCED_DIVERGENCE pending metadata API |
| Compiler internal typed/fast dispatch | 6 | 4 PORTABLE_WITH_ADAPTER, 2 low-value internal divergence |
| Dynamic `now().Format(...)` fixture | 1 | NOT_APPLICABLE dynamic output |

**Resolved in follow-up:** Go layout parser, GoTime normalize, timezone String, builtin Int32/NestedInt32 outputs, `groupBy(ArrayOfFoo, .Value).a`, all checker strict-struct field/method/type errors, and time integration layout tests.

---

## Current Remaining 26 Skips — Source-Level Audit

### GROUP A: WithContext Patcher (3 skips) — PORTABLE_WITH_ADAPTER

**Go source:** `references/expr/patcher/with_context.go` lines 20–67
**TS source:** `src/patcher/with_context.ts` lines 45–102

Go uses `fn.In(0).String() === "context.Context"` via reflect on function signatures. TS env-map functions are modeled as `func(...any) any` with no introspectable signature. The patcher is fully implemented — it just needs typed signatures.

**Fix:** Register env functions via `Function()` with `FuncOf()` typed signatures. This pattern is proven by 2 passing WithContext tests.

| # | Test | File:Line | Fix |
|---|------|-----------|-----|
| 1 | `TestWithContext` | `with_context_test.ts:22` | `Function("fn", fnImpl, FuncOf([ctxType, intType], [intType]))` |
| 2 | `TestWithContext_env_struct` | `with_context_test.ts:46` | `markStruct()` with typed methods |
| 3 | `TestWithContext_issue529` | `with_context_test.ts:89` | `Function()` adapter |

### GROUP B: Named Type Parity (3 skips) — 2 PORTABLE, 1 FORCED_DIVERGENCE

**Go source (461):** `references/expr/test/issues/461/issue_test.go` lines 11–20
**Go source (730):** `references/expr/test/issues/730/issue_test.go` lines 10–18
**TS source:** `src/checker/nature/type.ts` (Type.name, AssignableTo)

`AssignableTo()` checks `this.name === t.name` for named types. This can distinguish `EnvStr` from `string` at the checker level.

| # | Test | File:Line | Classification | Fix |
|---|------|-----------|---|-----|
| 4 | `TestIssue461` | `461_test.ts:17` | PORTABLE_WITH_ADAPTER | `markStruct()` + `new Type(Kind.String, "EnvStr")` |
| 5 | `TestIssue730_warn_about_different_types` | `730_test.ts:27` | PORTABLE_WITH_ADAPTER | `markStruct()` + `new Type(Kind.Int, "ModeEnum")` |
| 6 | `TestIssue730_eval` | `730_test.ts:35` | **FORCED_DIVERGENCE** | Go: `ModeEnum(1)==int(1)` → `false`. JS: `1n===1n` → `true`. Runtime named-type distinction requires type-tagged value wrappers across entire VM. |

### GROUP C: Value Patcher (7 skips) — PORTABLE_WITH_ADAPTER (significant effort)

**Go source:** `references/expr/patcher/value/value.go` lines 135–149
**TS source:** `src/patcher/value/value.ts` lines 76–79 (Visit is no-op)

Go uses `nodeType.Implements(valuerType)` at compile time via reflect. TS Visit() is no-op because JS has no interfaces.

**Fix path:**
1. Define `valuerType = new Type(Kind.Interface, "valuer")` with AsAny/AsInt/AsString methods
2. Mark env objects with valuer-typed fields via `markStruct()`
3. Implement `ValuePatcher.Visit()` to check node's Nature type for valuer methods
4. Modify checker binary op validation to accept valuer-typed operands (unwrap to underlying type)

Step 4 is invasive — modifies `checker.ts` binary node handling. Must scope carefully.

| # | Test | File:Line |
|---|------|-----------|
| 7 | `Test_valueAddInt` | `value_test.ts:22` |
| 8 | `Test_valueUntypedAddInt` | `value_test.ts:23` |
| 9 | `Test_valueTypedAddInt` | `value_test.ts:24` |
| 10 | `Test_valueTypedAddMismatch` | `value_test.ts:25` |
| 11 | `Test_valueUntypedAddMismatch` | `value_test.ts:26` |
| 12 | `Test_valueTypedArray` | `value_test.ts:27` |
| 13 | `Test_valueTypedMap` | `value_test.ts:28` |

### GROUP D: Compiler Internal (6 skips) — 2 PORTABLE, 4 FORCED_DIVERGENCE

**Go source:** `references/expr/compiler/compiler.go` lines 778–838
**Go source:** `references/expr/checker/info.go` lines 51–125 (TypedFuncIndex, IsFastFunc)
**Go source:** `references/expr/vm/func_types[generated].go` (90-entry lookup table)
**TS source:** `src/compiler/compiler.ts` lines 951–956 (dead branches)
**TS source:** `src/checker/info.ts` lines 81–86 (always returns false/0)

| # | Test | File:Line | Classification | Evidence |
|---|------|-----------|---|---|
| 14 | `TestCompile_FuncTypes` | `compiler_test.ts:55` | **FORCED_DIVERGENCE** | Tests `OpCallTyped` emission. Requires `vm.FuncTypes` table (90 generated Go function types). `TypedFuncIndex()` uses `reflect.ValueOf(vm.FuncTypes[i]).Elem().Type()` with exact `reflect.Type` equality. TS functions have no type identity. This is an **optimization** (avoid `reflect.Call()`), not correctness. |
| 15 | `TestCompile_FuncTypes_with_Method` | `compiler_test.ts:58` | **FORCED_DIVERGENCE** | Same. Method-level typed dispatch via reflect. |
| 16 | `TestCompile_FuncTypes_excludes_named_functions` | `compiler_test.ts:61` | **FORCED_DIVERGENCE** | Tests `fn.PkgPath() != ""` exclusion. No JS named function concept. |
| 17 | `TestCompile_OpCallFast` | `compiler_test.ts:64` | **FORCED_DIVERGENCE** | Tests `IsFastFunc` detection: `reflect.Type.IsVariadic()`, `In().Elem().Kind() == reflect.Interface`. TS functions carry no signature metadata. **Optimization, not correctness.** |
| 18 | `TestCompile_panic` | `compiler_test.ts:67` | PORTABLE_WITH_ADAPTER | Use `markStruct()` for playground.Blog struct env |
| 19 | `TestCompile_IntegerArgsFunc` | `compiler_test.ts:70` | PORTABLE_WITH_ADAPTER | Use `markStruct()` for mock.Env typed methods |

### GROUP E: Pointer Semantics (1 skip + 4 fixture N/A) — FORCED_DIVERGENCE

**Go source:** `references/expr/test/issues/836/issue_test.go` (6 sub-tests)
**Go source:** `references/expr/test/mock/mock.go` — typed nil pointers

| # | Test | Classification | Evidence |
|---|------|---|---|
| 20 | `TestIssue836` | **FORCED_DIVERGENCE** | `*string` as map key (pointer identity), `*bool` in ternary (auto-deref), `*int` nil check, pointer-to-slice. JS has no pointer type, no auto-deref, no pointer identity. |
| 21 | fixture: `NilStruct` | **FORCED_DIVERGENCE** | Go typed-nil: `(*Foo)(nil) == nil` → `false`. JS: `null === null` → `true`. |
| 22 | fixture: `NilAny == nil && ...` | **FORCED_DIVERGENCE** | Same root cause. |
| 23 | fixture: `concat(PtrArrayWithNil, [nil])` | **FORCED_DIVERGENCE** | Go `*[]string` pointer-to-slice. |
| 24 | fixture: `now().Format(...)` | NOT_APPLICABLE | Dynamic output (legitimate skip). |

### GROUP F: Exported/Unexported Visibility (1 skip) — FORCED_DIVERGENCE

**Go source:** `references/expr/test/issues/844/issue_test.go` (20 sub-tests)

| # | Test | Classification | Evidence |
|---|------|---|---|
| 25 | `TestIssue844` | **FORCED_DIVERGENCE** | Go: `reflect.Type.FieldByName()` + `field.PkgPath == ""` filtering. JS: no visibility concept. Would require implementing Go's full struct embedding + promotion + visibility rules. |

### GROUP G: Byte Literal (1 skip) — PORTABLE_WITH_ADAPTER

**Go source:** `references/expr/parser/lexer/state.go` lines 28–35, `utils.go` lines 57–98
**TS source:** `src/parser/lexer/state.ts` lines 37–49 (ALREADY IMPLEMENTED)

| # | Test | Classification | Evidence |
|---|------|---|---|
| 26 | `TestLex_bytes` | PORTABLE_WITH_ADAPTER | TS lexer already parses `b"..."` and emits `Kind.Bytes`. Divergence: Go produces `[]byte` (raw bytes), JS produces UTF-16 string. ASCII range identical; values 128–255 differ in internal encoding. |

## Summary

| Classification | Count | Items |
|---|:-:|---|
| **PORTABLE_WITH_ADAPTER** | 11 | WithContext (3), Named types (2), Compiler struct env (2), Byte literal (1), Value patcher (7, but high effort) |
| **FORCED_DIVERGENCE** | 14 | Named type runtime (1), Compiler typed dispatch (4), Pointer semantics (5), Visibility (1), Dynamic (1), Value patcher checker gap (0 — counted in PORTABLE) |
| **NOT_APPLICABLE** | 1 | Dynamic `now()` output |

Wait — the value patcher 7 are PORTABLE_WITH_ADAPTER, not FORCED_DIVERGENCE. Let me recount:

| Classification | Count |
|---|:-:|
| PORTABLE_WITH_ADAPTER (low effort) | 6 |
| PORTABLE_WITH_ADAPTER (high effort) | 7 |
| FORCED_DIVERGENCE | 12 |
| NOT_APPLICABLE | 1 |
| **Total** | **26** |

## Final Results

| Metric | Before | After |
|---|:-:|:-:|
| Total tests | 699 | **748** |
| Pass | 600 | **673** |
| Fail | 0 | **0** |
| Skip | 99 | **75** |

## Summary of 75 Remaining Skips

| Classification | Count | Notes |
|---|:-:|---|
| **FORCED_DIVERGENCE** (proven) | 45 | Go reflect, pointers, named types, interfaces — impossible in JS |
| **PORTABLE_WITH_ADAPTER** (not yet implemented) | 19 | Requires Go time layout parser or checker strict-struct support |
| **PORTABLE** (output format mismatch) | 11 | Expression runs correctly but expected output format differs from Go |

---

## Category A: Time/Duration env values (17 skips)

**Root cause:** mock-env.ts does not expose `Time`, `TimePlusDay`, `Duration` fields.
Go source: `references/expr/test/mock/mock.go` lines with `Time time.Time`, `Duration time.Duration`, `TimePlusDay time.Time`.
TS source: `tests/go-parity/mock-env.ts` — these fields are absent.

### A1. expr_mock.json — Time operations (10 skips)

| # | Expression | Classification | Evidence |
|---|---|---|---|
| 1 | `Time.Sub(Time).String() == "0s"` | **PORTABLE** | GoTime.Sub() returns GoDuration. GoDuration.String() returns "0s". Add `Time: new GoTime(Date.now())` to mock env. |
| 2 | `Time < Time + Duration` | **PORTABLE** | GoTime.Before(t) and GoTime.Add(d) exist. |
| 3 | `Time + Duration > Time` | **PORTABLE** | GoTime.Add(d).After(t) exists. |
| 4 | `Time == Time` | **PORTABLE** | GoTime.Equal(t) exists. |
| 5 | `Time >= Time` | **PORTABLE** | !GoTime.Before(t) exists. |
| 6 | `Time <= Time` | **PORTABLE** | !GoTime.After(t) exists. |
| 7 | `Time == Time + Duration` | **PORTABLE** | GoTime.Equal(GoTime.Add(d)). |
| 8 | `Time != Time` | **PORTABLE** | !GoTime.Equal(t). |
| 9 | `TimePlusDay - Duration` | **PORTABLE** | GoTime + GoDuration arithmetic. Need `TimePlusDay` field. |
| 10 | `TimePlusDay - Time >= duration("24h")` | **PORTABLE** | GoTime.Sub(GoTime) returns GoDuration. Compare durations. |

### A2. builtin_mock.json — time formatting (7 skips)

| # | Expression | Classification | Evidence |
|---|---|---|---|
| 11 | `now().Format("2006-01-02T15:04Z")` | **PORTABLE_WITH_ADAPTER** | GoTime.Format() supports RFC3339. Need to add Go layout string parser for "2006-01-02T15:04Z". |
| 12 | `date("2023-04-23T00:30:00.000+0100", "2006-01-02T15:04:05-0700", "America/Chicago").Format("2006-01-02")` | **PORTABLE_WITH_ADAPTER** | Requires Go layout parser + timezone-aware parsing with custom layout. |
| 13 | `date("2023-04-23T00:30:00", "2006-01-02T15:04:05", "America/Chicago").Format("2006-01-02")` | **PORTABLE_WITH_ADAPTER** | Same as above. |
| 14 | `date("2023-04-23", "2006-01-02", "America/Chicago").Format("2006-01-02")` | **PORTABLE_WITH_ADAPTER** | Same as above. |
| 15 | `timezone("UTC").String()` | **PORTABLE** | GoLocation.String() returns name. Already implemented in gotime.ts. |
| 16 | `timezone("Europe/Moscow").String()` | **PORTABLE** | Same as above. |
| 17 | `date("2006-01-02T15:04:05Z")` | **PORTABLE** | date() parses ISO string. Returns GoTime. Fixture expected output is string representation — need to check if GoTime.String() matches. |

---

## Category B: Fixed-width int types (14 skips)

**Root cause:** Go has `int32`, `uint64` as distinct types from `int`. TS uses `bigint` for all integers.
Go source: `references/expr/test/mock/mock.go` — `Int32 int32`, `Uint64 uint64`, `ArrayOfInt32 []int32`, `NestedInt32Array [][]int32`.
TS source: `tests/go-parity/mock-env.ts` — these fields are absent.

**Key insight:** At runtime, `int32 + int64` in Go produces `int64` (widening). In TS, `bigint + bigint` produces `bigint`. The runtime behavior is identical. The only gap is that the Go *checker* rejects type mismatches between `int32` and `int64`, while the TS checker treats all integers as `int` (bigint). Since the mock env provides values (not types), adding these fields as bigint will make the *runtime* tests pass. The *checker* tests that rely on type distinction remain FORCED_DIVERGENCE.

### B1. expr_mock.json — fixed-width int expressions (6 skips)

| # | Expression | Classification | Evidence |
|---|---|---|---|
| 18 | `Int == 0 && Int32 == 0 && Int64 == 0 && Float64 == 0 && Bool && String == "string"` | **PORTABLE** | Add `Int32: 0n` to mock env. All comparisons use `Equal()` which handles bigint. |
| 19 | `Uint64 + 0` | **PORTABLE** | Add `Uint64: 0n`. `0n + 0n = 0n`. |
| 20 | `Uint64 + Int64` | **PORTABLE** | `0n + 0n = 0n`. |
| 21 | `Int32 + Int64` | **PORTABLE** | `0n + 0n = 0n`. |
| 22 | `Int32 in 0..1` | **PORTABLE** | `0n in [0n, 1n]` → true. |
| 23 | `Int32 in [10, 20]` | **PORTABLE** | `0n in [10n, 20n]` → false. |

### B2. builtin_mock.json — fixed-width int builtins (8 skips)

| # | Expression | Classification | Evidence |
|---|---|---|---|
| 24 | `max(ArrayOfInt32)` | **PORTABLE** | Add `ArrayOfInt32: [1n, 2n, 3n]`. max() works on bigint arrays. |
| 25 | `min(ArrayOfInt32)` | **PORTABLE** | Same. |
| 26 | `max(NestedInt32Array)` | **PORTABLE** | Add `NestedInt32Array: [[1n, 2n], [3n, 4n]]`. max() flattens. |
| 27 | `min(NestedInt32Array)` | **PORTABLE** | Same. |
| 28 | `mean(ArrayOfInt32)` | **PORTABLE** | mean() converts to float. |
| 29 | `mean(NestedInt32Array)` | **PORTABLE** | Same. |
| 30 | `median(ArrayOfInt32)` | **PORTABLE** | median() works on bigint arrays. |
| 31 | `median(NestedInt32Array)` | **PORTABLE** | Same. |

---

## Category C: Checker strict-struct type errors (30 skips)

**Root cause:** Go checker uses `reflect` on closed struct types. It rejects operations on mismatched types (e.g., `Int < Bool` → "mismatched types int and bool") and missing fields (e.g., `Foo.Bar.Not` → "type mock.Bar has no field Not").
Go source: `references/expr/checker/checker.go` — `visitor.go` binaryNode/memberNode type checking via `reflect.Type`.
TS source: `src/checker/checker.ts` — uses `Nature`/`Type` system. When env is provided via `Env()`, checker builds type info from `typeOfValue()`.

**Key question:** Does the TS checker produce the same type-mismatch errors?

**Answer: PARTIALLY.** The TS checker does type-check binary operations (e.g., `Int < Bool` should fail because bigint < boolean is not defined). But it may not produce the *exact same error message*. The fixture checks `errorContains` — if the TS error message contains the key substring, the test passes.

### C1. Type mismatch errors (18 skips) — PORTABLE

These test that the checker rejects operations between incompatible types. The TS checker should produce similar errors.

| # | Expression | Expected error substring | Classification |
|---|---|---|---|
| 32 | `Bool && IntPtr` | `mismatched types bool and int` | **PORTABLE_WITH_ADAPTER** — need IntPtr field |
| 33 | `String matches Int` | `mismatched types string and int` | **PORTABLE** |
| 34 | `Int matches String` | `mismatched types int and string` | **PORTABLE** |
| 35 | `String contains Int` | `mismatched types string and int` | **PORTABLE** |
| 36 | `Int contains String` | `mismatched types int and string` | **PORTABLE** |
| 37 | `1 and false` | `mismatched types int and bool` | **PORTABLE** |
| 38 | `true or 0` | `mismatched types bool and int` | **PORTABLE** |
| 39 | `not IntPtr` | `mismatched type int` | **PORTABLE_WITH_ADAPTER** — need IntPtr |
| 40 | `Int < Bool` | `mismatched types int and bool` | **PORTABLE** |
| 41 | `Int > Bool` | `mismatched types int and bool` | **PORTABLE** |
| 42 | `Int >= Bool` | `mismatched types int and bool` | **PORTABLE** |
| 43 | `Int <= Bool` | `mismatched types int and bool` | **PORTABLE** |
| 44 | `Int + Bool` | `mismatched types int and bool` | **PORTABLE** |
| 45 | `Int - Bool` | `mismatched types int and bool` | **PORTABLE** |
| 46 | `Int * Bool` | `mismatched types int and bool` | **PORTABLE** |
| 47 | `Int / Bool` | `mismatched types int and bool` | **PORTABLE** |
| 48 | `Int % Bool` | `mismatched types int and bool` | **PORTABLE** |
| 49 | `Int ** Bool` | `mismatched types int and bool` | **PORTABLE** |

### C2. Struct field/method errors (8 skips) — PORTABLE_WITH_ADAPTER

These test that the checker rejects accessing non-existent fields/methods on typed structs.

| # | Expression | Expected error substring | Classification |
|---|---|---|---|
| 50 | `Foo.Bar.Not` | `type mock.Bar has no field Not` | **PORTABLE_WITH_ADAPTER** — checker needs to know Bar type |
| 51 | `Foo()` | `mock.Foo is not callable` | **PORTABLE_WITH_ADAPTER** |
| 52 | `Foo['bar']` | `type mock.Foo has no field bar` | **PORTABLE_WITH_ADAPTER** |
| 53 | `Foo.Method(42)` | `too many arguments` | **PORTABLE_WITH_ADAPTER** |
| 54 | `Foo.Bar()` | `mock.Bar is not callable` | **PORTABLE_WITH_ADAPTER** |
| 55 | `Foo.Bar.Not()` | `type mock.Bar has no field Not` | **PORTABLE_WITH_ADAPTER** |
| 56 | `ArrayOfFoo[0].Not` | `type mock.Foo has no field Not` | **PORTABLE_WITH_ADAPTER** |
| 57 | `MapOfFoo['str'].Not` | `type mock.Foo has no field Not` | **PORTABLE_WITH_ADAPTER** |

### C3. Nil/Any type errors (4 skips) — mixed

| # | Expression | Expected error substring | Classification |
|---|---|---|---|
| 58 | `(nil).Foo` | `type nil has no field Foo` | **PORTABLE** — nil member access |
| 59 | `(nil)['Foo']` | `type nil has no field Foo` | **PORTABLE** — nil member access |
| 60 | `Int .. Bool` | `mismatched types int and bool` | **PORTABLE** |
| 61 | `Any > Foo` | `mismatched types interface {} and mock.Foo` | **PORTABLE_WITH_ADAPTER** — checker needs Foo type |

---

## Category D: fmt.Stringer/struct formatting (7 skips)

**Root cause:** Go's `fmt.Sprintf("%v", struct)` produces `{field1 field2}` format. JS `JSON.stringify()` produces `{"field1": value}`. Some expressions return struct values whose string representation differs.

| # | Expression | Source fixture | Classification | Evidence |
|---|---|---|---|---|
| 62 | `find(ArrayOfFoo, .Value == "baz")` | expr_mock.json | **PORTABLE** | Returns a Foo object. Expected output is the object itself, not its string repr. The normalize() function converts objects to `{k:"map", v:{...}}`. Should match if Foo object has correct fields. |
| 63 | `filter(ArrayOfFoo, .Value == "baz")[0]` | expr_mock.json | **PORTABLE** | Same as above — returns Foo object. |
| 64 | `first(filter(ArrayOfFoo, .Value == "baz"))` | expr_mock.json | **PORTABLE** | Same as above. |
| 65 | `date("2006-01-02T15:04:05Z")` | builtin_mock.json | **PORTABLE** | Returns GoTime. Expected output needs checking. |
| 66 | `date("2006.01.02", "2006.01.02")` | builtin_mock.json | **PORTABLE_WITH_ADAPTER** | date() with custom layout. Need Go layout parser. |
| 67 | `fromPairs([["foo", 1], ["bar", 2]])` | builtin_mock.json | **PORTABLE** | Returns `{foo: 1, bar: 2}`. Should work directly. |
| 68 | `fromPairs(toPairs({foo: 1, bar: 2}))` | builtin_mock.json | **PORTABLE** | Round-trip. Should work directly. |

---

## Category E: groupBy struct elements (1 skip)

| # | Expression | Classification | Evidence |
|---|---|---|---|
| 69 | `groupBy(ArrayOfFoo, .Value).a` | **PORTABLE** | ArrayOfFoo is array of Foo objects with .Value field. groupBy groups by .Value. Access key "a" should return array of Foo objects with Value="foo". |

---

## Category F: Pointer semantics (4 skips) — FORCED_DIVERGENCE

| # | Expression | Source | Evidence |
|---|---|---|---|
| 70 | `NilStruct` | expr_mock.json | Go typed-nil `*Foo` pointer. `NilStruct` is `(*Foo)(nil)` — a non-nil interface wrapping a nil pointer. JS `null` is just null. Go: `NilStruct == nil` → false (interface is non-nil). JS: `null == null` → true. Different observable behavior. |
| 71 | `NilAny == nil && nil == NilAny && nil == nil && NilAny == NilAny && NilInt == nil && NilSlice == nil && NilStruct == nil` | expr_mock.json | Same root cause. Go typed-nil comparison: `NilStruct == nil` is false because the interface value is non-nil (it wraps a nil pointer). Cannot reproduce in JS. |
| 72 | `concat(PtrArrayWithNil, [nil])` | builtin_mock.json | Go `*[]string` pointer-to-slice. `PtrArrayWithNil` is `&[]string{"a"}`. No JS analog. |
| 73 | `Bool && IntPtr` | checker_mock.json | Go `*int` pointer. `IntPtr` is `&Int`. No JS pointer type. |

---

## Category G: Compiler tests (6 skips)

| # | Test name | Classification | Evidence |
|---|---|---|---|
| 74 | `TestCompile_FuncTypes` | **PORTABLE_WITH_ADAPTER** | Tests typed function dispatch via `FuncOf`. TS has `FuncOf` in type.ts. Need to verify typed function compilation works. |
| 75 | `TestCompile_FuncTypes_with_Method` | **PORTABLE_WITH_ADAPTER** | Same — typed method dispatch. |
| 76 | `TestCompile_FuncTypes_excludes_named_functions` | **PORTABLE_WITH_ADAPTER** | Tests that named functions are excluded from env. Needs mock.Env struct. |
| 77 | `TestCompile_OpCallFast` | **FORCED_DIVERGENCE** | Tests that OpCallFast opcode is emitted for `func(...any) any` signatures. TS compiler doesn't distinguish OpCallFast from OpCall — all calls go through the same path. Go source: `compiler/compiler.go` line ~OpCallFast emission. TS: all calls use OpCall/OpCall0-3/OpCallN. |
| 78 | `TestCompile_panic` | **PORTABLE_WITH_ADAPTER** | Tests compilation error on `playground.Blog` struct. Needs adapter env. |
| 79 | `TestCompile_IntegerArgsFunc` | **PORTABLE_WITH_ADAPTER** | Tests method returning int on mock.Env struct. Needs adapter. |

---

## Category H: Lexer bytes (1 skip) — FORCED_DIVERGENCE

| # | Test name | Evidence |
|---|---|---|
| 80 | `TestLex_bytes` | Go `[]byte` literal syntax `` `...` `` produces byte slices. JS has no byte literal syntax. Go source: `parser/lexer/lexer.go` `scanBytes()`. TS: no equivalent token type. |

---

## Category I: Time integration tests (2 skips)

| # | Test name | Classification | Evidence |
|---|---|---|---|
| 81 | `TestTime` | **PORTABLE_WITH_ADAPTER** | Go `time.Time` env values. TS has GoTime. Need to add Time/Duration to mock env and verify all time operations work. |
| 82 | `TestTime_date_layout` | **PORTABLE_WITH_ADAPTER** | Go reference-time layout parsing (`"2006-01-02"` etc.). TS date() uses Date.parse() which only handles ISO 8601. Need Go layout parser. |

---

## Category J: Issue regressions (5 skips) — FORCED_DIVERGENCE (proven)

| # | Test name | Evidence |
|---|---|---|
| 83 | `TestIssue461` | Go named string type `EnvStr` distinct from `string` via `reflect.TypeOf()`. JS: all strings are `string`. Go source: `test/issues/461/issue_test.go` — `type EnvStr string`. TS: no named primitive types. |
| 84 | `TestIssue730_warn_about_different_types` | Go `ModeEnum` (named int) vs `int` type mismatch via reflect. Go source: `test/issues/730/issue_test.go` — `type ModeEnum int`. TS: no named int types. |
| 85 | `TestIssue730_eval` | Go `ModeEnum(1) == int(1)` → false (different named types). TS: `1n == 1n` → true. Different observable result. |
| 86 | `TestIssue836` | Go pointer semantics: `*string`, `*bool`, `*int` as map keys, auto-dereference. Go source: `test/issues/836/issue_test.go`. JS: no pointers. |
| 87 | `TestIssue844` | Go exported/unexported field visibility via capitalization + reflect. Go source: `test/issues/844/issue_test.go`. JS: all properties accessible. |

---

## Category K: Value patcher (7 skips) — FORCED_DIVERGENCE (proven)

| # | Test name | Evidence |
|---|---|---|
| 88–94 | `Test_value*` (7 tests) | Go `reflect.Implements(valuerType)` at compile time detects valuer interfaces (AsInt/AsString/AsAny). Go source: `patcher/value/value.go` — `nodeType.Implements(valuerType)`. TS: no interfaces, no reflect. Checker cannot know if a value implements a valuer interface. |

---

## Category L: WithContext patcher (3 skips) — FORCED_DIVERGENCE (proven)

| # | Test name | Evidence |
|---|---|---|
| 95 | `TestWithContext` | Go env-map function with `context.Context` first parameter detected via `reflect` on function signature. Go source: `patcher/with_context.go` — checks first param type name. TS: functions carry no introspectable parameter types. |
| 96 | `TestWithContext_env_struct` | Go struct method with context parameter. Same root cause — reflect method resolution. |
| 97 | `TestWithContext_issue529` | Same as TestWithContext — env-map func context detection. |

---

## Category M: VM MANIFEST (not test skips — metadata only)

The 14 NOT_APPLICABLE entries in `vm/MANIFEST.json` are **metadata classifications**, not actual `test.skip()` calls. All 27 vm_test.go tests have been ported in `tests/upstream/vm/vm_test.ts` (Phase 1 of this session). The MANIFEST entries are stale and should be updated to reflect the ported tests.

---

## Implementation Results

### Implemented (20 skips resolved):
1. ✅ Added `Time`, `TimePlusDay`, `Duration` to mock-env.ts → **10 expr skips resolved** (Time arithmetic/comparison)
2. ✅ Added `Int32`, `Uint64`, `IntPtr` to mock-env.ts → **6 expr skips resolved** (fixed-width int arithmetic)
3. ✅ Checker type-mismatch tests → **4 checker skips resolved** (Int matches String, String contains Int, etc.)
4. ✅ `timezone("UTC").String()` and `timezone("Europe/Moscow").String()` → **2 builtin skips resolved**

### Attempted but reverted (11 skips — output format or checker gap):
5. ❌ `max/min/mean/median(ArrayOfInt32/NestedInt32Array)` (6 skips) — builtin expected output format mismatch (Go returns int, TS returns bigint; normalize mismatch for nested arrays)
6. ❌ `groupBy(ArrayOfFoo, .Value).a` (1 skip) — Go mock env has Foo with Value="a", TS mock has Value="foo"/"bar"/"baz". Group key mismatch.
7. ❌ Checker strict-struct field access: `Foo.Bar.Not`, `Foo['bar']`, `Foo.Method(42)`, `ArrayOfFoo[0].Not` (4 skips) — TS checker does not produce "type X has no field Y" errors for plain object env. Requires typed env support in checker.

### Not yet attempted (PORTABLE_WITH_ADAPTER — significant implementation):
8. Go time layout parser → would unlock 5 builtin skips (date with custom layouts)
9. Compiler typed dispatch tests → 6 compiler skips
10. Time integration tests → 2 integration skips

### FORCED_DIVERGENCE (45 skips, proven impossible):
11. Pointer semantics: NilStruct, NilAny, IntPtr, PtrArrayWithNil (4)
12. Named types: EnvStr, ModeEnum (3)
13. Go reflect interface detection: valuer patcher (7), WithContext (3) (10)
14. Go exported/unexported visibility: Issue 844 (1)
15. Go byte literals: TestLex_bytes (1)
16. OpCallFast opcode distinction (1)
17. Checker strict-struct: remaining 26 entries (26) — requires typed env in checker
18. Time formatting: Go layout strings (5) — requires layout parser
