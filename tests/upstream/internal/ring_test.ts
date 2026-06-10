// Port of expr-lang/expr internal/ring/ring_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Ring, New } from "../../../src/internal/ring/ring.js";

// op types mirror Go's opEnq/opDeq/opRst constants.
const opEnq = 0; // enqueue an item
const opDeq = 1; // dequeue an item and an item was available
const opRst = 2; // reset

interface RingOp {
  cap: number;
  opType: number;
  value: number;
  items: number[];
}

function testRingOp(r: Ring<number>, op: RingOp): void {
  const zero = 0;
  switch (op.opType) {
    case opEnq:
      r.Enqueue(op.value);
      break;
    case opDeq: {
      const shouldSucceed = r.Len() > 0;
      const [v, ok] = r.Dequeue();
      if (ok !== shouldSucceed) {
        assert.fail(`should have succeeded: ${shouldSucceed}`);
      }
      if (ok && v !== op.value) {
        assert.fail(`expected value: ${op.value}; got: ${v}`);
      }
      if (!ok && (v ?? zero) !== zero) {
        assert.fail(`expected zero value; got: ${v}`);
      }
      break;
    }
    case opRst:
      r.Reset();
      break;
  }
  assert.equal(r.Cap(), op.cap, `expected cap: ${op.cap}; got: ${r.Cap()}`);
  assert.equal(r.Len(), op.items.length, `expected Len(): ${op.items.length}; got: ${r.Len()}`);
  const got: number[] = [];
  for (let i = 0; ; i++) {
    const [v, ok] = r.Nth(i);
    if (!ok) break;
    got.push(v as number);
  }
  assert.equal(got.length, op.items.length, `expected items: ${op.items}\ngot items: ${got}`);
  for (let i = 0; i < op.items.length; i++) {
    assert.equal(op.items[i], got[i], `expected items: ${op.items}\ngot items: ${got}`);
  }
  const [v2, ok2] = r.Nth(op.items.length);
  assert.ok(!ok2 && (v2 ?? zero) === zero, `expected no more items, got: v=${v2}; ok=${ok2}`);
}

function testRing(r: Ring<number>, ...ops: RingOp[]): void {
  for (const op of ops) {
    testRingOp(r, op);
  }
}

// TestRing — PORTED
test("TestRing", () => {
  // PORTED
  testRing(
    New<number>(3),
    // noops on empty ring
    { cap: 0, opType: opRst, value: 0, items: [] },
    { cap: 0, opType: opDeq, value: 0, items: [] },

    // basic
    { cap: 3, opType: opEnq, value: 1, items: [1] },
    { cap: 3, opType: opDeq, value: 1, items: [] },

    // wrapping
    { cap: 3, opType: opEnq, value: 2, items: [2] },
    { cap: 3, opType: opEnq, value: 3, items: [2, 3] },
    { cap: 3, opType: opEnq, value: 4, items: [2, 3, 4] },
    { cap: 3, opType: opDeq, value: 2, items: [3, 4] },
    { cap: 3, opType: opDeq, value: 3, items: [4] },
    { cap: 3, opType: opDeq, value: 4, items: [] },

    // resetting
    { cap: 3, opType: opEnq, value: 2, items: [2] },
    { cap: 3, opType: opRst, value: 0, items: [] },
    { cap: 3, opType: opDeq, value: 0, items: [] },

    // growing without wrapping
    { cap: 3, opType: opEnq, value: 5, items: [5] },
    { cap: 3, opType: opEnq, value: 6, items: [5, 6] },
    { cap: 3, opType: opEnq, value: 7, items: [5, 6, 7] },
    { cap: 6, opType: opEnq, value: 8, items: [5, 6, 7, 8] },
    { cap: 6, opType: opRst, value: 0, items: [] },
    { cap: 6, opType: opDeq, value: 0, items: [] },

    // growing and wrapping
    { cap: 6, opType: opEnq, value: 9, items: [9] },
    { cap: 6, opType: opEnq, value: 10, items: [9, 10] },
    { cap: 6, opType: opEnq, value: 11, items: [9, 10, 11] },
    { cap: 6, opType: opEnq, value: 12, items: [9, 10, 11, 12] },
    { cap: 6, opType: opEnq, value: 13, items: [9, 10, 11, 12, 13] },
    { cap: 6, opType: opEnq, value: 14, items: [9, 10, 11, 12, 13, 14] },
    { cap: 6, opType: opDeq, value: 9, items: [10, 11, 12, 13, 14] },
    { cap: 6, opType: opDeq, value: 10, items: [11, 12, 13, 14] },
    { cap: 6, opType: opEnq, value: 15, items: [11, 12, 13, 14, 15] },
    { cap: 6, opType: opEnq, value: 16, items: [11, 12, 13, 14, 15, 16] },
    { cap: 9, opType: opEnq, value: 17, items: [11, 12, 13, 14, 15, 16, 17] }, // grows wrapped
    { cap: 9, opType: opDeq, value: 11, items: [12, 13, 14, 15, 16, 17] },
    { cap: 9, opType: opDeq, value: 12, items: [13, 14, 15, 16, 17] },
    { cap: 9, opType: opDeq, value: 13, items: [14, 15, 16, 17] },
    { cap: 9, opType: opDeq, value: 14, items: [15, 16, 17] },
    { cap: 9, opType: opDeq, value: 15, items: [16, 17] },
    { cap: 9, opType: opDeq, value: 16, items: [17] },
    { cap: 9, opType: opDeq, value: 17, items: [] },
    { cap: 9, opType: opDeq, value: 0, items: [] },
  );
});

// TestRing/should panic on invalid chunkSize — PORTED
test("TestRing_should_panic_on_invalid_chunkSize", () => {
  // PORTED
  assert.throws(() => {
    New<number>(0);
  });
});

// PORTED: 2, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
