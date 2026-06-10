# GENERATED_SOURCE_AUDIT.md — Priority C

Audit of every upstream file that is currently **collapsed / merged / split /
rewritten** in expr-js, with a parity decision for each.

For each: (1) can it be made closer to source? (2) must it stay diverged?
(3) maintenance impact for upstream upgrades.

---

## 1. vm/runtime/helpers[generated].go  (3706 lines → src/vm/runtime/helpers.ts ~190)

**What it is:** Go generates `Equal/Less/More/LessOrEqual/MoreOrEqual/Add/
Subtract/Multiply/Divide/Modulo` as an exhaustive `switch` over every pair of
Go numeric types (5 ints × 5 uints × 2 floats + time.Duration), produced by the
template in `vm/runtime/helpers/main.go` (305 lines).

**(1) Can it be parity-closer?** Not meaningfully. The Go file is *machine
output*; its size comes solely from Go having 13 numeric types. JavaScript has
exactly two members in the expr numeric domain: `bigint` (all Go ints/uints,
int64 semantics) and `number` (all Go floats, float64). The 169 type-pair cases
therefore collapse to 4 rules per operator. Reproducing the 3706-line switch in
TS would require inventing 11 phantom numeric types that JS cannot represent —
strictly worse, not closer.

**(2) Must it stay collapsed?** Yes. **FORCED_DIVERGENCE.** The collapse is a
direct consequence of the numeric-model divergence (DIVERGENCES A1), itself
forced by JS having no fixed-width integers.

**(3) Maintenance impact:** The artifact to diff on upstream upgrades is the
**generator template** `helpers/main.go`, NOT the generated output. If upstream
changes an operator rule (e.g. how float promotion works), it changes the
template; the equivalent TS change is a one-rule edit in `helpers.ts`. Mapping
guide is documented inline in helpers.ts. Behavioral equivalence is enforced by
the numeric (20) + expr-duration corpus cases.

---

## 2. vm/func_types[generated].go  (365 lines) + vm/func_types/main.go (157)

**What it is:** Generated tables of concrete Go function signatures
(`func() int`, `func(int) int`, ...) used by `OpCallTyped` for reflection-free
fast dispatch of common function shapes.

**(1) Can it be parity-closer?** No. The tables exist purely to avoid Go
`reflect.Value.Call` overhead by matching a call against a precompiled typed
thunk. JavaScript calls functions directly (`fn(...args)`) with zero reflection
cost, so there is nothing to specialize.

**(2) Must it stay un-ported?** Yes. **FORCED_DIVERGENCE.** The TS compiler's
`checker.TypedFuncIndex` returns `[0,false]` and `IsFastFunc` returns `false`,
so `OpCallTyped`/`OpCallFast` are never selected; all calls route through the
generic `OpCall`/`OpCallN` (which in JS is already optimal). The compiler
branches are preserved as dead code for source-diff alignment.

**(3) Maintenance impact:** None. Upstream changes to func_types are a pure
performance concern with zero behavioral effect; they require no TS change.
Documented as DESIGN_DECISION B2 + FORCED_DIVERGENCE in DIVERGENCES.md.

---

## 3. checker/nature/nature.go  (509 → nature.ts) + SPLIT into type.ts + kind.ts

**What it is:** The Nature type-introspection model. Go embeds `reflect.Type`
and `reflect.Kind` directly.

**(1) Can it be parity-closer?** The Nature *logic* is already 1:1 with
nature.go (every method ported with the same name and control flow). The split
only extracts the reflect-replacement primitives (`Type` descriptor, `Kind`
enum) into sibling files, because TS cannot embed `reflect.Type`.

**(2) Classification:** **FORCED_DIVERGENCE (SPLIT).** Two extra files
(type.ts, kind.ts) host what Go gets from the `reflect` package.

**(3) Maintenance impact:** Low. Upstream nature.go changes map directly to
nature.ts; only changes that touch `reflect.Type`/`Kind` surface touch
type.ts/kind.ts. Documented in FILE_MAPPING.md.

---

## 4. vm/runtime/runtime.go  (402 → runtime.ts) + SPLIT into gotime.ts

**What it is:** Runtime helpers (Fetch/In/Slice/conversions). Go uses
`time.Time`/`time.Duration` inline.

**(1) Can it be parity-closer?** runtime.ts mirrors runtime.go function-for-
function. The split extracts `GoTime`/`GoDuration` (Go's `time` package types)
into gotime.ts.

**(2) Classification:** **FORCED_DIVERGENCE (SPLIT).** JS has no `time` package.

**(3) Maintenance impact:** Low; time behavior is isolated in gotime.ts.

---

## 5. conf/env.go merged → previously folded into config.ts (NOW un-merged)

**Status this program:** Un-merged into `src/conf/env.ts` (mirrored). No longer
a divergence. Resolved.

---

## Summary

| File | Decision | Closer-to-source possible? |
|---|---|---|
| helpers[generated].go | FORCED_DIVERGENCE (collapsed) | No — JS has 2 numeric types |
| func_types[generated].go | FORCED_DIVERGENCE (not ported) | No — no reflection cost in JS |
| nature.go (→+type.ts+kind.ts) | FORCED_DIVERGENCE (split) | Logic already 1:1 |
| runtime.go (→+gotime.ts) | FORCED_DIVERGENCE (split) | Logic already 1:1 |
| conf/env.go | RESOLVED (now mirrored) | Done |

**No collapsed/split/merged file can be brought closer to source without
introducing JS-impossible constructs.** All are FORCED_DIVERGENCE, each with a
documented diff-maintenance path (track the generator/template, not the output).
