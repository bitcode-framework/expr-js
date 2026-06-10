# @bitcode-framework/expr-js

**This project is a TypeScript port of [expr-lang/expr](https://github.com/expr-lang/expr) v1.17.8.**

A fast, safe, and embeddable expression language engine — the TypeScript port of
the Go [Expr](https://expr-lang.org) library. JSON-free, dependency-free,
runs in Node.js, Bun, and the browser.

> Goal: a maintainable, behavior-faithful port. Upstream Go changes are applied
> by diffing and porting equivalent changes. See [PARITY.md](./PARITY.md) for the
> full parity report, test classification, and documented divergences.

## Install

```sh
npm install @bitcode-framework/expr-js
```

## Usage

Two API styles are provided. Go-style names (source parity) and camelCase
aliases (JS ergonomics) both work.

```ts
import { Compile, Run, Eval } from "@bitcode-framework/expr-js";
// or: import { compile, run, evaluate } from "@bitcode-framework/expr-js";

// One-shot evaluation
Eval("1 + 2", null);                     // => 3n
Eval("user.age >= 18", { user: { age: 21 } }); // => true

// Compile once, run many times
const program = Compile("price * qty");
Run(program, { price: 10n, qty: 3n });   // => 30n
Run(program, { price: 5n, qty: 4n });    // => 20n
```

## Numeric model

Go distinguishes `int`/`int64`/`float64`. JavaScript has one `number`. To preserve
Go semantics exactly, expr-js maps:

- **Go int / int64 → JS `bigint`**
- **Go float64 → JS `number`**

So:

```ts
Eval("2 + 3", null);   // => 5n      (integer stays integer)
Eval("1 / 2", null);   // => 0.5     (division always float)
Eval("10 % 3", null);  // => 1n      (modulo is integer-only)
Eval("2 ** 10", null); // => 1024    (exponent is float64)
```

If you need plain JS numbers in your application, convert at the boundary
(`Number(result)`), or use `int()`/`float()` inside expressions.

## Features

Full language surface of Expr v1.17.8:

- Arithmetic, comparison, logical, and bitwise operators
- Ternary `? :` and `if { } else { }` conditionals
- `let` variable declarations, sequences (`;`)
- Member access, optional chaining (`?.`), slicing, ranges (`1..5`)
- Pipes (`|`), nil-coalescing (`??`)
- Predicates: `all`, `any`, `none`, `one`, `filter`, `map`, `count`, `find`,
  `findIndex`, `findLast`, `findLastIndex`, `groupBy`, `sortBy`, `reduce`
- 60+ builtin functions (`len`, `max`, `min`, `sum`, `type`, `keys`, `values`,
  `sort`, string/math/date helpers, …)
- Optional compile-time type checker (`Env(...)`)
- Optimizer (constant folding, predicate fusion, etc.)
- AST patchers, custom functions, operator overloading

## Building from source

```sh
npm install
npm run typecheck   # tsc --noEmit
npm run build       # ESM + CJS + .d.ts
npm test            # unit tests
```

## Parity testing

Go is the source of truth. A Go generator produces fixtures that the TS runner
replays against expr-js:

```sh
cd parity/gen && go run .          # regenerate fixtures (requires Go + upstream)
npx tsx --test tests/parity.test.ts
```

See [PARITY.md](./PARITY.md) for the classification table and divergences.

## Attribution & License

MIT. Original Go implementation by Anton Medvedev and the Expr contributors.
This is an independent TypeScript port that tracks upstream versioning.
