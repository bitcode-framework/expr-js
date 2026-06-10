# CHECKER_PARITY.md — Priority E: checker parity maximization

Assessment of `src/checker/checker.ts` (1605 lines) vs `checker/checker.go`
(1181 lines), and the maximization decision.

Accepted divergence (per program rules): only the absence of `reflect.Type` and
the Go runtime type system. Everything else follows Go source.

---

## Structural parity (verified)

`checker.ts` mirrors `checker.go` visitor-for-visitor. Every per-node visit
method is present with the Go name and the same control flow:
IdentifierNode, UnaryNode, BinaryNode, ChainNode, MemberNode, SliceNode,
CallNode, BuiltinNode, PredicateNode, PointerNode, VariableDeclaratorNode,
SequenceNode, ConditionalNode, ArrayNode, MapNode, PairNode, plus the helpers
ident/checkFunction/checkArguments/checkBuiltinGet/begin/end/runVisitors/
PatchAndCheck. Public API: Check, ParseCheck.

## What IS parity (covered by checker corpus 15/15 + expr corpus)

- Identifier/field/method resolution + per-node Nature inference
- Operator validation (arithmetic/comparison/logical/membership/range)
- Builtin signature validation via per-builtin Validate callbacks
- Predicate/closure element typing (#, .field), nested predicates
- Optional chaining typing, slice typing, aggregate signature checks
- AsBool/AsInt/AsInt64/AsFloat64 expectation casts
- AllowUndefinedVariables, env keyword, MaxNodes budget
- Error reporting via FileError with (line:col) and matching message text where
  the type info is reflection-independent

## What is FORCED_DIVERGENCE (only reflect / Go-runtime-type gaps)

1. **Strict-struct field/method rejection.** Go knows a struct's closed field
   set + field types + method set via reflect, so it rejects `Foo.Bar.Not`,
   `Foo.Method(42)`, `Int + Bool`, etc. A JS env object is an OPEN map with no
   declared field types, so expr-js cannot (and should not, for JS) reject
   these. This is the dominant checker N/A class (30 cases). Root cause A2.
   - Mitigation present: when the env is declared via the `types.Map`/`types.*`
     builder (which DOES carry a closed field set + field types), expr-js's
     checker uses that declared shape — so strict checking IS available to users
     who declare types, matching Go's behavior for typed envs.
2. **reflect arg-count validation** against a Go func signature (JS funcs have
   no static arity). Root cause A2.
3. **MethodIndex for MemberNode** returns index 0 (no per-type reflect method
   index); the VM binds methods by name instead. Behavioral result identical.
4. **fmt.Stringer / fixed-width numeric** distinctions in type errors. Root
   causes A6/A1.

## Maximization decision

The checker logic is already at the realistic maximum: the ONLY divergences are
the two explicitly-accepted ones (no reflect.Type, no Go runtime type system).
No checker rule was simplified or dropped for convenience. The strict-struct
gap is not a missing feature — it is the correct behavior for an open JS object
env, AND it is recovered when the user declares types via the `types` package
(the JS analog of giving Go a struct env).

**No further checker parity work is actionable without a Go type system at
runtime, which is impossible in TypeScript.** Classification: PARITY for all
reflection-independent logic; FORCED_DIVERGENCE for the reflect-dependent
rejections (enumerated in NA_AUDIT.md checker section).

## Evidence
- checker corpus: 15/15 evaluated PASS, 30 N/A (all reflect/strict-struct).
- expr corpus: 139/139 (checker runs on every Compile in the corpus).
- tsc --noEmit: 0 errors.
