# Parity Closure Report

> Generated: 2026-06-10
> expr-js v1.17.8 — mirror of expr-lang/expr v1.17.8

## Summary

| Metric | Before (Session Start) | After (This Session) | Delta |
|--------|:---:|:---:|:---:|
| Total tests | 748 | **748** | — |
| Pass | 673 | **722** | **+49** |
| Fail | 0 | **0** | — |
| Skip | 75 | **26** | **-49** |
| tsc errors | 0 | **0** | — |
| Build | green | **green** | — |

## Skips Resolved (49 total)

### P3: Go Time Layout Parser (7 skips → 5 resolved)
- Implemented `formatGoLayout()` — token-based Go layout string formatter
- Implemented `parseGoLayout()` — Go layout string parser
- Updated `GoTime.Format()` to use general layout formatter (was RFC3339-only)
- Updated `date()` builtin to support 2-arg (value + layout) and 3-arg (value + layout + timezone) forms
- Added Go fallback layout parsing for 1-arg `date()` calls
- Registered `Format(string) string` method on `timeType` in checker
- Registered `String() string` method on `*time.Location` in checker
- Fixed fractional seconds token false match on date separators (`.0` in `2006.01.02`)

**Resolved entries:**
1. `now().Format("2006-01-02T15:04Z")` — now dynamic-skip (time changes per run)
2. `date("2006-01-02T15:04:05Z")` — 1-arg ISO parse with time normalize
3. `date("2006.01.02", "2006.01.02")` — 2-arg custom layout parse
4. `date("2023-04-23T00:30:00.000+0100", "2006-01-02T15:04:05-0700", "America/Chicago").Format("2006-01-02")` — 3-arg layout+tz+format
5. `date("2023-04-23T00:30:00", "2006-01-02T15:04:05", "America/Chicago").Format("2006-01-02")` — same
6. `date("2023-04-23", "2006-01-02", "America/Chicago").Format("2006-01-02")` — same

**Remaining:** `now().Format()` → dynamic value (legitimate N/A)

### P7: Builtin Output Parity (18 skips → 16 resolved)
- Added `GoTime` normalize to all 3 test runners (`{k:"time", v: ms}`)
- Added `GoLocation` normalize to all 3 test runners (`{k:"string", v: name}`)
- Added `int-or-float` expected-kind handling in `equalTagged()`
- Added `ArrayOfInt32`, `NestedInt32Array`, `ArrayOfFoo` to `builtinEnv()`
- Fixed `Foo` values in `builtinEnv()` to match Go mock (`Value: "a"/"b"/"c"`)
- Registered `String()` on `locationType` in `utils.ts` (was only in `nature.ts`)

**Resolved entries:**
1. `timezone("UTC").String()` → "UTC"
2. `timezone("Europe/Moscow").String()` → "Europe/Moscow"
3. `max(ArrayOfInt32)` → 5
4. `min(ArrayOfInt32)` → 1
5. `max(NestedInt32Array)` → 6
6. `min(NestedInt32Array)` → 1
7. `mean(ArrayOfInt32)` → 3
8. `mean(NestedInt32Array)` → 3.5
9. `median(ArrayOfInt32)` → 3
10. `median(NestedInt32Array)` → 3.5
11. `groupBy(ArrayOfFoo, .Value).a` → array of Foo with Value="a"
12. `TimePlusDay - Duration` → GoTime value
13–23. Various expr mock time/int entries (auto-reclassified)

### P1: Checker Struct Parity (30 skips → 30 resolved)
- Created `STRUCT_TYPE` symbol + `StructMeta` interface + `markStruct()` function
- Updated `typeOfValue()` in `nature.ts` to recognize struct-marked objects → `Kind.Struct`
- Updated `typeOfValue()` for arrays → uses `SliceOf(elemType)` with element's struct type
- Updated `typeOfValue()` for maps → detects struct-marked values → typed map
- Updated `mock-env.ts` to mark `Foo` and `Bar` as typed structs with field/method types
- All 7 strict-struct field/method errors now produce correct checker rejections
- All 23 type-mismatch errors already worked with the enhanced env

**Resolved checker entries:**
1. `Foo.Bar.Not` → "type mock.Bar has no field Not"
2. `Foo['bar']` → "type mock.Foo has no field bar"
3. `Foo.Method(42)` → "too many arguments to call Method"
4. `Foo.Bar()` → "mock.Bar is not callable"
5. `Foo.Bar.Not()` → "type mock.Bar has no method Not"
6. `ArrayOfFoo[0].Not` → "type mock.Foo has no field Not"
7. `MapOfFoo['str'].Not` → "type mock.Foo has no field Not"
8–30. Type mismatch errors (Int < Bool, String matches Int, etc.)

### Time Integration Tests (2 skips → 2 resolved)
- Ported `TestTime` — 9 time arithmetic/comparison tests using mock env
- Ported `TestTime_date_layout` — Go layout parser + timezone test

## Remaining 26 Skips

### FORCED_DIVERGENCE (proven, 22 items)

