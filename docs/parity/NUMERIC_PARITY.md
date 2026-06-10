# NUMERIC_PARITY.md — Level 7: Numeric semantics audit

Reference: `vm/runtime/helpers[generated].go` (Go) vs
`src/vm/runtime/helpers.ts` (TS). Target = **Expr semantics**, not JavaScript
semantics.

Model: Go `int`/`int64` → JS `bigint`; Go `float64` → JS `number`.

## Verified side-by-side (Go engine vs expr-js, identical expressions)

| Expression | Go (type) | TS (type) | Verdict |
|---|---|---|---|
| `1/2` | `0.5` float64 | `0.5` number | IDENTICAL |
| `5/2` | `2.5` float64 | `2.5` number | IDENTICAL |
| `5%2` | `1` int | `1` bigint | IDENTICAL |
| `1 == 1.0` | `true` | `true` | IDENTICAL |
| `1 < 1.0` | `false` | `false` | IDENTICAL |
| `1 + 1.0` | `2` float64 | `2` number | IDENTICAL |
| `2 + 3.5` | `5.5` float64 | `5.5` number | IDENTICAL |

## Operator-by-operator (from helpers source)

| Op | Go rule (helpers[generated].go) | TS rule (helpers.ts) | Verdict |
|---|---|---|---|
| `+` Add | int+int→int; any float→float64; string+string; time+dur; dur+dur | bigint+bigint→bigint(int64-wrap); else number; string; GoTime/GoDuration | IDENTICAL |
| `-` Subtract | int-int→int; float→float64; time-time→dur; time-dur; dur-dur | same | IDENTICAL |
| `*` Multiply | cases_with_duration: float operand → float64; int → int/dur | bigint*bigint→bigint; float→number; dur*int→dur; dur*float→float64 | IDENTICAL (fixed this program) |
| `/` Divide | ALWAYS `float64(x)/float64(y)` for every numeric pair | `toF(a)/toF(b)` always number | IDENTICAL |
| `%` Modulo | integer-only (`cases_int_only`); returns int | bigint-only; throws on float; bigint % bigint | IDENTICAL |
| `**` Exponent | `math.Pow(ToFloat64,ToFloat64)` → float64 | `Math.pow(...)` → number | IDENTICAL |
| `==` Equal | per-type pair equality; DeepEqual fallback | numeric→toF compare; arrays/maps deep | IDENTICAL |
| `<` `>` `<=` `>=` | per-type compare; string; time; duration | numeric→toF; string; GoTime; GoDuration | IDENTICAL |

## Differences (classified)

| Aspect | Go | TS | Class | Reason |
|---|---|---|---|---|
| int representation | int/int64 (+ int8/16/32, uint*) | single bigint | FORCED_DIVERGENCE | JS has no fixed-width ints; bigint preserves int64 semantics + precision |
| int64 overflow | wraps (2's complement) | emulated via `wrapInt64` | IDENTICAL (behavior) | explicit modular wrap in helpers.ts |
| fixed-width distinctions (int8/int32/uint32) | distinct types | all collapse to bigint | FORCED_DIVERGENCE | corpus cases referencing Int32/Uint64 are N/A (see NA_AUDIT) |
| float | float32/float64 distinct | single number (float64) | FORCED_DIVERGENCE | JS number is IEEE-754 double only |

## Conclusion

- **All 7 operator families are semantically IDENTICAL to Expr** (not JS):
  integer division yields float, modulo is integer-only, mixed int/float
  compares promote, exponent is float64, int64 precision preserved.
- The only divergence is **representation** (bigint vs Go's 11 integer types),
  which is FORCED by the JS numeric model and does not change results for the
  int/int64/float64 domain that Expr actually exercises.
- Evidence: numeric corpus (20) + expr corpus duration/arithmetic cases, all
  generated from the Go engine.
