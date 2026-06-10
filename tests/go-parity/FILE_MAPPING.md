# FILE_MAPPING.md — every upstream Go file → expr-js TS file

Source of truth: `references/expr` (expr-lang/expr v1.17.8).
Status legend: **mirrored** (1:1) · **split** (1 Go → N TS) · **merged** (N Go → 1 TS) · **collapsed** (generated Go → compact TS) · **not_ported**.

## Core packages (all present)

| Go file | TS file | Status |
|---|---|---|
| file/location.go | src/file/location.ts | mirrored |
| file/source.go | src/file/source.ts | mirrored |
| file/error.go | src/file/error.ts | mirrored |
| ast/node.go | src/ast/node.ts | mirrored |
| ast/print.go | src/ast/print.ts | mirrored |
| ast/visitor.go | src/ast/visitor.ts | mirrored |
| ast/find.go | src/ast/find.ts | mirrored |
| ast/dump.go | src/ast/dump.ts | mirrored |
| parser/lexer/lexer.go | src/parser/lexer/lexer.ts | mirrored |
| parser/lexer/state.go | src/parser/lexer/state.ts | mirrored |
| parser/lexer/token.go | src/parser/lexer/token.ts | mirrored |
| parser/lexer/utils.go | src/parser/lexer/utils.ts | mirrored |
| parser/operator/operator.go | src/parser/operator/operator.ts | mirrored |
| parser/utils/utils.go | src/parser/utils/utils.ts | mirrored |
| parser/parser.go | src/parser/parser.ts | mirrored |
| conf/config.go | src/conf/config.ts | mirrored |
| conf/env.go | src/conf/env.ts | mirrored (un-merged this session) |
| builtin/builtin.go | src/builtin/builtin.ts | mirrored |
| builtin/lib.go | src/builtin/lib.ts | mirrored |
| builtin/utils.go | src/builtin/utils.ts | mirrored |
| builtin/validation.go | src/builtin/validation.ts | mirrored |
| builtin/function.go | src/builtin/function.ts | mirrored |
| checker/checker.go | src/checker/checker.ts | mirrored |
| checker/info.go | src/checker/info.ts | mirrored |
| checker/nature/utils.go | src/checker/nature/utils.ts | mirrored (ported this session) |
| compiler/compiler.go | src/compiler/compiler.ts | mirrored |
| vm/vm.go | src/vm/vm.ts | mirrored |
| vm/program.go | src/vm/program.ts | mirrored |
| vm/opcodes.go | src/vm/opcodes.ts | mirrored |
| vm/utils.go | src/vm/utils.ts | mirrored |
| vm/runtime/runtime.go | src/vm/runtime/runtime.ts | mirrored |
| vm/runtime/sort.go | src/vm/runtime/sort.ts | mirrored |
| optimizer/*.go (15 files) | src/optimizer/*.ts (15 files) | mirrored |
| patcher/operator_override.go | src/patcher/operator_override.ts | mirrored |
| patcher/with_context.go | src/patcher/with_context.ts | mirrored |
| patcher/with_timezone.go | src/patcher/with_timezone.ts | mirrored |
| patcher/value/value.go | src/patcher/value/value.ts | mirrored (ported this session) |
| types/types.go | src/types/types.ts | mirrored |
| internal/ring/ring.go | src/internal/ring/ring.ts | mirrored |
| internal/deref/deref.go | src/internal/deref/deref.ts | mirrored (ported this session) |
| expr.go | src/expr.ts | mirrored |

## SPLIT (1 Go → multiple TS) — FORCED_DIVERGENCE

| Go file | TS files | Reason |
|---|---|---|
| checker/nature/nature.go | nature.ts + **type.ts** + **kind.ts** | Go `reflect.Type`/`reflect.Kind` have no TS equivalent; the descriptor + kind enum are extracted into sibling files. The Nature logic itself stays 1:1 in nature.ts. |
| vm/runtime/runtime.go | runtime.ts + **gotime.ts** | Go `time.Time`/`time.Duration`/`time.Location` modeled as `GoTime`/`GoDuration` in a dedicated file. |

## COLLAPSED (generated Go → compact TS) — FORCED_DIVERGENCE

| Go file | TS file | Reason |
|---|---|---|
| vm/runtime/helpers[generated].go (3706 lines) | src/vm/runtime/helpers.ts (~190 lines) | Go generates an exhaustive switch over every int/uint/float type pair. JS has only bigint (all ints) + number (all floats), so the dispatch collapses. Behavior is identical; verified by the numeric + duration corpus. The **generator** (`helpers/main.go`) is the artifact to diff on upstream upgrades. |

## NOT PORTED — classified

| Go file | Classification | Reason / roadmap |
|---|---|---|
| vm/func_types[generated].go (365) | FORCED_DIVERGENCE | Typed-call dispatch tables for reflect-specialized calls. TS routes all calls through generic OpCall/OpCallN. No behavioral effect; `checker.TypedFuncIndex` returns [0,false], `IsFastFunc` returns false. |
| vm/func_types/main.go (157) | FORCED_DIVERGENCE | Generator for the above. |
| vm/debug.go / vm/debug_off.go | FORCED_DIVERGENCE | Go build-tag step-debug hooks (goroutine channels). No JS analog; `Program.Disassemble()` (the data side) IS ported. |
| internal/deref helpers on reflect.Value | FORCED_DIVERGENCE | `deref.Value` is identity in JS (no pointers); `deref.Interface`/`Type`/`TypeKind` ARE ported in deref.ts. |
| debug/debugger.go (184) | NOT_APPLICABLE (portable-but-not-implemented) | tcell terminal UI. Roadmap: ~1.5–2 days with a JS TUI lib or headless step API. |
| docgen/docgen.go + markdown.go (317) | NOT_APPLICABLE (portable-but-not-implemented) | Doc generator over the type system. Roadmap: ~1–1.5 days; pure data→markdown, no runtime blocker. |
| repl/repl.go (123) | NOT_APPLICABLE (portable-but-not-implemented) | Interactive REPL. Roadmap: ~0.5 day with Node readline. |
| test/** (mock, coredns, crowdsec, gen, playground, examples, fuzz) | test-only | Upstream test fixtures/harnesses. `test/mock` is reproduced as `tests/go-parity/mock-env.ts`. Real-world corpora (coredns/crowdsec) are candidate future corpus additions. |
| internal/testify, internal/spew, internal/difflib | NOT_APPLICABLE | Vendored Go test infrastructure, not part of the language surface. |

## Summary

- **Core language + runtime files: 100% ported** (every non-test, non-generated core file has a TS counterpart).
- **Split/collapse: 3** (nature, runtime/gotime, helpers) — all FORCED_DIVERGENCE, documented.
- **Not ported: func_types (forced), debug/docgen/repl (portable, roadmapped), vendored test infra (N/A).**
- This session closed the 3 previously-undisclosed gaps: conf/env.go, checker/nature/utils.go, patcher/value/value.go (+ internal/deref.go).
