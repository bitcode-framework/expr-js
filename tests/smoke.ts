import { Compile, Run, Eval } from "../src/expr.js";

const cases: [string, any, any][] = [
  ["1 + 2", null, 3n],
  ["2 * 3 + 1", null, 7n],
  ["1 / 2", null, 0.5],
  ["10 % 3", null, 1n],
  ["2 ** 10", null, 1024],
  ["'foo' + 'bar'", null, "foobar"],
  ["true && false", null, false],
  ["true || false", null, true],
  ["1 < 2", null, true],
  ["1 == 1.0", null, true],
  ["[1, 2, 3]", null, [1n, 2n, 3n]],
  ["len([1,2,3])", null, 3n],
  ["[1,2,3][1]", null, 2n],
  ["1 in [1,2,3]", null, true],
  ["x + y", { x: 5n, y: 3n }, 8n],
  ["user.age", { user: { age: 30n } }, 30n],
  ["filter([1,2,3,4], # > 2)", null, [3n, 4n]],
  ["map([1,2,3], # * 2)", null, [2n, 4n, 6n]],
  ["all([1,2,3], # > 0)", null, true],
  ["1 > 2 ? 'a' : 'b'", null, "b"],
  ["let x = 5; x + 1", null, 6n],
];

let pass = 0;
let fail = 0;
for (const [expr, env, expected] of cases) {
  try {
    const out = Eval(expr, env);
    const ok = JSON.stringify(serialize(out)) === JSON.stringify(serialize(expected));
    if (ok) {
      pass++;
    } else {
      fail++;
      console.log(`FAIL: ${expr} => ${fmt(out)} (expected ${fmt(expected)})`);
    }
  } catch (e) {
    fail++;
    console.log(`ERROR: ${expr} => ${(e as Error).message}`);
  }
}

// Also exercise the Compile+Run path.
try {
  const p = Compile("a * b + 1");
  const out = Run(p, { a: 3n, b: 4n });
  console.log(`Compile/Run: a*b+1 with a=3,b=4 => ${fmt(out)} (expected 13)`);
} catch (e) {
  console.log(`Compile/Run ERROR: ${(e as Error).message}`);
}

console.log(`\nSmoke: ${pass} passed, ${fail} failed`);
(globalThis as any).process.exit(fail > 0 ? 1 : 0);

function serialize(v: any): any {
  if (typeof v === "bigint") return `int:${v}`;
  if (Array.isArray(v)) return v.map(serialize);
  return v;
}
function fmt(v: any): string {
  if (typeof v === "bigint") return `${v}n`;
  return JSON.stringify(v);
}
