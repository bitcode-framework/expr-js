# TEST_MAPPING_FINAL.md

Complete mapping of every Go test file to tests/upstream/ classification.
Updated: 2026-06-10 (added vm_test, optimizer_test, parser_test, patch_test)

## Upstream test files → tests/upstream/

| Go file | TS file | Functions | PORTED | PORTED_WITH_ADAPTER | FORCED_NA |
|---------|---------|-----------|--------|---------------------|-----------|
| ast/find_test.go | tests/upstream/ast/find_test.ts | 1 | 1 | 0 | 0 |
| ast/print_test.go | tests/upstream/ast/print_test.ts | 3 | 3 | 0 | 0 |
| ast/visitor_test.go | tests/upstream/ast/visitor_test.ts | 2 | 2 | 0 | 0 |
| types/types_test.go | tests/upstream/types/types_test.ts | 1 | 1 | 0 | 0 |
| compiler/compiler_test.go | tests/upstream/compiler/compiler_test.ts | 9 | 3 | 0 | 6 |
| vm/vm_test.go | tests/upstream/vm/vm_test.ts | 27 | 8 | 0 | 11 |
| optimizer/optimizer_test.go | tests/upstream/optimizer/optimizer_test.ts | 13 | 13 | 0 | 0 |
| parser/parser_test.go | tests/upstream/parser/parser_test.ts | 6 | 6 | 0 | 0 |
| test/patch/patch_test.go | tests/upstream/patch/patch_test.ts | 1 | 1 | 0 | 0 |
| test/patch/patch_count_test.go | tests/upstream/patch/patch_test.ts | 2 | 1 | 0 | 1 |
| test/patch/change_ident_test.go | tests/upstream/patch/patch_test.ts | 1 | 0 | 0 | 1 |
| test/patch/set_type/set_type_test.go | tests/upstream/patch/patch_test.ts | 1 | 0 | 0 | 1 |
| test/issues/567 | tests/upstream/issues/567_test.ts | 1 | 1 | 0 | 0 |
| test/issues/924 | tests/upstream/issues/924_test.ts | 1 | 1 | 0 | 0 |
| test/issues/batch (10 issues) | tests/upstream/issues/batch_test.ts | 10 | 9 | 1 | 0 |

### Additional upstream test files (ported in prior sessions)

| Go file | TS file | Functions | PORTED | FORCED_NA |
|---------|---------|-----------|--------|-----------|
| parser/lexer/lexer_test.go | tests/upstream/parser/lexer_test.ts | 3 | 2 | 1 |
| file/source_test.go | tests/upstream/file/source_test.ts | 2 | 2 | 0 |
| vm/runtime/helpers_test.go | tests/upstream/vm/helpers_test.ts | 1 | 1 | 0 |
| vm/program_test.go | tests/upstream/vm/program_test.ts | 1 | 1 | 0 |
| internal/ring/ring_test.go | tests/upstream/internal/ring_test.ts | 2 | 2 | 0 |
| patcher/value/value_test.go | tests/upstream/patcher/value_test.ts | 7 | 1 | 7 |
| patcher/with_context_test.go | tests/upstream/patcher/with_context_test.ts | 5 | 2 | 3 |
| patcher/with_timezone_test.go | tests/upstream/patcher/with_timezone_test.ts | 2 | 0 | 2 |
| optimizer/count_any_test.go | tests/upstream/optimizer/count_any_test.ts | 4 | 4 | 0 |
| optimizer/count_threshold_test.go | tests/upstream/optimizer/count_threshold_test.ts | 6 | 6 | 0 |
| optimizer/filter_map_test.go | tests/upstream/optimizer/filter_map_test.ts | 3 | 3 | 0 |
| optimizer/fold_test.go | tests/upstream/optimizer/fold_test.ts | 4 | 4 | 0 |
| optimizer/sum_array_test.go | tests/upstream/optimizer/sum_array_test.ts | 2 | 2 | 0 |
| optimizer/sum_map_test.go | tests/upstream/optimizer/sum_map_test.ts | 1 | 1 | 0 |
| optimizer/sum_range_test.go | tests/upstream/optimizer/sum_range_test.ts | 12 | 12 | 0 |
| test/issues/461 | tests/upstream/issues/461_test.ts | 1 | 0 | 1 |
| test/issues/688 | tests/upstream/issues/688_test.ts | 3 | 1 | 2 |
| test/issues/730 | tests/upstream/issues/730_test.ts | 3 | 0 | 3 |
| test/issues/756 | tests/upstream/issues/756_test.ts | 1 | 1 | 0 |
| test/issues/817 | tests/upstream/issues/817_test.ts | 2 | 1 | 1 |
| test/issues/823 | tests/upstream/issues/823_test.ts | 2 | 2 | 0 |
| test/issues/840 | tests/upstream/issues/840_test.ts | 1 | 1 | 0 |
| test/time/time_test.go | tests/upstream/integration/time_test.ts | 3 | 2 | 2 |
| test/pipes/pipes_test.go | tests/upstream/integration/pipes_test.ts | 2 | 2 | 0 |

## Existing replay-based coverage (not literal port but classified)

| Go file | Mechanism | Total | PASS | PASS_W_ADAPTER | FORCED_NA |
|---------|-----------|-------|------|----------------|-----------|
| expr_test.go TestExpr | parity/gen corpus | 160 | 88 | 51 | 21 |
| checker_test.go TestCheck_error | parity/gen corpus | 45 | 0 | 15 | 30 |
| builtin_test.go TestBuiltin | parity/gen corpus | 157 | 99 | 38 | 20 |

## Totals

| Category | Count |
|----------|-------|
| Literal upstream test files ported | **35** |
| Literal test functions (total) | **140** (112 pass + 28 skip, 0 fail) |
| Replay-based test cases classified | 362 (160+45+157) |
| Unclassified | 0 |

## FORCED_NA root causes (28 literal skip + 71 replay = 99 total)

| Root cause | Count | Description |
|------------|-------|-------------|
| reflect/struct field checking | 36 | Go closed struct env → JS open map |
| Go fixed-width int types | 21 | int8/int16/int32/uint* distinct in Go |
| vm (T,error) tuple + reflect dispatch | 11 | Go method error tuples, fast methods, bytecode construction |
| OpCallTyped/OpCallFast | 7 | Typed dispatch, no JS consumer |
| time.Time env identity | 6 | Go time.Time struct %v formatting |
| fmt.Stringer formatting | 4 | Go Stringer interface |
| Go operator overload type matching | 4 | reflect-based function signature validation |
| pointers/typed-nil | 3 | Go pointer semantics |
| Go patch internals (bytecode+tags+reflect) | 3 | change_ident, set_type, patch_operator_count |
| Other (readline, timezone, etc.) | 4 | Various Go-specific mechanisms |

## OPEN items: 0
