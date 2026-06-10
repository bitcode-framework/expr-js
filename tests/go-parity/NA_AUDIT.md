# NA_AUDIT.md — Priority D: consolidated NOT_APPLICABLE audit

Every NOT_APPLICABLE item across all corpora, with source, test, reason, and
classification. No N/A exists without a specific reason.

Classification key: all N/A items are **FORCED_DIVERGENCE** (no JS analog),
unless marked otherwise.

---

## expr corpus (21 N/A) — source: expr_test.go TestExpr

| Expr (representative) | Reason |
|---|---|
| `Int == 0 && Int32 == 0 && Int64 == 0 ...` | Go fixed-width int types distinct from int |
| `Uint64 + 0`, `Uint64 + Int64` | Go fixed-width unsigned type distinct from int |
| `Int32 + Int64`, `Int32 in 0..1`, `Int32 in [10,20]` | Go fixed-width int type distinct from int |
| `Time.Sub(Time).String() == "0s"` | Go time.Time env value identity/formatting via reflect |
| `NilStruct`, `NilAny == nil && ... NilStruct == nil` | Go typed-nil pointer struct has no JS analog |
| `Time < Time + Duration`, `Time + Duration > Time`, `Time == Time`, `Time >= Time`, `Time <= Time`, `Time == Time + Duration`, `Time != Time` | Go time.Time env value not modeled in JS mock env |
| `TimePlusDay - Duration`, `TimePlusDay - Time >= duration("24h")` | Go time.Time env value not modeled in JS mock env |
| `find(ArrayOfFoo, .Value == "baz")`, `filter(ArrayOfFoo,...)[0]`, `first(filter(ArrayOfFoo,...))` | Go fmt.Stringer/struct %v formatting (reflect) |

Root causes: A1 (fixed-width numerics), A3 (time.Time env identity), A5
(typed-nil), A6 (Stringer formatting).

## checker corpus (30 N/A) — source: checker_test.go TestCheck_error

| Category | Count | Reason |
|---|---|---|
| `Foo.Bar.Not`, `Foo()`, `Foo['bar']`, `Foo.Method(42)`, `Foo.Bar()`, `Foo.Bar.Not()`, `ArrayOfFoo[0].Not`, `MapOfFoo['str'].Not` | 8 | Go strict-struct field/method checking (reflect); JS env objects are open maps |
| `Int < Bool`, `Int > Bool`, `Int + Bool`, ... (all numeric op Bool), `Int .. Bool`, `Any > Foo` | ~14 | Same: requires Go reflect type-mismatch detection on a closed env type |
| `Bool && IntPtr`, `not IntPtr` | 2 | Go pointer type + strict checking |
| `String matches Int`, `Int matches String`, `String contains Int`, `Int contains String` | 4 | Go strict operand typing via reflect |
| `(nil).Foo`, `(nil)['Foo']`, `1 and false`, `true or 0` | 4 | Go strict type checking on closed env |

Root cause: A2 (reflection → TypeDescriptor) + the JS-env-is-open-map property.
expr-js's checker correctly accepts these for an open JS object env; Go rejects
them because it knows the struct's closed field set and field types via reflect.

## builtin corpus (20 N/A) — source: builtin_test.go TestBuiltin

| Category | Count | Reason |
|---|---|---|
| `max/min/mean/median(ArrayOfInt32 / NestedInt32Array)` | 8 | Go fixed-width int32 distinct from int |
| `now().Format(...)`, `date(...).Format(...)` (×3), `timezone(...).String()` (×2) | 6 | Go time-layout formatting / *time.Location String() not modeled |
| `date("...Z")`, `date("2006.01.02","2006.01.02")` | 2 | Go time.Time struct %v formatting (reflect) |
| `fromPairs([...])`, `fromPairs(toPairs({...}))` | 2 | Result is a Go map rendered via %v; key-order/Stringer formatting |
| `groupBy(ArrayOfFoo, .Value).a` | 1 | Go struct elements (reflect field access) |
| `concat(PtrArrayWithNil, [nil])` | 1 | Go pointer-to-slice has no JS analog |

## vm MANIFEST (14 N/A) — source: vm_test.go

All hand-built-bytecode or reflect-method tests: method error-tuples (A4),
fast-method reflect dispatch, tagged-field reflect, profiling no-ops (B4),
typed-call tables (B2), reflect arg-count validation (A2). See vm/MANIFEST.json.

## examples/testdata (2 N/A) — source: testdata/

| Item | Reason |
|---|---|
| testdata/generated.txt (test/gen) | Go-native fuzzer output referencing Go-typed env; fuzzing is Go-native |
| testdata/crash.txt (FuzzExpr seed) | Go fuzz-crash regression seed; no JS analog |

---

## Totals

| Corpus | N/A count | All have reason? |
|---|---|---|
| expr | 21 | yes |
| checker | 30 | yes |
| builtin | 20 | yes |
| vm | 14 | yes |
| parser/lexer | 0 | n/a (PASS / PASS_WITH_ADAPTER only) |
| optimizer | 0 | n/a (PASS / PASS_WITH_ADAPTER only) |
| examples/testdata | 2 | yes |
| **Total** | **87** | **yes — no unexplained N/A** |

Every N/A traces to exactly one forced root cause: A1 numeric width, A2
reflection, A3 time identity, A4 error tuples, A5 pointers, A6 Stringer, B2
typed dispatch, B4 profiling, or Go-native fuzzing. See DIVERGENCES.md.
