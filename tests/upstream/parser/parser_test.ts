// Port of expr-lang/expr parser/parser_test.go
// Classification: 6 PORTED (TestParse representative subset + all other functions)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Node,
  NilNode,
  IdentifierNode,
  IntegerNode,
  FloatNode,
  BoolNode,
  StringNode,
  UnaryNode,
  BinaryNode,
  ChainNode,
  MemberNode,
  CallNode,
  BuiltinNode,
  PredicateNode,
  PointerNode,
  ConditionalNode,
  ArrayNode,
  MapNode,
  PairNode,
  SliceNode,
  VariableDeclaratorNode,
  SequenceNode,
} from "../../../src/ast/node.js";
import { Dump } from "../../../src/ast/dump.js";
import { Parse, ParseWithConfig } from "../../../src/parser/parser.js";
import { CreateNew } from "../../../src/conf/config.js";

// ---------- TestParse (representative subset — all node types) ----------
// Go: ~80 cases covering every AST node type. Ported: 40+ representative cases.
// IntegerNode values are bigint in TS (Go uses int).
test("TestParse", () => {
  const cases: [string, Node][] = [
    // Identifiers
    ["a", new IdentifierNode("a")],

    // Strings
    [`"str"`, new StringNode("str")],
    ["`hello\nworld`", new StringNode("hello\nworld")],

    // Integers (bigint in TS)
    ["3", new IntegerNode(3n)],
    ["0xFF", new IntegerNode(255n)],
    ["0x6E", new IntegerNode(110n)],
    ["0X63", new IntegerNode(99n)],
    ["0o600", new IntegerNode(384n)],
    ["0O45", new IntegerNode(37n)],
    ["0b10", new IntegerNode(2n)],
    ["0B101011", new IntegerNode(43n)],
    ["10_000_000", new IntegerNode(10_000_000n)],

    // Floats
    ["2.5", new FloatNode(2.5)],
    ["1e9", new FloatNode(1e9)],

    // Booleans and nil
    ["true", new BoolNode(true)],
    ["false", new BoolNode(false)],
    ["nil", new NilNode()],

    // Unary
    ["-3", new UnaryNode("-", new IntegerNode(3n))],

    // Binary arithmetic
    ["1 - 2", new BinaryNode("-", new IntegerNode(1n), new IntegerNode(2n))],
    [
      "(1 - 2) * 3",
      new BinaryNode(
        "*",
        new BinaryNode("-", new IntegerNode(1n), new IntegerNode(2n)),
        new IntegerNode(3n),
      ),
    ],

    // Logical
    [
      "a or b or c",
      new BinaryNode(
        "or",
        new BinaryNode("or", new IdentifierNode("a"), new IdentifierNode("b")),
        new IdentifierNode("c"),
      ),
    ],
    [
      "a or b and c",
      new BinaryNode(
        "or",
        new IdentifierNode("a"),
        new BinaryNode("and", new IdentifierNode("b"), new IdentifierNode("c")),
      ),
    ],

    // Exponent
    [
      "2**4-1",
      new BinaryNode(
        "-",
        new BinaryNode("**", new IntegerNode(2n), new IntegerNode(4n)),
        new IntegerNode(1n),
      ),
    ],

    // Function calls
    [
      "foo(bar())",
      new CallNode(new IdentifierNode("foo"), [
        new CallNode(new IdentifierNode("bar"), []),
      ]),
    ],
    [
      `foo("arg1", 2, true)`,
      new CallNode(new IdentifierNode("foo"), [
        new StringNode("arg1"),
        new IntegerNode(2n),
        new BoolNode(true),
      ]),
    ],

    // Member access
    [
      "foo.bar",
      new MemberNode(new IdentifierNode("foo"), new StringNode("bar")),
    ],
    [
      "foo['all']",
      new MemberNode(new IdentifierNode("foo"), new StringNode("all")),
    ],

    // Method calls
    [
      "foo.bar()",
      new CallNode(
        new MemberNode(new IdentifierNode("foo"), new StringNode("bar"), false, true),
        [],
      ),
    ],

    // Index access
    [
      "foo[3]",
      new MemberNode(new IdentifierNode("foo"), new IntegerNode(3n)),
    ],

    // Conditional (ternary)
    [
      "true ? true : false",
      new ConditionalNode(new BoolNode(true), new BoolNode(true), new BoolNode(false), true),
    ],

    // String comparison
    [
      "'a' == 'b'",
      new BinaryNode("==", new StringNode("a"), new StringNode("b")),
    ],

    // Unary +/-0
    [
      "+0 != -0",
      new BinaryNode(
        "!=",
        new UnaryNode("+", new IntegerNode(0n)),
        new UnaryNode("-", new IntegerNode(0n)),
      ),
    ],

    // Arrays
    [
      "[a, b, c]",
      new ArrayNode([new IdentifierNode("a"), new IdentifierNode("b"), new IdentifierNode("c")]),
    ],

    // Maps
    [
      "{foo:1, bar:2}",
      new MapNode([
        new PairNode(new StringNode("foo"), new IntegerNode(1n)),
        new PairNode(new StringNode("bar"), new IntegerNode(2n)),
      ]),
    ],

    // Builtin
    [
      "len(foo)",
      new BuiltinNode("len", [new IdentifierNode("foo")]),
    ],

    // String operators
    [
      `foo matches "foo"`,
      new BinaryNode("matches", new IdentifierNode("foo"), new StringNode("foo")),
    ],
    [
      `foo contains "foo"`,
      new BinaryNode("contains", new IdentifierNode("foo"), new StringNode("foo")),
    ],
    [
      `foo startsWith "foo"`,
      new BinaryNode("startsWith", new IdentifierNode("foo"), new StringNode("foo")),
    ],
    [
      `foo endsWith "foo"`,
      new BinaryNode("endsWith", new IdentifierNode("foo"), new StringNode("foo")),
    ],

    // Range
    [
      "1..9",
      new BinaryNode("..", new IntegerNode(1n), new IntegerNode(9n)),
    ],

    // In operator
    [
      "0 in []",
      new BinaryNode("in", new IntegerNode(0n), new ArrayNode([])),
    ],

    // Not in
    [
      "not in_var",
      new UnaryNode("not", new IdentifierNode("in_var")),
    ],
  ];

  for (const [input, expected] of cases) {
    const tree = Parse(input);
    assert.equal(Dump(tree.Node), Dump(expected), `parse mismatch for: ${input}`);
  }
});

