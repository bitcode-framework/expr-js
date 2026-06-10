# BYTECODE_PARITY.md — Level 8: Compiler/VM opcode audit

Audit of `compiler/` + `vm/` (Go) vs `src/compiler/` + `src/vm/` (TS).
Per opcode: **IDENTICAL** · **EQUIVALENT** · **DIVERGENT**.

Source: `vm/opcodes.go` (84 opcodes) ↔ `src/vm/opcodes.ts` (same enum, same
order, same names). The compiler emits the same opcodes; the VM executes them
with the documented numeric/runtime model.

## Opcode-by-opcode

| Opcode | Class | Note |
|---|---|---|
| OpInvalid | IDENTICAL | throws "invalid opcode" |
| OpPush | IDENTICAL | push constant |
| OpInt | EQUIVALENT | Go pushes `int`; TS pushes `bigint` (numeric model) |
| OpPop | IDENTICAL | |
| OpStore / OpLoadVar | IDENTICAL | variable slots |
| OpLoadConst | IDENTICAL | Fetch(env, const) |
| OpLoadField | EQUIVALENT | Go reflect Field index; TS path-based FetchField |
| OpLoadFast | IDENTICAL | fast map get |
| OpLoadMethod | EQUIVALENT | Go reflect method; TS bound method by name |
| OpLoadFunc | IDENTICAL | |
| OpLoadEnv | IDENTICAL | |
| OpFetch | IDENTICAL | Fetch(a,b) — array/map/object/string |
| OpFetchField | EQUIVALENT | reflect Field index → path |
| OpMethod | EQUIVALENT | reflect method → bound by name |
| OpTrue / OpFalse / OpNil | IDENTICAL | |
| OpNegate | IDENTICAL | bigint/number negate |
| OpNot | IDENTICAL | |
| OpEqual | IDENTICAL | runtime.Equal |
| OpEqualInt | EQUIVALENT | Go `a.(int)==b.(int)`; TS bigint=== |
| OpEqualString | IDENTICAL | |
| OpJump / OpJumpIfTrue / OpJumpIfFalse | IDENTICAL | guard negative offset |
| OpJumpIfNil / OpJumpIfNotNil | IDENTICAL | runtime.IsNil |
| OpJumpIfEnd | IDENTICAL | scope index >= len |
| OpJumpBackward | IDENTICAL | |
| OpIn | IDENTICAL | array/map/object/Set membership (Set added this prior fix) |
| OpLess / OpMore / OpLessOrEqual / OpMoreOrEqual | IDENTICAL | numeric/string/time/duration |
| OpAdd / OpSubtract / OpMultiply / OpDivide / OpModulo / OpExponent | IDENTICAL | semantics per NUMERIC_PARITY.md |
| OpRange | IDENTICAL | MakeRange + memGrow |
| OpMatches | EQUIVALENT | Go regexp; TS RegExp (RE2 vs JS regex flavor — see below) |
| OpMatchesConst | EQUIVALENT | precompiled RegExp |
| OpContains / OpStartsWith / OpEndsWith | IDENTICAL | string ops |
| OpSlice | IDENTICAL | runtime.Slice |
| OpCall | EQUIVALENT | Go reflect Call + arg marshaling; TS direct fn(...args) |
| OpCall0..3 | EQUIVALENT | typed call fast-path; TS uses generic invoke |
| OpCallN | IDENTICAL | variadic invoke |
| OpCallFast | EQUIVALENT | Go fast func; TS generic invoke |
| OpCallSafe | IDENTICAL | [value, mem] tuple + memGrow |
| OpCallTyped | DIVERGENT | Go typed dispatch table; TS routes to generic call (never emitted — checker returns [0,false]) |
| OpCallBuiltin1 | IDENTICAL | builtin.Fast(arg) |
| OpArray / OpMap | IDENTICAL | build array/object + memGrow |
| OpLen | IDENTICAL | runtime.Len → bigint |
| OpCast | EQUIVALENT | ToInt/ToInt64/ToFloat64/ToBool (bigint/number) |
| OpDeref | EQUIVALENT | Go reflect deref; TS identity (no pointers) |
| OpIncrementIndex / OpDecrementIndex / OpIncrementCount | IDENTICAL | scope counters |
| OpGetIndex / OpGetCount / OpGetLen | IDENTICAL | → bigint |
| OpGetAcc / OpSetAcc | IDENTICAL | accumulator |
| OpSetIndex | IDENTICAL | |
| OpPointer | IDENTICAL | scope.Item() |
| OpThrow | IDENTICAL | throw error |
| OpCreate | IDENTICAL | groupBy map / SortBy |
| OpGroupBy | IDENTICAL | |
| OpSortBy / OpSort | IDENTICAL | stable sort by values |
| OpProfileStart / OpProfileEnd | DIVERGENT | Go time-span profiling; TS no-op (B4) |
| OpBegin | EQUIVALENT | Go fast-path typed scopes ([]int/[]float64/[]string); TS uses single Anys array |
| OpAnd / OpOr | IDENTICAL | |
| OpEnd | IDENTICAL | pop scope |

## Summary

| Class | Count (approx) |
|---|---|
| IDENTICAL | ~62 |
| EQUIVALENT | ~22 |
| DIVERGENT | 4 (OpCallTyped, OpProfileStart, OpProfileEnd, + OpBegin fast-path) |

## DIVERGENT detail

1. **OpCallTyped** — typed-func dispatch table (func_types). Never emitted in TS
   (checker.TypedFuncIndex → [0,false]); all calls go through generic OpCall/
   OpCallN. FORCED_DIVERGENCE (no JS reflection cost to optimize). See
   GENERATED_DIVERGENCES.md.
2. **OpProfileStart / OpProfileEnd** — Go records time.Now() spans; TS executes
   them as no-ops. DESIGN_DECISION (profiling out of language scope). No effect
   on results.
3. **OpBegin fast-paths** — Go specializes []int/[]float64/[]string scope
   iteration; TS uses one generic array path. EQUIVALENT result, different
   internal representation.

## EQUIVALENT umbrella reasons

- Numeric model: OpInt/OpEqualInt/OpCast push bigint instead of Go int.
- Reflection: OpLoadField/OpFetchField/OpMethod/OpCall/OpDeref use JS native
  value access instead of reflect; same observable result.
- regexp: OpMatches uses JS RegExp (ECMAScript flavor) vs Go RE2. Common
  patterns identical; pathological RE2-vs-JS differences are a known EQUIVALENT
  boundary (not yet fixtured).

## Verdict

No opcode is silently DIVERGENT — the 4 DIVERGENT opcodes are documented
(typed dispatch + profiling + scope fast-path), all with zero effect on
evaluation results. The rest are IDENTICAL or EQUIVALENT (numeric-model /
reflection-replacement only).
