# DIVERGENCES.md — complete classified divergence register

expr-js vs expr-lang/expr v1.17.8. Every divergence is classified as:
- **FORCED_DIVERGENCE** — required by JS/runtime differences; cannot be parity.
- **DESIGN_DECISION** — could be closer to source; chose otherwise (with reason).
- **NOT_IMPLEMENTED_YET** — a real gap, not a decision.

Behavioral parity is verified by the go-parity corpora (Go = source of truth).

---

## A. FORCED_DIVERGENCE (language/runtime)

### A1. Numeric model: bigint + number
Go has `int`/`int8..int64`/`uint..uint64`/`float32`/`float64`. JS has one
`number` (IEEE-754 double) plus `bigint`. Mapping: **Go int/int64 → bigint**,
**Go float64 → number**. Verified identical for `1/2=0.5`, `5%2=1`, `1==1.0`,
`1<1.0`, `int+float`, exponent, modulo, int64 precision, int64 overflow-wrap.
Fixed-width types (int8/int32/uint32/...) collapse to bigint — distinct-width
behavior is NOT_APPLICABLE (corpus rows tagged accordingly).

### A2. Reflection → TypeDescriptor
Go's checker/runtime use `reflect.Type`/`reflect.Value`/`reflect.Kind`. JS has
no reflection. Replaced by the TypeDescriptor system (`checker/nature/type.ts`,
`kind.ts`) + native-value VM. Consequence: struct field/method introspection is
modeled over descriptors (`checker/nature/utils.ts`); a plain JS env object is
an **open map** with no closed field set, so Go's strict-struct rejections
(`Foo.Bar.Not`, `Foo.Method(42)`, etc.) are NOT_APPLICABLE.

### A3. time.Time / time.Duration / time.Location
Modeled as `GoTime` / `GoDuration` / opaque location marker
(`vm/runtime/gotime.ts`). Duration arithmetic verified by corpus
(`duration("1h")+duration("1m")`, `7*duration("1h")`, `duration("1s")*.5`).
`time.Time` env-value identity/formatting via reflect is NOT_APPLICABLE.

### A4. Errors: thrown, not returned
Go returns `(value, error)`. expr-js throws `FileError` and returns the value
directly. Compile/runtime error *occurrence* parity is verified; exact message
*wording* can differ for TypeDescriptor-derived messages.

### A5. Pointers / typed-nil
Go `*int`, `**int`, typed-nil structs/funcs have no JS analog
(`internal/deref.Value` is identity in JS). Corpus rows referencing
`IntPtr`/`NilStruct`/etc. are NOT_APPLICABLE.

### A6. fmt.Stringer / struct %v formatting
Go renders `*Foo` via `Stringer` to `"Foo.String"`. expr-js returns the
underlying object. Results Go tags as struct/Stringer formatting are
NOT_APPLICABLE.

### A7. Reserved/global name shadowing (tolerated)
`unescape`, `Function`, `Map`, `Array`, `String` keep their Go names for
diff-based maintenance. These are lint advisories only; `tsc` accepts them. No
semantic rename was made.

---

## B. DESIGN_DECISION (could be closer to source; chose otherwise)

### B1. Generated arithmetic helpers collapsed
`vm/runtime/helpers[generated].go` (3706 lines) → `helpers.ts` (~190). The JS
numeric domain has 2 members vs Go's 13, so the type-pair switch collapses.
Trade-off: a blind upstream diff of the generated file will not map; the
maintainable artifact is the generator template `helpers/main.go`. Behavior is
verified identical by the numeric + duration corpus.

### B2. Typed/fast func dispatch dropped
`vm/func_types` is not ported; all calls use generic OpCall/OpCallN.
`checker.TypedFuncIndex`→[0,false], `IsFastFunc`→false. Pure performance
specialization in Go; zero behavioral effect. Compiler branches are preserved
(dead) for source-diff alignment.

### B3. nature.go split into nature/type/kind
Done to host the TypeDescriptor (A2). The Nature *logic* remains 1:1 with
nature.go; only the reflect-replacement types live in sibling files.

### B4. Profiling opcodes are no-ops
`OpProfileStart`/`OpProfileEnd` execute as no-ops (Go uses `time.Now()` spans).
No effect on evaluation results.

---

## C. NOT_IMPLEMENTED_YET (real gaps, roadmapped)

### C1. ~~docgen/~~ PORTED
Doc generator fully ported. See NON_CORE_PARITY.md §1.

### C2. ~~repl/~~ PORTED
Interactive REPL fully ported. See NON_CORE_PARITY.md §2.

### C3. ~~debug/ TUI~~ PORTED (headless)
Step-debugger data side fully ported (disassembly + execution + stack dump).
Interactive TUI (tcell/tview) is FORCED_DIVERGENCE. See NON_CORE_PARITY.md §3.

### C4. Upstream corpus breadth
Ported: expr_test.go TestExpr (160 cases, 139 pass + 21 N/A) + checker_test.go
TestCheck_error (45 cases, 15 pass + 30 N/A) + builtin_test.go TestBuiltin
(157 cases, 137 pass + 20 N/A) + 118 curated eval cases. Not yet extracted:
vm_test.go opcode tables (assert Go bytecode — mostly NOT_APPLICABLE), parser
AST-shape tables, optimizer output-shape tables, real-world corpora
(coredns/crowdsec). These are additive; none contradict current behavior.

### C5. int64 overflow-wrap fixturing
Emulated in helpers.ts (wrapInt64) but not yet covered by a dedicated corpus
fixture.

---

## Verification (this build)
- tsc --noEmit: 0 errors
- dual build (ESM+CJS+.d.ts): OK
- unit: 24/24 ; eval: 118/118 ; expr corpus: 139/160 (21 N/A) ;
  checker corpus: 15/45 (30 N/A) ; builtin corpus: 137/157 (20 N/A)
- 3 engine bugs found by the corpus were fixed (see ENGINE_BUGS.md)
