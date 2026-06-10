// Port of expr-lang/expr ast/visitor_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Node,
  NilNode,
  IdentifierNode,
  BinaryNode,
} from "../../../src/ast/node.js";
import { Walk, Visitor, NodeRef } from "../../../src/ast/visitor.js";

// visitor collects identifier names. Mirrors Go's visitor struct.
class TestVisitor implements Visitor {
  identifiers: string[] = [];
  Visit(node: NodeRef): void {
    if (node.node instanceof IdentifierNode) {
      this.identifiers.push(node.node.Value);
    }
  }
}

// TestWalk — PORTED
test("TestWalk", () => {
  // PORTED
  const node: NodeRef = {
    node: new BinaryNode(
      "+",
      new IdentifierNode("foo"),
      new IdentifierNode("bar"),
    ),
  };

  const v = new TestVisitor();
  Walk(node, v);
  assert.deepEqual(v.identifiers, ["foo", "bar"]);
});

// testPatcher replaces all IdentifierNodes with NilNode.
class TestPatcher implements Visitor {
  Visit(node: NodeRef): void {
    if (node.node instanceof IdentifierNode) {
      node.node = new NilNode();
    }
  }
}

// TestWalk_patch — PORTED
test("TestWalk_patch", () => {
  // PORTED
  const binary = new BinaryNode(
    "+",
    new IdentifierNode("foo"),
    new IdentifierNode("bar"),
  );
  const node: NodeRef = { node: binary };

  const p = new TestPatcher();
  Walk(node, p);
  assert.ok(binary.Left instanceof NilNode);
  assert.ok(binary.Right instanceof NilNode);
});

// PORTED: 2, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
