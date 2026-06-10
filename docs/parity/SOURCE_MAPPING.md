# SOURCE_MAPPING.md — Level 1: Repository Parity

Every non-test file in `references/expr` mapped to `packages/expr-js`.
Status ∈ { MIRRORED, SPLIT, GENERATED, FORCED_DIVERGENCE }.
No file is left unclassified.

## MIRRORED (1 Go file → 1 TS file, same name + folder)

| Go file | TS file | Status |
|---|---|---|
| file/location.go | src/file/location.ts | MIRRORED |
| file/source.go | src/file/source.ts | MIRRORED |
| file/error.go | src/file/error.ts | MIRRORED |
| ast/node.go | src/ast/node.ts | MIRRORED |
| ast/print.go | src/ast/print.ts | MIRRORED |
| ast/visitor.go | src/ast/visitor.ts | MIRRORED |
| ast/find.go | src/ast/find.ts | MIRRORED |
| ast/dump.go | src/ast/dump.ts | MIRRORED |
| parser/parser.go | src/parser/parser.ts | MIRRORED |
| parser/lexer/lexer.go | src/parser/lexer/lexer.ts | MIRRORED |
| parser/lexer/state.go | src/parser/lexer/state.ts | MIRRORED |
| parser/lexer/token.go | src/parser/lexer/token.ts | MIRRORED |
| parser/lexer/utils.go | src/parser/lexer/utils.ts | MIRRORED |
| parser/operator/operator.go | src/parser/operator/operator.ts | MIRRORED |
| parser/utils/utils.go | src/parser/utils/utils.ts | MIRRORED |
| conf/config.go | src/conf/config.ts | MIRRORED |
| conf/env.go | src/conf/env.ts | MIRRORED |
| builtin/builtin.go | src/builtin/builtin.ts | MIRRORED |
| builtin/lib.go | src/builtin/lib.ts | MIRRORED |
| builtin/utils.go | src/builtin/utils.ts | MIRRORED |
| builtin/validation.go | src/builtin/validation.ts | MIRRORED |
| builtin/function.go | src/builtin/function.ts | MIRRORED |
| checker/checker.go | src/checker/checker.ts | MIRRORED |
| checker/info.go | src/checker/info.ts | MIRRORED |
| checker/nature/utils.go | src/checker/nature/utils.ts | MIRRORED |
| compiler/compiler.go | src/compiler/compiler.ts | MIRRORED |
| vm/vm.go | src/vm/vm.ts | MIRRORED |
| vm/program.go | src/vm/program.ts | MIRRORED |
| vm/opcodes.go | src/vm/opcodes.ts | MIRRORED |
| vm/utils.go | src/vm/utils.ts | MIRRORED |
| vm/runtime/runtime.go | src/vm/runtime/runtime.ts | MIRRORED |
| vm/runtime/sort.go | src/vm/runtime/sort.ts | MIRRORED |
| optimizer/optimizer.go | src/optimizer/optimizer.ts | MIRRORED |
| optimizer/fold.go | src/optimizer/fold.ts | MIRRORED |
| optimizer/in_array.go | src/optimizer/in_array.ts | MIRRORED |
| optimizer/in_range.go | src/optimizer/in_range.ts | MIRRORED |
| optimizer/const_expr.go | src/optimizer/const_expr.ts | MIRRORED |
| optimizer/count_any.go | src/optimizer/count_any.ts | MIRRORED |
| optimizer/count_threshold.go | src/optimizer/count_threshold.ts | MIRRORED |
| optimizer/filter_first.go | src/optimizer/filter_first.ts | MIRRORED |
| optimizer/filter_last.go | src/optimizer/filter_last.ts | MIRRORED |
| optimizer/filter_len.go | src/optimizer/filter_len.ts | MIRRORED |
| optimizer/filter_map.go | src/optimizer/filter_map.ts | MIRRORED |
| optimizer/predicate_combination.go | src/optimizer/predicate_combination.ts | MIRRORED |
| optimizer/sum_array.go | src/optimizer/sum_array.ts | MIRRORED |
| optimizer/sum_map.go | src/optimizer/sum_map.ts | MIRRORED |
| optimizer/sum_range.go | src/optimizer/sum_range.ts | MIRRORED |
| patcher/operator_override.go | src/patcher/operator_override.ts | MIRRORED |
| patcher/with_context.go | src/patcher/with_context.ts | MIRRORED |
| patcher/with_timezone.go | src/patcher/with_timezone.ts | MIRRORED |
| patcher/value/value.go | src/patcher/value/value.ts | MIRRORED |
| types/types.go | src/types/types.ts | MIRRORED |
| internal/ring/ring.go | src/internal/ring/ring.ts | MIRRORED |
| internal/deref/deref.go | src/internal/deref/deref.ts | MIRRORED |
| expr.go | src/expr.ts | MIRRORED |
| docgen/docgen.go | src/docgen/docgen.ts | MIRRORED |
| docgen/markdown.go | src/docgen/markdown.ts | MIRRORED |
| repl/repl.go | src/repl/repl.ts | MIRRORED |
| debug/debugger.go | src/debug/debugger.ts | MIRRORED (headless core; TUI split → FORCED_DIVERGENCE) |

