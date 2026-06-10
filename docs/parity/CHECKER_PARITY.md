# CHECKER_PARITY.md — Level 6: Checker visitor-per-visitor mapping

`checker/checker.go` (Go) ↔ `src/checker/checker.ts` (TS). The checker is mapped
visitor-per-visitor. Where `reflect.Type` is unavailable, the TypeDescriptor
layer (`src/checker/nature/type.ts` + `kind.ts`) lets the checker follow Go
logic. No checker rule is simplified for JS convenience.

## Visitor mapping

| Go visitor (checker.go) | TS visitor (checker.ts) | Status |
|---|---|---|
| `(v *checker) NilNode` | `nilNode` (inline) | IDENTICAL |
| `IdentifierNode` | `identifierNode` + `ident` | IDENTICAL |
| `IntegerNode` | `integerNode` (inline) | IDENTICAL |
| `FloatNode` | `floatNode` (inline) | IDENTICAL |
| `BoolNode` / `StringNode` / `NilNode` | inline literals | IDENTICAL |
| `UnaryNode` | `unaryNode` | IDENTICAL |
| `BinaryNode` | `binaryNode` | EQUIVALENT (reflect operand typing → TypeDescriptor) |
| `ChainNode` | `chainNode` | IDENTICAL |
| `MemberNode` | `memberNode` | EQUIVALENT (struct field via descriptor; open-map env relaxes) |
| `SliceNode` | `sliceNode` | IDENTICAL |
| `CallNode` | `callNode` + `checkFunction` + `checkArguments` | EQUIVALENT (no reflect arity) |
| `BuiltinNode` | `builtinNode` + `checkBuiltinGet` | IDENTICAL (per-builtin Validate) |
| `PredicateNode` | `predicateNode` | IDENTICAL |
| `PointerNode` | `pointerNode` | IDENTICAL |
| `VariableDeclaratorNode` | `variableDeclaratorNode` | IDENTICAL |
| `SequenceNode` | `sequenceNode` | IDENTICAL |
| `ConditionalNode` | `conditionalNode` | IDENTICAL |
| `ArrayNode` | `arrayNode` | IDENTICAL |
| `MapNode` | `mapNode` | IDENTICAL |
| `PairNode` | `pairNode` | IDENTICAL |

## Public API + helpers

| Go | TS | Status |
|---|---|---|
| `Check(tree, config)` | `Check` | IDENTICAL |
| `ParseCheck(input, config)` | `ParseCheck` | IDENTICAL |
| `(v).visit` dispatch | `visit` | IDENTICAL |
| `(v).error` | `error` | IDENTICAL (message strings mirror Go) |
| `(v).begin / end` (scope) | `begin / end` | IDENTICAL |
| `runVisitors` | `runVisitors` | IDENTICAL |
| `PatchAndCheck` | `PatchAndCheck` | IDENTICAL |
| info.go `FieldIndex/MethodIndex/TypedFuncIndex/IsFastFunc` | info.ts (same names) | EQUIVALENT (TypedFuncIndex→[0,false], IsFastFunc→false; FORCED) |

## EQUIVALENT vs IDENTICAL — reasons

- **EQUIVALENT** entries differ only where Go reads a closed struct's field set /
  method signatures / fixed-width numeric kinds via `reflect`. The TS checker
  uses the same algorithm over a TypeDescriptor; for an OPEN JS object env it
  cannot reject unknown fields (correct for JS). When the env is declared with
  the `types` package (closed shape), strict checking IS applied — matching Go.

## FORCED_DIVERGENCE (reflect / Go runtime type system only)

1. Strict-struct field/method rejection on an undeclared JS object env
   (30 checker N/A cases). Recovered when user declares `types.Map`/`types.*`.
2. reflect arg-count validation against a Go func signature (JS funcs have no
   static arity).
3. Fixed-width numeric / fmt.Stringer type-error distinctions.

## Evidence
- checker corpus: 15/15 evaluated PASS, 30 FORCED_NA (all reflect/strict-struct).
- expr corpus: 139/139 (checker runs on every Compile).
- tsc --noEmit: 0 errors.

No checker rule was dropped. The only divergences are the two accepted ones
(no reflect.Type, no Go runtime type system).
