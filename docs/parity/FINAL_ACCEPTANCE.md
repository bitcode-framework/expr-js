# FINAL_ACCEPTANCE.md — Level 9

Honest status against the Level 9 acceptance criteria. Per your rule, the phrase
"full parity achieved" is **NOT** claimed — residual divergences are reported
explicitly below.

## Report inventory (all 9 present)

| Level | Report | Path |
|---|---|---|
| 1 | SOURCE_MAPPING.md | packages/expr-js/SOURCE_MAPPING.md |
| 2 | SOURCE_DIVERGENCES.md | packages/expr-js/SOURCE_DIVERGENCES.md |
| 3 | GENERATED_DIVERGENCES.md | packages/expr-js/GENERATED_DIVERGENCES.md |
| 4 | TEST_MAPPING.md | packages/expr-js/TEST_MAPPING.md |
| 5 | NON_CORE_PARITY.md | packages/expr-js/NON_CORE_PARITY.md |
| 6 | CHECKER_PARITY.md | packages/expr-js/CHECKER_PARITY.md |
| 7 | NUMERIC_PARITY.md | packages/expr-js/NUMERIC_PARITY.md |
| 8 | BYTECODE_PARITY.md | packages/expr-js/BYTECODE_PARITY.md |
| supporting | NA_AUDIT, ENGINE_BUGS, MANIFESTs | packages/expr-js/tests/go-parity/ |

## Acceptance criteria — honest scorecard

| # | Criterion | Status | Evidence / gap |
|---|---|---|---|
| 1 | All upstream files mapped | MET | SOURCE_MAPPING.md classifies every non-test Go file |
| 2 | All upstream tests classified | MET | TEST_MAPPING.md + MANIFESTs; no unclassified test |
| 3 | All generated source audited | MET | GENERATED_DIVERGENCES.md (helpers + func_types, with proof) |
| 4 | All divergences documented | MET | SOURCE_/GENERATED_DIVERGENCES, NUMERIC, BYTECODE, CHECKER, NON_CORE, NA_AUDIT |
| 5 | No un-analyzed area | MET | every package + test area has a report or MANIFEST |
| 6 | No "out of scope" without technical reason | MET | debug TUI, func_types, helpers collapse — each has a proof |
| 7 | All 9 markdown reports available | MET | inventory above (all 9 + supporting) |

## Test totals (this build)

| Suite | Total | Pass | Skip (FORCED_NA) | Fail |
|---|---|---|---|---|
| Unit (core.test.ts) | 24 | 24 | 0 | 0 |
| Smoke (smoke.ts) | 21 | 21 | 0 | 0 |
| Eval parity (parity.test.ts) | 118 | 118 | 0 | 0 |
| Expr parity (expr_test.go replay) | 160 | 139 | 21 | 0 |
| Checker parity (checker_test.go replay) | 45 | 15 | 30 | 0 |
| Builtin parity (builtin_test.go replay) | 157 | 137 | 20 | 0 |
| Upstream literal (35 files) | 140 | 112 | 28 | 0 |
| **Total** | **665** | **566** | **99** | **0** |

All 99 skipped tests are classified FORCED_NA (root causes: reflect, struct tags,
fmt.Stringer, Go-specific type system, Go operator overload type matching,
Go bytecode construction — see UPSTREAM_TEST_COVERAGE.md).

## Residual divergences (explicit — these are why "full parity" is NOT claimed)

### FORCED_DIVERGENCE (no JS analog — cannot be closed)
1. Numeric representation: Go's 11 integer types → JS bigint; float32/64 → number.
   (NUMERIC_PARITY.md) — semantics identical, representation forced.
2. Reflection: reflect.Type/Value/Kind → TypeDescriptor. Drives checker
   strict-struct N/A (30 cases) + OpLoadField/Method EQUIVALENT.
3. time.Time/Duration/Location → GoTime/GoDuration/marker; time-layout
   formatting (.Format, timezone().String()) not modeled.
4. func_types typed dispatch: not ported (no consumer in reflection-free JS VM).
5. debug TUI (tview/tcell): headless equivalent provided; interactive widget
   navigation not portable. (NON_CORE_PARITY.md — 8 features)
6. docgen PkgPath: Go resolves via reflect.TypeOf().PkgPath(); JS has no
   package path concept. Impact: type appendix names use descriptor name.
7. REPL history persistence: Go saves to ~/.expr_history; Node readline does
   not persist across sessions.

### DESIGN_DECISION (could be closer; chosen otherwise with reason)
8. helpers[generated].go collapsed (not generated): a ported generator emits
   unreachable per-int-width cases (proof in GENERATED_DIVERGENCES.md).
9. OpProfileStart/End are no-ops (profiling out of language scope).

### NOT_IMPLEMENTED_YET (real open work toward stricter parity)
10. **Remaining literal 1:1 test ports**: test/deref/deref_test.go (18 functions — Go pointer semantics, mostly FORCED_NA), test/operator/operator_test.go (9 functions — all FORCED_NA: Go reflect operator overloading), checker/info_test.go (2 functions), docgen/docgen_test.go (4 functions — needs env adapter). The largest files (vm_test.go 27 funcs, optimizer_test.go 13 funcs, parser_test.go 6 funcs) are DONE this session.
11. **builtin.ts / checker.ts / compiler.ts line-level diffability**: method- and
    file-aligned, but some reflect-dependent bodies are rewritten, so a few are
    not strictly line-diffable. (SOURCE_DIVERGENCES.md residual)
12. **Real-world corpora** (coredns, crowdsec, examples.md) are PASS_WITH_ADAPTER
    candidates needing env adapters — not yet wired.

## Verification (this build)
- tsc --noEmit: 0 errors
- dual build (ESM+CJS+.d.ts): OK
- unit 24/24 · smoke 21/21 · eval 118/118 · expr 139/160 · checker 15/45 · builtin 137/157
- upstream literal: 112/140 (28 skip, 0 fail)
- 0 failures across all suites

## Verdict (honest)

**All 9 parity reports are present and consistent.** Source-parity maximum is
substantially met for Levels 1–3, 5, 6, 7, 8 and the classification half of
Level 4. Level 4 (literal per-test ports) and parts of Level 2 (line-level
diffability of reflect-heavy files) have explicit NOT_IMPLEMENTED_YET items
(#10–12). Level 5 (non-core) documents 11 FORCED_DIVERGENCE features across
docgen/repl/debug, all with technical proofs.

This is **maintenance-oriented source parity with documented, reasoned
residuals** — NOT "full parity achieved".

**OPEN count: 0** (no unclassified files, tests, opcodes, or features).
**NOT_IMPLEMENTED_YET count: 3** (#10, #11, #12 — all explicit above).
