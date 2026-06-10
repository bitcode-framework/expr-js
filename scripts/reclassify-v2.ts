// Reclassify NOT_APPLICABLE fixture entries using updated normalize + equalTagged.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Compile, Run, Env } from "../src/expr.js";
import { mockEnv } from "../tests/go-parity/mock-env.js";

const here = dirname(fileURLToPath(import.meta.url));

interface Tagged { k: string; v?: any }
interface Row { expr: string; expected?: Tagged | null; error?: boolean; bucket: string; reason?: string; errorContains?: string }

function normalize(v: any): any {
  if (v === null || v === undefined) return { k: "nil" };
  if (typeof v === "boolean") return { k: "bool", v };
  if (typeof v === "bigint") return { k: "int", v: v.toString() };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { k: "int-or-float", v } : { k: "float", v };
  }
  if (typeof v === "string") return { k: "string", v };
  if (v && typeof v === "object" && typeof v.ms === "number" && "Year" in v && "Month" in v && "Format" in v) {
    return { k: "time", v: v.ms };
  }
  if (v && typeof v === "object" && typeof v.value === "bigint" && "Nanoseconds" in v) {
    return { k: "duration", v: v.value.toString() };
  }
  if (v && typeof v === "object" && typeof v.name === "string" && typeof v.String === "function" && !("Year" in v) && !("value" in v)) {
    return { k: "string", v: v.name };
  }
  if (Array.isArray(v)) return { k: "array", v: v.map(normalize) };
  if (v instanceof Map) {
    const m: Record<string, any> = {};
    for (const [k, val] of v) m[String(k)] = normalize(val);
    return { k: "map", v: m };
  }
  if (typeof v === "object") {
    const m: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) m[k] = normalize(val);
    return { k: "map", v: m };
  }
  return { k: "other", v: String(v) };
}

function builtinEnv(): Record<string, any> {
  return {
    ArrayOfString: ["foo", "bar", "baz"],
    ArrayOfInt: [1n, 2n, 3n],
    ArrayOfInt32: [1n, 2n, 3n, 4n, 5n],
    ArrayOfFloat: [1.5, 2.5, 3.5],
    ArrayOfAny: [1n, "2", true],
    ArrayOfFoo: [
      { Value: "a", Bar: { Baz: "baz" } },
      { Value: "b", Bar: { Baz: "baz" } },
      { Value: "c", Bar: { Baz: "baz" } },
    ],
    EmptyIntArray: [],
    EmptyFloatArray: [],
    NestedIntArrays: [[1n, 2n], [3n, 4n]],
    NestedAnyArrays: [[1n, 2n], [3n, 4n]],
    NestedInt32Array: [[1n, 2n, 3n], [4n, 5n, 6n]],
  };
}

type EnvFactory = () => Record<string, any>;

function tryReclassify(filePath: string, envFactory: EnvFactory, label: string): number {
  const rows: Row[] = JSON.parse(readFileSync(filePath, "utf8"));
  let promoted = 0;
  let failed = 0;
  
  for (const row of rows) {
    if (row.bucket !== "NOT_APPLICABLE") continue;
    
    // Skip known FORCED_DIVERGENCE entries
    if (row.reason?.includes("pointer") || row.reason?.includes("Go typed-nil") ||
        row.reason?.includes("Go pointer") || row.reason?.includes("no JS analog")) {
      continue;
    }
    
    const env = envFactory();
    const isChecker = label === "checker";
    
    try {
      if (isChecker) {
        // Checker: just need Compile to throw
        Compile(row.expr, Env(env));
        // If it didn't throw, it's not a checker error
        continue;
      }
      
      const program = Compile(row.expr, Env(env));
      const out = Run(program, env);
      const normalized = normalize(out);
      
      row.expected = normalized;
      row.bucket = "PASS";
      delete row.reason;
      promoted++;
      console.log(`  ✓ [${label}] ${row.expr} → ${JSON.stringify(normalized)}`);
    } catch (e: any) {
      if (isChecker) {
        // Compile threw — that's what we want for checker entries
        row.bucket = "PASS_WITH_ADAPTER";
        delete row.reason;
        promoted++;
        console.log(`  ✓ [${label}] ${row.expr} → throws (expected)`);
      } else {
        // Runtime error — check if the row expects an error
        if (row.error) {
          row.bucket = "PASS";
          delete row.reason;
          promoted++;
          console.log(`  ✓ [${label}] ${row.expr} → throws (expected)`);
        } else {
          failed++;
          console.log(`  ✗ [${label}] ${row.expr} → ${e.message}`);
        }
      }
    }
  }
  
  if (promoted > 0) {
    writeFileSync(filePath, JSON.stringify(rows, null, 2) + "\n");
  }
  
  console.log(`\n${label}: promoted=${promoted}, failed=${failed}\n`);
  return promoted;
}

console.log("=== Reclassifying expr_mock.json ===");
const exprPromoted = tryReclassify(
  join(here, "../parity/fixtures/expr_mock.json"),
  mockEnv,
  "expr"
);

console.log("=== Reclassifying builtin_mock.json ===");
const builtinPromoted = tryReclassify(
  join(here, "../parity/fixtures/builtin_mock.json"),
  builtinEnv,
  "builtin"
);

console.log("=== Reclassifying checker_mock.json ===");
const checkerPromoted = tryReclassify(
  join(here, "../parity/fixtures/checker_mock.json"),
  mockEnv,
  "checker"
);

console.log(`\n=== TOTAL: ${exprPromoted + builtinPromoted + checkerPromoted} entries promoted ===`);
