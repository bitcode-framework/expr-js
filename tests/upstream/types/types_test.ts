// Port of expr-lang/expr types/types_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import * as types from "../../../src/types/types.js";

// TestType_Equal — PORTED
test("TestType_Equal", () => {
  // PORTED
  // Map type equality
  const a = new types.Map({ name: types.String });
  const b = new types.Map({ name: types.String });
  assert.ok(a !== b); // different instances
  assert.ok(a.Equal(b)); // same shape

  // Array type equality
  const c = types.Array(types.Int);
  const d = types.Array(types.Int);
  assert.ok(c !== d); // different instances
  assert.ok(c.Equal(d)); // same shape

  // Primitive type identity
  assert.equal(types.String, types.String);
  assert.equal(types.Int, types.Int);
  assert.equal(types.Float, types.Float);
  assert.equal(types.Bool, types.Bool);
  assert.equal(types.Any, types.Any);
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
