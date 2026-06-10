# ENGINE_BUGS.md — defects found by the upstream parity corpus

The go-parity corpus (Go = source of truth) exposed real engine defects.
These were genuine parity bugs (two ported components disagreeing, or a
mistranslation of Go semantics), not new features. All are now fixed; this file
records them for traceability.

## Fixed

### 1. `in` over a constant array threw `cannot use int as field name`
- Symptom: `1 in [1,2,3]`, `-1 not in [1]`, `1 in [1.5]` threw at runtime.
- Root cause: the `inArray` optimizer (`src/optimizer/in_array.ts`) rewrites a
  constant `x in [..]` into a `ConstantNode` holding a JS `Set` (mirroring Go's
  `map[T]struct{}`), but `runtime.In` (`src/vm/runtime/runtime.ts`) had no `Set`
  branch — it fell through to the object path and threw.
- Fix: added a `Set` membership branch to `runtime.In`, matching Go's
  `reflect.Map.MapIndex` membership semantics.
- Evidence: expr corpus cases `1 in [1.5] || 1 not in [1]`, `-1 not in [1]`,
  and the `"Bar" in Foo` compound now pass.

### 2. Env methods rejected with "func X doesn't return value"
- Symptom: `Add(10, 5) + GetInt()`, `Variadic(0)`, and any call to a function
  supplied via the env failed type-checking.
- Root cause: `typeOfValue` (`src/checker/nature/nature.ts`) modeled a JS
  function as a `func` Type with **zero** outputs, so the checker concluded the
  call returns nothing. JS functions carry no introspectable signature.
- Fix: model an env function as variadic `func(...any) any` (one any result),
  which is exactly how Go treats a function registered without explicit Types.
- Evidence: `Add(...)`, `GetInt()`, `Variadic(...)`, and the multi-statement
  `let ...; Add(...); ...` cases now pass.

### 3. `duration * float` returned a duration instead of float64
- Symptom: `duration("1s") * .5` produced a `GoDuration` instead of `float64`.
- Root cause: `Multiply` (`src/vm/runtime/helpers.ts`) truncated the float
  operand to a bigint and kept the result a duration. Go's generated
  `cases_with_duration` promotes the whole expression to `float64` when either
  operand is a float (float precedence > duration), and keeps a duration only
  for integer operands.
- Fix: in `Multiply`, a float operand on a duration yields `Number(ns) * f`
  (float64); an integer operand keeps the duration.
- Evidence: `duration("1s") * .5` now matches Go's `5e8` float64.

## Notes
- All three are now covered by the expr corpus
  (`tests/go-parity/expr/expr.parity.test.ts`, 139/139 pass) which is generated
  from the upstream `TestExpr` table via `parity/gen/expr_mock.go`.
- Verification after fixes: `tsc --noEmit` clean; original parity 118/118;
  unit 24/24; expr corpus 139/139 (21 NOT_APPLICABLE).
