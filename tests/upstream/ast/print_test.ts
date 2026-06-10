// Port of expr-lang/expr ast/print_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemberNode, IdentifierNode, StringNode, ConstantNode } from "../../../src/ast/node.js";
import { Parse } from "../../../src/parser/parser.js";

// TestPrint — PORTED
test("TestPrint", () => {
  // PORTED
  const tests: Array<[string, string]> = [
    ["nil", "nil"],
    ["true", "true"],
    ["false", "false"],
    ["1", "1"],
    ["1.1", "1.1"],
    ['"a"', '"a"'],
    ["a", "a"],
    ["a.b", "a.b"],
    ["a[0]", "a[0]"],
    ['a["the b"]', 'a["the b"]'],
    ["a.b[0]", "a.b[0]"],
    ["a?.b", "a?.b"],
    ["x[0][1]", "x[0][1]"],
    ["x?.[0]?.[1]", "x?.[0]?.[1]"],
    ["-a", "-a"],
    ["!a", "!a"],
    ["not a", "not a"],
    ["a + b", "a + b"],
    ["a + b * c", "a + b * c"],
    ["(a + b) * c", "(a + b) * c"],
    ["a * (b + c)", "a * (b + c)"],
    ["-(a + b) * c", "-(a + b) * c"],
    ["a == b", "a == b"],
    ["a matches b", "a matches b"],
    ["a in b", "a in b"],
    ["a not in b", "not (a in b)"],
    ["a and b", "a and b"],
    ["a or b", "a or b"],
    ["a or b and c", "a or (b and c)"],
    ["a or (b and c)", "a or (b and c)"],
    ["(a or b) and c", "(a or b) and c"],
    ["a ? b : c", "a ? b : c"],
    ["a ? b : c ? d : e", "a ? b : (c ? d : e)"],
    ["(a ? b : c) ? d : e", "(a ? b : c) ? d : e"],
    ["a ? (b ? c : d) : e", "a ? (b ? c : d) : e"],
    ["func()", "func()"],
    ["func(a)", "func(a)"],
    ["func(a, b)", "func(a, b)"],
    ["{}", "{}"],
    ["{a: b}", "{a: b}"],
    ["{a: b, c: d}", "{a: b, c: d}"],
    ["len(a)", "len(a)"],
    ["map(a, # > 0)", "map(a, # > 0)"],
    ["map(a, .b)", "map(a, .b)"],
    ["a.b()", "a.b()"],
    ["a.b(c)", "a.b(c)"],
    ["a[1:-1]", "a[1:-1]"],
    ["a[1:]", "a[1:]"],
    ["a[:]", "a[:]"],
    ["(nil ?? 1) > 0", "(nil ?? 1) > 0"],
    ["if true { 1 } else { 2 }", "if true { 1 } else { 2 }"],
  ];

  for (const [input, want] of tests) {
    const tree = Parse(input);
    assert.equal(tree.Node.String(), want, `Print(${input})`);
  }
});

// TestPrint_MemberNode — PORTED
test("TestPrint_MemberNode", () => {
  // PORTED
  const node = new MemberNode(
    new IdentifierNode("a"),
    new StringNode("b c"),
  );
  (node as any).Optional = true;
  assert.equal(node.String(), 'a?.["b c"]');
});

// TestPrint_ConstantNode — PORTED
test("TestPrint_ConstantNode", () => {
  // PORTED
  const tests: Array<[any, string]> = [
    [null, "nil"],
    [true, "true"],
    [false, "false"],
    [1, "1"],
    [1.1, "1.1"],
    ["a", '"a"'],
    [[1, 2, 3], "[1,2,3]"],
    [{ a: 1 }, '{"a":1}'],
  ];

  for (const [input, want] of tests) {
    const node = new ConstantNode(input);
    assert.equal(node.String(), want, `ConstantNode(${want})`);
  }
});

// PORTED: 3, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
