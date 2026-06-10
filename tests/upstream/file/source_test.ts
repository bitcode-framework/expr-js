// Port of expr-lang/expr file/source_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { NewSource } from "../../../src/file/source.js";

// TestStringSource_SnippetMultiLine — PORTED
test("TestStringSource_SnippetMultiLine", () => {
  // PORTED
  const source = NewSource("hello\nworld\nmy\nbub\n");

  let [str, found] = source.Snippet(1);
  assert.ok(found, "snippet 1 not found");
  assert.equal(str, "hello");

  [str, found] = source.Snippet(2);
  assert.ok(found, "snippet 2 not found");
  assert.equal(str, "world");

  [str, found] = source.Snippet(3);
  assert.ok(found, "snippet 3 not found");
  assert.equal(str, "my");

  [str, found] = source.Snippet(4);
  assert.ok(found, "snippet 4 not found");
  assert.equal(str, "bub");

  [str, found] = source.Snippet(5);
  assert.ok(found, "snippet 5 not found");
  assert.equal(str, "");
});

// TestStringSource_SnippetSingleLine — PORTED
test("TestStringSource_SnippetSingleLine", () => {
  // PORTED
  const source = NewSource("hello, world");

  let [str, found] = source.Snippet(1);
  assert.ok(found, "snippet 1 not found");
  assert.equal(str, "hello, world");

  [str, found] = source.Snippet(2);
  assert.ok(!found, "snippet 2 should not be found");
  assert.equal(str, "");
});

// PORTED: 2, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
