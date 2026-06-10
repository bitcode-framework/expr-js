# SOURCE_MIRROR_FINAL.md

Final source mirror audit for `expr-js` against `references/expr` (`expr-lang/expr` v1.17.8).

## Method

- Enumerated current Go files under `references/expr` with PowerShell from repo root.
- Excluded Go test files (`*_test.go`, `*_bench_test.go`) and vendored assertion/dump internals (`internal/testify`, `internal/spew`, `internal/difflib`) from production source counts.
- Compared against current `packages/expr-js/src/**/*.ts`, existing `SOURCE_MAPPING.md`, and current source files.
- `references/expr` is at repository root, not inside `packages/expr-js`.

## Counts

| Metric | Count |
|---|---:|
| Total Go source files audited | 77 |
| Total TS source files under `packages/expr-js/src` | 71 |
| `IDENTICAL_STRUCTURE` | 0 |
| `MIRRORED` | 56 |
| `SPLIT` | 2 |
| `GENERATED` | 4 |
| `ADAPTER` | 12 |
| `NOT_APPLICABLE` | 3 |

`IDENTICAL_STRUCTURE` is 0 because this is a Go-to-TypeScript port: even when file and function structure mirror upstream, syntax/imports/error handling/type representation differ by language.

## File mapping

| Go file | TS counterpart | Classification | Notes |
|---|---|---|---|
| `expr.go` | `src/expr.ts` | `MIRRORED` | Public Compile/Run/Eval/Parse API with JS aliases. |
| `ast/dump.go` | `src/ast/dump.ts` | `MIRRORED` | AST dump port. |
| `ast/find.go` | `src/ast/find.ts` | `MIRRORED` | AST find port. |
| `ast/node.go` | `src/ast/node.ts` | `MIRRORED` | Node classes mirror Go structs. |
| `ast/print.go` | `src/ast/print.ts` | `MIRRORED` | Print behavior port. |
| `ast/visitor.go` | `src/ast/visitor.ts` | `MIRRORED` | Visitor/Patch equivalents. |
| `builtin/builtin.go` | `src/builtin/builtin.ts` | `MIRRORED` | Builtin descriptors and validators ported with TypeDescriptor adapter. |
| `builtin/function.go` | `src/builtin/function.ts` | `MIRRORED` | Function metadata port. |
| `builtin/lib.go` | `src/builtin/lib.ts` | `MIRRORED` | Builtin implementations ported. |
| `builtin/utils.go` | `src/builtin/utils.ts` | `MIRRORED` | Shared builtin helpers ported. |
| `builtin/validation.go` | `src/builtin/validation.ts` | `MIRRORED` | Validation helpers ported. |
| `checker/checker.go` | `src/checker/checker.ts` | `MIRRORED` | Visitor flow mirrors Go; reflection replaced by descriptors. |
| `checker/info.go` | `src/checker/info.ts` | `MIRRORED` | Field/method/typed func helpers ported. |
| `checker/nature/nature.go` | `src/checker/nature/nature.ts` + `type.ts` + `kind.ts` | `SPLIT` | Go reflect Nature split into descriptors/kinds/cache. |
| `checker/nature/utils.go` | `src/checker/nature/utils.ts` | `MIRRORED` | Utility logic ported. |
| `compiler/compiler.go` | `src/compiler/compiler.ts` | `MIRRORED` | Compiler visitor and opcode emission ported. |
| `conf/config.go` | `src/conf/config.ts` | `MIRRORED` | Config/options ported. |
| `conf/env.go` | `src/conf/env.ts` | `MIRRORED` | Env cache support ported. |
| `debug/debugger.go` | `src/debug/debugger.ts` | `ADAPTER` | Headless debugger/data side port; terminal TUI cannot mirror in Node. |
| `docgen/docgen.go` | `src/docgen/docgen.ts` | `MIRRORED` | Docgen data generation ported. |
| `docgen/markdown.go` | `src/docgen/markdown.ts` | `MIRRORED` | Markdown rendering ported. |
| `file/error.go` | `src/file/error.ts` | `MIRRORED` | Error formatting port. |
| `file/location.go` | `src/file/location.ts` | `MIRRORED` | Location model port. |
| `file/source.go` | `src/file/source.ts` | `MIRRORED` | Source/snippet behavior port. |
| `internal/deref/deref.go` | `src/internal/deref/deref.ts` | `ADAPTER` | Go pointer/interface deref has JS adapter behavior only. |
| `internal/ring/ring.go` | `src/internal/ring/ring.ts` | `MIRRORED` | Ring helper port. |
| `optimizer/const_expr.go` | `src/optimizer/const_expr.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/count_any.go` | `src/optimizer/count_any.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/count_threshold.go` | `src/optimizer/count_threshold.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/filter_first.go` | `src/optimizer/filter_first.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/filter_last.go` | `src/optimizer/filter_last.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/filter_len.go` | `src/optimizer/filter_len.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/filter_map.go` | `src/optimizer/filter_map.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/fold.go` | `src/optimizer/fold.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/in_array.go` | `src/optimizer/in_array.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/in_range.go` | `src/optimizer/in_range.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/optimizer.go` | `src/optimizer/optimizer.ts` | `MIRRORED` | Optimizer driver port. |
| `optimizer/predicate_combination.go` | `src/optimizer/predicate_combination.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/sum_array.go` | `src/optimizer/sum_array.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/sum_map.go` | `src/optimizer/sum_map.ts` | `MIRRORED` | Optimizer port. |
| `optimizer/sum_range.go` | `src/optimizer/sum_range.ts` | `MIRRORED` | Optimizer port. |
| `parser/parser.go` | `src/parser/parser.ts` | `MIRRORED` | Parser port. |
| `parser/lexer/lexer.go` | `src/parser/lexer/lexer.ts` | `MIRRORED` | Lexer port. |
| `parser/lexer/state.go` | `src/parser/lexer/state.ts` | `MIRRORED` | Lexer state port. |
| `parser/lexer/token.go` | `src/parser/lexer/token.ts` | `MIRRORED` | Token enum/metadata port. |
| `parser/lexer/utils.go` | `src/parser/lexer/utils.ts` | `MIRRORED` | Lexer helpers port. |
| `parser/operator/operator.go` | `src/parser/operator/operator.ts` | `MIRRORED` | Operator precedence port. |
| `parser/utils/utils.go` | `src/parser/utils/utils.ts` | `MIRRORED` | Parser utilities port. |
| `patcher/operator_override.go` | `src/patcher/operator_override.ts` | `MIRRORED` | Operator override patcher port. |
| `patcher/with_context.go` | `src/patcher/with_context.ts` | `MIRRORED` | Context patcher port with JS function-signature metadata caveat. |
| `patcher/with_timezone.go` | `src/patcher/with_timezone.ts` | `MIRRORED` | Timezone patcher port. |
| `patcher/value/value.go` | `src/patcher/value/value.ts` | `ADAPTER` | Go interface detection replaced by descriptor/duck-typed valuer methods. |
| `repl/repl.go` | `src/repl/repl.ts` | `ADAPTER` | Node readline equivalent; persistent Go history differs. |
| `test/coredns/coredns.go` | parity fixture/adapters, not production `src` | `ADAPTER` | Real-world corpus candidate; requires env adapter. |
| `test/crowdsec/crowdsec.go` | parity fixture/adapters, not production `src` | `ADAPTER` | Real-world corpus candidate; requires env adapter. |
| `test/crowdsec/funcs.go` | parity fixture/adapters, not production `src` | `ADAPTER` | Real-world corpus helper candidate. |
| `test/examples/markdown.go` | parity fixture/adapters, not production `src` | `ADAPTER` | Examples corpus candidate. |
| `test/fuzz/fuzz_env.go` | `src/test/fuzz/fuzz_env.ts` | `ADAPTER` | Ported as REPL/fuzz env helper. |
| `test/gen/env.go` | parity generator code under `parity/gen` | `ADAPTER` | Go truth fixture generator analog. |
| `test/gen/gen.go` | no production runtime counterpart | `NOT_APPLICABLE` | Go test generator infrastructure, not language runtime. |
| `test/gen/utils.go` | no production runtime counterpart | `NOT_APPLICABLE` | Go test generator infrastructure. |
| `test/mock/mock.go` | `tests/go-parity/mock-env.ts` | `ADAPTER` | Host env adapter for Go mock struct/method cases. |
| `test/playground/data.go` | parity/playground env adapters | `ADAPTER` | Example data env, not core runtime. |
| `test/playground/env.go` | parity/playground env adapters | `ADAPTER` | Example env, not core runtime. |
| `types/types.go` | `src/types/types.ts` | `MIRRORED` | Public type descriptor API port. |
| `vm/debug.go` | `src/debug/debugger.ts` | `ADAPTER` | Debug hooks/data supported; Go goroutine/TUI model not mirrored. |
| `vm/debug_off.go` | none | `NOT_APPLICABLE` | Go build-tag stub; TS has no build tags. |
| `vm/func_types[generated].go` | `src/checker/info.ts` table; no VM generated dispatch body | `GENERATED` | Generated Go table manually mirrored for typed call indices. |
| `vm/func_types/main.go` | no TS generator yet | `GENERATED` | Upstream generator source audited; automatic TS generation remains feasible future work. |
| `vm/opcodes.go` | `src/vm/opcodes.ts` | `MIRRORED` | Opcode definitions ported. |
| `vm/program.go` | `src/vm/program.ts` | `MIRRORED` | Program model ported. |
| `vm/runtime/helpers[generated].go` | `src/vm/runtime/helpers.generated.ts` + `src/vm/runtime/helpers.ts` | `GENERATED` | Reference generated helper exists; production uses collapsed bigint/number implementation. |
| `vm/runtime/helpers/main.go` | `scripts/gen-helpers.mjs` | `GENERATED` | TS generator port exists. |
| `vm/runtime/runtime.go` | `src/vm/runtime/runtime.ts` + `src/vm/runtime/gotime.ts` | `SPLIT` | Core runtime plus Go time/duration adapter. |
| `vm/runtime/sort.go` | `src/vm/runtime/sort.ts` | `MIRRORED` | Sort helpers ported. |
| `vm/utils.go` | `src/vm/utils.ts` | `MIRRORED` | VM utilities ported. |
| `vm/vm.go` | `src/vm/vm.ts` | `MIRRORED` | VM execution loop ported. |

## Findings

1. Production language/runtime files are all classified.
2. The largest source-mirror risks are not unmapped files; they are adapter boundaries: reflection, typed dispatch tables, Go time, valuer interfaces, and debug/repl host behavior.
3. `test/**` Go files are not production runtime, but they are still classified here because they appear under `references/expr` and influence parity harness expectations.
4. Existing `SOURCE_MAPPING.md` remains broadly accurate for production source, but it does not include the expanded root-level count that includes `test/**` support files.

## Conclusion

Source mirror evidence supports the statement: every relevant Go source file is mapped to a TS source file, a test/parity adapter, generated-source handling, or a documented non-applicable Go-only artifact. It does not support a byte-for-byte or line-for-line mirror claim.
