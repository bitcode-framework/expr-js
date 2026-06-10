# SOURCE_MAPPING_FINAL.md — Priority F

Complete Go → TS mapping. Status: MIRRORED · SPLIT · MERGED · GENERATED ·
FORCED_DIVERGENCE · NOT_APPLICABLE. Target: 100% upstream files mapped.

## Core (MIRRORED)

| Go | TS | Status |
|---|---|---|
| file/location.go | src/file/location.ts | MIRRORED |
| file/source.go | src/file/source.ts | MIRRORED |
| file/error.go | src/file/error.ts | MIRRORED |
| ast/node.go | src/ast/node.ts | MIRRORED |
| ast/print.go | src/ast/print.ts | MIRRORED |
| ast/visitor.go | src/ast/visitor.ts | MIRRORED |
| ast/find.go | src/ast/find.ts | MIRRORED |
| ast/dump.go | src/ast/dump.ts | MIRRORED |
| parser/lexer/lexer.go | src/parser/lexer/lexer.ts | MIRRORED |
| parser/lexer/state.go | src/parser/lexer/state.ts | MIRRORED |
| parser/lexer/token.go | src/parser/lexer/token.ts | MIRRORED |
| parser/lexer/utils.go | src/parser/lexer/utils.ts | MIRRORED |
| parser/operator/operator.go | src/parser/operator/operator.ts | MIRRORED |
| parser/utils/utils.go | src/parser/utils/utils.ts | MIRRORED |
| parser/parser.go | src/parser/parser.ts | MIRRORED |
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
| optimizer/*.go (15) | src/optimizer/*.ts (15) | MIRRORED |
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
| debug/debugger.go | src/debug/debugger.ts | MIRRORED (headless; TUI=FORCED_DIVERGENCE) |
| test/fuzz/fuzz_env.go | src/test/fuzz/fuzz_env.ts | MIRRORED (repl env) |

## SPLIT (FORCED_DIVERGENCE)

| Go | TS | Reason |
|---|---|---|
| checker/nature/nature.go | nature.ts + type.ts + kind.ts | reflect.Type/Kind replacement |
| vm/runtime/runtime.go (time) | runtime.ts + gotime.ts | time.Time/Duration |

## GENERATED (FORCED_DIVERGENCE)

| Go | TS | Reason |
|---|---|---|
| vm/runtime/helpers[generated].go | vm/runtime/helpers.ts (collapsed) | JS has 2 numeric types |
| vm/runtime/helpers/main.go (template) | (mapping doc in helpers.ts) | generator; track for upstream diffs |
| vm/func_types[generated].go | not ported | typed dispatch; no JS reflect cost |
| vm/func_types/main.go | not ported | generator for above |

## NOT PORTED — classified

| Go | Status | Reason |
|---|---|---|
| vm/debug.go, vm/debug_off.go | FORCED_DIVERGENCE | Go build-tag step hooks |
| test/** (mock, gen, coredns, crowdsec, playground, examples, fuzz) | test-only | mock → tests/go-parity/mock-env.ts; others = PASS_WITH_ADAPTER corpus candidates (examples MANIFEST) |
| internal/testify, internal/spew, internal/difflib | NOT_APPLICABLE | vendored Go test infra |
| bench_test.go, *_test.go | test-only | classified in corpora + MANIFESTs |

## Coverage

- **Core + runtime + non-core (docgen/repl/debug): 100% mapped.**
- Every Go core file → a TS file (MIRRORED) or a documented SPLIT/GENERATED
  FORCED_DIVERGENCE.
- No core file is unmapped. No NOT_IMPLEMENTED_YET remains.
