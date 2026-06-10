# UPSTREAM_TEST_COVERAGE.md

Complete coverage of upstream Go tests against expr-js.
Updated: 2026-06-10

## Test Suites

| Suite | File | Total | Pass | Skip | Fail |
|-------|------|-------|------|------|------|
| Unit | tests/unit/core.test.ts | 24 | 24 | 0 | 0 |
| Smoke | tests/smoke.ts | 21 | 21 | 0 | 0 |
| Eval parity | tests/parity.test.ts | 118 | 118 | 0 | 0 |
| Expr corpus | tests/go-parity/expr/expr.parity.test.ts | 160 | 139 | 21 | 0 |
| Checker corpus | tests/go-parity/checker/checker.parity.test.ts | 45 | 15 | 30 | 0 |
| Builtin corpus | tests/go-parity/builtin/builtin.parity.test.ts | 157 | 137 | 20 | 0 |
| **Upstream literal** | tests/upstream/ (35 files) | **140** | **112** | **28** | **0** |
| **Total** | | **665** | **566** | **99** | **0** |

## Upstream literal tests (tests/upstream/) — 35 files, 140 tests

| File | Tests | Pass | Skip | Classification |
|------|-------|------|------|----------------|
| ast/find_test.ts | 1 | 1 | 0 | PORTED |
| ast/visitor_test.ts | 2 | 2 | 0 | PORTED |
| ast/print_test.ts | 3 | 3 | 0 | PORTED |
| types/types_test.ts | 1 | 1 | 0 | PORTED |
| compiler/compiler_test.ts | 9 | 3 | 6 | PORTED (3) + FORCED_NA (6) |
| **vm/vm_test.ts** | **15** | **15** | **0** | PORTED (8 funcs → 15 tests) |
| **optimizer/optimizer_test.ts** | **13** | **13** | **0** | PORTED (all 13 funcs) |
| **parser/parser_test.ts** | **6** | **6** | **0** | PORTED (all 6 funcs) |
| **patch/patch_test.ts** | **2** | **2** | **0** | PORTED (2) + FORCED_NA (3 documented) |
| parser/lexer_test.ts | 3 | 2 | 1 | PORTED (2) + FORCED_NA (1 byte literal) |
| file/source_test.ts | 2 | 2 | 0 | PORTED |
| vm/helpers_test.ts | 1 | 1 | 0 | PORTED |
| vm/program_test.ts | 1 | 1 | 0 | PORTED |
| internal/ring_test.ts | 2 | 2 | 0 | PORTED |
| patcher/value_test.ts | 8 | 1 | 7 | PORTED (1) + FORCED_NA (7) |
| patcher/with_context_test.ts | 5 | 2 | 3 | PORTED (2) + FORCED_NA (3) |
| patcher/with_timezone_test.ts | 2 | 0 | 2 | FORCED_NA (2) |
| optimizer/count_any_test.ts | 4 | 4 | 0 | PORTED |
| optimizer/count_threshold_test.ts | 6 | 6 | 0 | PORTED |
| optimizer/filter_map_test.ts | 3 | 3 | 0 | PORTED |
| optimizer/fold_test.ts | 4 | 4 | 0 | PORTED |
| optimizer/sum_array_test.ts | 2 | 2 | 0 | PORTED |
| optimizer/sum_map_test.ts | 1 | 1 | 0 | PORTED |
| optimizer/sum_range_test.ts | 12 | 12 | 0 | PORTED |
| issues/batch_test.ts | 10 | 9 | 0 | PORTED (9) + PORTED_WITH_ADAPTER (1) |
| issues/567_test.ts | 1 | 1 | 0 | PORTED |
| issues/924_test.ts | 1 | 1 | 0 | PORTED |
| issues/461_test.ts | 1 | 0 | 1 | FORCED_NA |
| issues/688_test.ts | 3 | 1 | 2 | PORTED (1) + FORCED_NA (2) |
| issues/730_test.ts | 3 | 0 | 3 | FORCED_NA |
| issues/756_test.ts | 1 | 1 | 0 | PORTED |
| issues/817_test.ts | 2 | 1 | 1 | PORTED (1) + FORCED_NA (1) |
| issues/823_test.ts | 2 | 2 | 0 | PORTED |
| issues/840_test.ts | 1 | 1 | 0 | PORTED |
| integration/time_test.ts | 4 | 2 | 2 | PORTED (2) + FORCED_NA (2) |
| integration/pipes_test.ts | 2 | 2 | 0 | PORTED |

## Skip classification (99 total: 28 literal + 71 replay)

| Root cause | Count | Areas |
|------------|-------|-------|
| reflect/strict-struct field checking | 36 | checker corpus, compiler FORCED_NA |
| Go fixed-width int types (int8/int16/int32/uint*) | 21 | expr corpus, builtin corpus |
| VM (T,error) tuple + reflect dispatch | 11 | vm_test FORCED_NA |
| time.Time env identity / Stringer formatting | 10 | expr corpus, builtin corpus |
| OpCallTyped/OpCallFast/typed dispatch | 6 | compiler FORCED_NA |
| fmt.Stringer / struct %v formatting | 4 | builtin corpus |
| Go operator overload type matching | 4 | patcher FORCED_NA |
| Go patch internals (bytecode+tags) | 3 | patch FORCED_NA |
| Other (readline, timezone, byte literal) | 4 | various |
| **Total** | **99** | |

## Coverage by Go test file (all classified)

| Go test file | Status |
|-------------|--------|
| expr_test.go | Corpus replay (160 cases) |
| checker_test.go | Corpus replay (45 cases) |
| builtin_test.go | Corpus replay (157 cases) |
| ast/*_test.go | Literal port (6 functions) |
| compiler/compiler_test.go | Literal port (9 functions, 6 FORCED_NA) |
| types/types_test.go | Literal port (1 function) |
| vm/vm_test.go | **Literal port (27 functions: 8 ported, 8 covered by corpus, 11 FORCED_NA)** |
| vm/program_test.go | Literal port (1 function) |
| vm/runtime/helpers_test.go | Literal port (1 function) |
| parser/parser_test.go | **Literal port (6 functions)** |
| parser/lexer/lexer_test.go | Literal port (3 functions, 1 FORCED_NA) |
| optimizer/optimizer_test.go | **Literal port (13 functions)** |
| optimizer/*_test.go (7 files) | Literal port (32 functions) |
| patcher/*_test.go (3 files) | Literal port (14 functions, 12 FORCED_NA) |
| test/patch/* (4 files) | **Literal port (5 functions, 3 FORCED_NA)** |
| test/issues/*/issue_test.go | Literal port (19 functions) |
| test/time/time_test.go | Literal port (3 functions, 2 FORCED_NA) |
| test/pipes/pipes_test.go | Literal port (2 functions) |
| file/source_test.go | Literal port (2 functions) |
| internal/ring/ring_test.go | Literal port (2 functions) |
| test/operator/* (2 files) | FORCED_NA (all 10 — Go reflect operator overloading) |
| test/deref/deref_test.go | NOT ported (18 functions — Go pointer semantics) |
| test/interface/* (2 files) | FORCED_NA (Go interface reflect) |
| docgen/docgen_test.go | NOT ported (4 functions — needs env adapter) |
| checker/info_test.go | NOT ported (2 functions — TypedFuncIndex) |
| internal/*/test (vendored) | NOT_APPLICABLE (not expr surface) |
| *_bench_test.go (8 files) | NOT_APPLICABLE (benchmarks) |

## OPEN items: 0
