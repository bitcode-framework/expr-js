import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const files = [
  "src/checker/func_types.generated.ts",
  "src/patcher/value/valuer_methods.generated.ts",
  "src/checker/nature/std_types.generated.ts",
  "parity/metadata/visible_fields.generated.json",
  "parity/metadata/named_types.generated.json",
  "parity/metadata/builtins.generated.json",
  "parity/fixtures/time_layout.generated.json",
  "GENERATED_DIVERGENCES.md",
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const before = new Map();
for (const rel of files) {
  const file = resolve(root, rel);
  if (!existsSync(file)) {
    throw new Error(`missing generated file before verification: ${rel}`);
  }
  before.set(rel, readFileSync(file, "utf8"));
}

execFileSync(process.execPath, ["scripts/sync-go.mjs"], { cwd: root, stdio: "inherit" });

const drifted = [];
for (const rel of files) {
  const after = readFileSync(resolve(root, rel), "utf8");
  if (after !== before.get(rel)) drifted.push(rel);
}

if (drifted.length > 0) {
  console.error("Generated parity metadata drift detected:");
  for (const rel of drifted) console.error(`- ${rel}`);
  process.exit(1);
}

console.log(`parity:verify OK (${files.length} generated artifacts stable)`);