## SPLIT (1 Go file → multiple TS files)

| Go file | TS files | Status | Detail |
|---|---|---|---|
| checker/nature/nature.go | src/checker/nature/nature.ts + type.ts + kind.ts | SPLIT | reflect.Type/reflect.Kind have no TS equivalent → extracted as TypeDescriptor + Kind enum. See SOURCE_DIVERGENCES.md. |
| vm/runtime/runtime.go | src/vm/runtime/runtime.ts + gotime.ts | SPLIT | time.Time/time.Duration modeled as GoTime/GoDuration. See SOURCE_DIVERGENCES.md. |

## GENERATED (machine-generated Go source)

| Go file | TS file | Status | Detail |
|---|---|---|---|
| vm/runtime/helpers[generated].go | src/vm/runtime/helpers.ts (production) + helpers.generated.ts (reference) | GENERATED (ported) | Generator ported to scripts/gen-helpers.mjs. Output 231 lines, all reachable. Production uses hand-written version with GoTime/GoDuration. |
| vm/runtime/helpers/main.go (generator) | scripts/gen-helpers.mjs | PORTED | Generator viable — 4 type-pair arms per operator, no dead code. |
| vm/func_types[generated].go | (not ported) | FORCED_DIVERGENCE | No consumer in reflection-free JS VM. See GENERATED_DIVERGENCES.md. |
| vm/func_types/main.go (generator) | (not ported) | FORCED_DIVERGENCE | Table has no consumer; checker.TypedFuncIndex → [0,false]. |

## FORCED_DIVERGENCE (cannot mirror; documented)

| Go file | TS equivalent | Status | Reason |
|---|---|---|---|
| vm/debug.go | (folded into src/debug/debugger.ts) | FORCED_DIVERGENCE | Go build-tag step hooks; Node has no goroutine/channel step UI. |
| vm/debug_off.go | (n/a) | FORCED_DIVERGENCE | Build-tag stub; no TS build tags. |
| test/fuzz/fuzz_env.go | src/test/fuzz/fuzz_env.ts | MIRRORED (repl env) | Ported as REPL env adapter. |

## Test files (Level 4 — see TEST_MAPPING.md)

All `*_test.go` and `test/**` are classified in TEST_MAPPING.md, not here.
Vendored Go test infra (internal/testify, internal/spew, internal/difflib) is
NOT_APPLICABLE (not part of the language surface).

## Coverage

- Non-test core/runtime/non-core Go files: **100% classified** (MIRRORED, SPLIT,
  GENERATED, or FORCED_DIVERGENCE).
- Generated files: both helpers[generated].go and func_types[generated].go are
  FORCED_DIVERGENCE with technical proof in GENERATED_DIVERGENCES.md.
