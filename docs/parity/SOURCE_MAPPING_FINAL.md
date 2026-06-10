# SOURCE_MAPPING_FINAL.md

Complete mapping of every non-test Go file in references/expr to packages/expr-js.
Status ∈ { MIRRORED, SPLIT, GENERATED, FORCED_DIVERGENCE }.

## Summary

| Status | Count |
|--------|-------|
| MIRRORED | 55 |
| SPLIT | 2 |
| GENERATED (ported) | 1 (helpers) |
| FORCED_DIVERGENCE | 4 |
| **Total** | **62** |

## MIRRORED (1:1)

ast/node.go → src/ast/node.ts
ast/print.go → src/ast/print.ts
ast/visitor.go → src/ast/visitor.ts
ast/find.go → src/ast/find.ts
ast/dump.go → src/ast/dump.ts
parser/parser.go → src/parser/parser.ts
parser/lexer/lexer.go → src/parser/lexer/lexer.ts
parser/lexer/state.go → src/parser/lexer/state.ts
parser/lexer/token.go → src/parser/lexer/token.ts
parser/lexer/utils.go → src/parser/lexer/utils.ts
parser/operator/operator.go → src/parser/operator/operator.ts
parser/utils/utils.go → src/parser/utils/utils.ts
conf/config.go → src/conf/config.ts
conf/env.go → src/conf/env.ts
builtin/builtin.go → src/builtin/builtin.ts
builtin/lib.go → src/builtin/lib.ts
builtin/utils.go → src/builtin/utils.ts
builtin/validation.go → src/builtin/validation.ts
builtin/function.go → src/builtin/function.ts
checker/checker.go → src/checker/checker.ts
checker/info.go → src/checker/info.ts
checker/nature/utils.go → src/checker/nature/utils.ts
compiler/compiler.go → src/compiler/compiler.ts
vm/vm.go → src/vm/vm.ts
vm/program.go → src/vm/program.ts
vm/opcodes.go → src/vm/opcodes.ts
vm/utils.go → src/vm/utils.ts
vm/runtime/runtime.go → src/vm/runtime/runtime.ts
vm/runtime/sort.go → src/vm/runtime/sort.ts
optimizer/optimizer.go → src/optimizer/optimizer.ts
optimizer/fold.go → src/optimizer/fold.ts
optimizer/in_array.go → src/optimizer/in_array.ts
optimizer/in_range.go → src/optimizer/in_range.ts
optimizer/const_expr.go → src/optimizer/const_expr.ts
optimizer/count_any.go → src/optimizer/count_any.ts
optimizer/count_threshold.go → src/optimizer/count_threshold.ts
optimizer/filter_first.go → src/optimizer/filter_first.ts
optimizer/filter_last.go → src/optimizer/filter_last.ts
optimizer/filter_len.go → src/optimizer/filter_len.ts
optimizer/filter_map.go → src/optimizer/filter_map.ts
optimizer/predicate_combination.go → src/optimizer/predicate_combination.ts
optimizer/sum_array.go → src/optimizer/sum_array.ts
optimizer/sum_map.go → src/optimizer/sum_map.ts
optimizer/sum_range.go → src/optimizer/sum_range.ts
patcher/operator_override.go → src/patcher/operator_override.ts
patcher/with_context.go → src/patcher/with_context.ts
patcher/with_timezone.go → src/patcher/with_timezone.ts
patcher/value/value.go → src/patcher/value/value.ts
types/types.go → src/types/types.ts
internal/ring/ring.go → src/internal/ring/ring.ts
internal/deref/deref.go → src/internal/deref/deref.ts
expr.go → src/expr.ts
docgen/docgen.go → src/docgen/docgen.ts
docgen/markdown.go → src/docgen/markdown.ts
repl/repl.go → src/repl/repl.ts

## SPLIT (1 Go → multiple TS)

checker/nature/nature.go → src/checker/nature/nature.ts + type.ts + kind.ts
vm/runtime/runtime.go → src/vm/runtime/runtime.ts + gotime.ts

## GENERATED (ported)

vm/runtime/helpers[generated].go → src/vm/runtime/helpers.ts (production) + helpers.generated.ts (reference)
vm/runtime/helpers/main.go → scripts/gen-helpers.mjs (ported generator, 231 lines output, all reachable)

## FORCED_DIVERGENCE

vm/debug.go → folded into src/debug/debugger.ts (headless; TUI not portable)
vm/debug_off.go → N/A (build-tag stub)
vm/func_types[generated].go → not ported (no consumer in JS VM)
vm/func_types/main.go → not ported (no consumer)

## Coverage: 100% (0 OPEN items)
