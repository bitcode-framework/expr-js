import { Compile, Env } from "../src/expr.ts";
import { mockEnv } from "../tests/go-parity/mock-env.ts";

const exprs = [
  "Foo.Bar.Not",
  "Foo['bar']",
  "Foo.Method(42)",
  "ArrayOfFoo[0].Not",
  "Foo.Bar()",
  "Foo.Bar.Not()",
  "MapOfFoo['str'].Not",
];

for (const expr of exprs) {
  const env = mockEnv();
  try {
    Compile(expr, Env(env));
    console.log(`ACCEPT: ${expr}`);
  } catch (e: any) {
    console.log(`REJECT: ${expr} → ${e.message?.split("\n")[0]}`);
  }
}