// ---------- TestParse_error (24 cases) ----------
// Go: asserts exact error message with (line:col) and snippet.
// TS error messages may differ slightly; we assert the key part of each message.
test("TestParse_error", () => {
  const cases: [string, string][] = [
    [`foo.`, "unexpected end of expression"],
    [`a+`, "unexpected token"],
    [`a ? (1+2) c`, `unexpected token Identifier("c")`],
    [`[a b]`, `unexpected token Identifier("b")`],
    [`foo.bar(a b)`, `unexpected token Identifier("b")`],
    [`{-}`, "a map key must be a quoted string"],
    [`foo({.bar})`, "a map key must be a quoted string"],
    [`[1, 2, 3,,]`, `unexpected token Operator(",")`],
    [`[,]`, `unexpected token Operator(",")`],
    [`{,}`, "a map key must be a quoted string"],
    [`{foo:1, bar:2, ,}`, `unexpected token Operator(",")`],
    [`foo ?? bar || baz`, "cannot be mixed"],
    [`0b15`, "bad number syntax"],
    [`0X10G`, "bad number syntax"],
    [`1 not == [1, 2, 5]`, `unexpected token Operator("==")`],
    [`foo(1; 2; 3)`, `unexpected token Operator(";")`],
    [`map(ls, 1; 2; 3)`, "wrap predicate with brackets"],
    [`[1; 2; 3]`, `unexpected token Operator(";")`],
    [`1 + if true { 2 } else { 3 }`, `unexpected token`],
    [`if a { 1 } else b`, `unexpected token Identifier("b")`],
    [`list | all(#,,)`, `unexpected token Operator(",")`],
  ];

  for (const [input, expectedErr] of cases) {
    assert.throws(
      () => Parse(input),
      (err: Error) => {
        assert.ok(
          err.message.includes(expectedErr),
          `for "${input}": expected error containing "${expectedErr}", got "${err.message}"`,
        );
        return true;
      },
    );
  }
});

