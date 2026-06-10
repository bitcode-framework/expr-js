// Port of expr-lang/expr ast/find_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { IdentifierNode, BinaryNode, Node } from "../../../src/ast/node.js";
import { Find } from "../../../src/ast/find.js";

// TestFind — PORTED
test("TestFind", () => {
  // PORTED
  const left = new IdentifierNode("a");
  const root: Node = new BinaryNode("+", left, new IdentifierNode("b"));

  const x = Find(root, (node: Node): boolean => {
    if (node instanceof IdentifierNode) {
      return node.Value === "a";
    }
    return false;
  });

  assert.equal(x, left);
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