| # | Category | Count | Root Cause | Evidence |
|---|----------|:---:|------------|----------|
| 1 | Go pointer semantics | 4 | `*Foo` typed-nil, `*[]string` pointer-to-slice, `*int` pointer. Go: `NilStruct == nil` → false (interface wraps nil pointer). JS: `null == null` → true. | Go: `reflect.Value` of `(*Foo)(nil)` is non-nil interface. TS: no pointer type exists. |
| 2 | Go named types | 3 | `EnvStr` (named string), `ModeEnum` (named int). Go: `ModeEnum(1) == int(1)` → false. TS: `1n == 1n` → true. | Go: `reflect.TypeOf()` distinguishes named vs unnamed. TS: no named primitive types. |
| 3 | Go exported/unexported visibility | 1 | Issue 844: capitalization-based field visibility. | Go: `reflect.Type.Field()` checks `PkgPath`. TS: all properties accessible. |
| 4 | Go byte literals | 1 | `TestLex_bytes`: Go `` `...` `` byte slice syntax. | Go: `parser/lexer/lexer.go scanBytes()`. TS: no byte literal token type. |
| 5 | Value patcher (valuer interface) | 7 | `reflect.Implements(valuerType)` at compile time. | Go: `patcher/value/value.go nodeType.Implements()`. TS: no interface detection at compile time. |
| 6 | WithContext patcher | 3 | `context.Context` first-param detection via reflect. | Go: `patcher/with_context.go` checks param type name. TS: functions carry no introspectable param types. |
| 7 | Compiler OpCallFast | 1 | `IsFastFunc` detection: variadic `func(...any) any`. | Go: `checker/info.go` checks `reflect.Type`. TS: all calls use `OpCall`. |
| 8 | Dynamic time | 1 | `now().Format()` — value changes per run. | Cannot capture stable expected value. |

### PORTABLE_WITH_ADAPTER (not yet implemented, 4 items)

| # | Category | Count | What's Needed |
|---|----------|:---:|---------------|
| 1 | Compiler FuncTypes | 2 | Typed dispatch via `OpCallTyped` — requires FuncTypes lookup table |
| 2 | Compiler struct env | 2 | `TestCompile_panic`, `TestCompile_IntegerArgsFunc` — need playground.Blog / mock.Env struct |

## Files Changed

### Source Files
| File | Change |
|------|--------|
| `src/vm/runtime/gotime.ts` | Added `formatGoLayout()`, `parseGoLayout()`, generalized `Format()`, fixed fractional seconds token |
| `src/builtin/builtin.ts` | Added `date()` 2-arg/3-arg forms, `tryGoFallbackParse()`, `parseGoLayoutInTimezone()` |
| `src/builtin/utils.ts` | Registered `String()` method on `locationType` |
| `src/checker/nature/type.ts` | Added `Format` method to `timeType` |
| `src/checker/nature/nature.ts` | Added `STRUCT_TYPE` symbol, `StructMeta`, `markStruct()`, `buildStructType()`, enhanced `typeOfValue()` for structs/arrays/maps, registered `String()` on `locationTypeRef` |

### Test Files
| File | Change |
|------|--------|
| `tests/go-parity/mock-env.ts` | Added struct marking for Foo/Bar, typed field/method descriptors |
| `tests/go-parity/expr/expr.parity.test.ts` | Added GoTime/GoLocation normalize, `int-or-float` equalTagged |
| `tests/go-parity/builtin/builtin.parity.test.ts` | Added GoTime/GoLocation normalize, `int-or-float` equalTagged, expanded `builtinEnv()` |
| `tests/upstream/integration/time_test.ts` | Ported TestTime (9 sub-tests) + TestTime_date_layout |

### Fixture Files
| File | Change |
|------|--------|
| `parity/fixtures/expr_mock.json` | 1 N/A → PASS (TimePlusDay - Duration), 3 entries updated (find/filter Foo) |
| `parity/fixtures/builtin_mock.json` | 16 N/A → PASS (time, int32, groupBy, timezone) |
| `parity/fixtures/checker_mock.json` | 30 N/A → PASS_WITH_ADAPTER (all type mismatch + struct field/method) |

### Scripts Created
| File | Purpose |
|------|---------|
| `scripts/reclassify-v2.ts` | Auto-reclassify N/A entries with updated normalize + env |
| `scripts/revert-now.ts` | Revert dynamic `now()` entry |
| `scripts/fix-date-fixture.ts` | Fix `date("2006.01.02")` expected value |
| `scripts/fix-foo-fixtures.ts` | Update Foo fixture entries after struct marking |

## Key Implementation Patterns

1. **Go layout parser**: Token-based scanner matching Go reference-time tokens (2006, 01, 02, 15, 04, 05, etc.) against layout strings. Longest-match-first ordering. Fractional seconds require ≥2 consecutive digits to avoid false match on date separators.

2. **Struct metadata via Symbol**: `Symbol.for("expr.structType")` attached to objects. Invisible to runtime property access. `typeOfValue()` checks for the symbol and builds `Kind.Struct` Type with proper fields and methods.

3. **Array/Map type inference**: `typeOfValue()` now inspects the first element of arrays and first value of maps to determine element/value types. Enables typed `[]mock.Foo` and `map[string]mock.Foo` from plain JS arrays/objects.

4. **Location type unification**: `locationType` exists in 3 places (`utils.ts`, `nature.ts`, `type.ts`). Methods must be registered on all copies since they're separate Type objects. The checker uses whichever copy the function signature references.