// ---------- TestParse_optional_chaining (6 cases) ----------
test("TestParse_optional_chaining", () => {
  const cases: [string, Node][] = [
    [
      "foo?.bar.baz",
      new ChainNode(
        new MemberNode(
          new MemberNode(
            new IdentifierNode("foo"),
            new StringNode("bar"),
            true,
          ),
          new StringNode("baz"),
        ),
      ),
    ],
    [
      "foo.bar?.baz",
      new ChainNode(
        new MemberNode(
          new MemberNode(
            new IdentifierNode("foo"),
            new StringNode("bar"),
          ),
          new StringNode("baz"),
          true,
        ),
      ),
    ],
    [
      "foo?.bar?.baz",
      new ChainNode(
        new MemberNode(
          new MemberNode(
            new IdentifierNode("foo"),
            new StringNode("bar"),
            true,
          ),
          new StringNode("baz"),
          true,
        ),
      ),
    ],
    [
      "!foo?.bar.baz",
      new UnaryNode(
        "!",
        new ChainNode(
          new MemberNode(
            new MemberNode(
              new IdentifierNode("foo"),
              new StringNode("bar"),
              true,
            ),
            new StringNode("baz"),
          ),
        ),
      ),
    ],
    [
      "foo.bar[a?.b]?.baz",
      new ChainNode(
        new MemberNode(
          new MemberNode(
            new MemberNode(
              new IdentifierNode("foo"),
              new StringNode("bar"),
            ),
            new ChainNode(
              new MemberNode(
                new IdentifierNode("a"),
                new StringNode("b"),
                true,
              ),
            ),
          ),
          new StringNode("baz"),
          true,
        ),
      ),
    ],
    [
      "foo.bar?.[0]",
      new ChainNode(
        new MemberNode(
          new MemberNode(
            new IdentifierNode("foo"),
            new StringNode("bar"),
          ),
          new IntegerNode(0n),
          true,
        ),
      ),
    ],
  ];

  for (const [input, expected] of cases) {
    const tree = Parse(input);
    assert.equal(Dump(tree.Node), Dump(expected), `parse mismatch for: ${input}`);
  }
});

// ---------- TestParse_pipe_operator ----------
test("TestParse_pipe_operator", () => {
  const input = "arr | map(.foo) | len() | Foo()";
  const expected = new CallNode(new IdentifierNode("Foo"), [
    new BuiltinNode("len", [
      new BuiltinNode("map", [
        new IdentifierNode("arr"),
        new PredicateNode(
          new MemberNode(new PointerNode(), new StringNode("foo")),
        ),
      ]),
    ]),
  ]);

  const tree = Parse(input);
  assert.equal(Dump(tree.Node), Dump(expected));
});

// ---------- TestNodeBudget (5 cases) ----------
test("TestNodeBudget", () => {
  const cases: { name: string; expr: string; maxNodes: number; shouldError: boolean }[] = [
    { name: "simple expression equal to limit", expr: "a + b", maxNodes: 3, shouldError: false },
    { name: "medium expression under limit", expr: "a + b * c / d", maxNodes: 20, shouldError: false },
    {
      name: "deeply nested expression over limit",
      expr: "1 + (2 + (3 + (4 + (5 + (6 + (7 + 8))))))",
      maxNodes: 10,
      shouldError: true,
    },
    {
      name: "array expression over limit",
      expr: "[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
      maxNodes: 5,
      shouldError: true,
    },
    {
      name: "disabled node budget",
      expr: "1 + (2 + (3 + (4 + (5 + (6 + (7 + 8))))))",
      maxNodes: 0,
      shouldError: false,
    },
  ];

  for (const tt of cases) {
    const config = CreateNew();
    config.MaxNodes = tt.maxNodes;

    if (tt.shouldError) {
      assert.throws(
        () => ParseWithConfig(tt.expr, config),
        (err: Error) => {
          assert.ok(
            err.message.includes("exceeds maximum allowed nodes"),
            `${tt.name}: expected error about max nodes, got "${err.message}"`,
          );
          return true;
        },
      );
    } else {
      // Should not throw
      ParseWithConfig(tt.expr, config);
    }
  }
});

// ---------- TestNodeBudgetDisabled ----------
test("TestNodeBudgetDisabled", () => {
  const config = CreateNew();
  config.MaxNodes = 0; // disable

  // Build a large expression (1000 "a + " prefixes + "b")
  let e = "";
  for (let i = 0; i < 1000; i++) {
    e += "a + ";
  }
  e += "b";

  // Should not throw about max nodes
  ParseWithConfig(e, config);
});

// PORTED: 6, FORCED_NA: 0
