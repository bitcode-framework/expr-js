import { readFileSync } from "node:fs";

const fixtures = [
  "parity/fixtures/expr_mock.json",
  "parity/fixtures/builtin_mock.json",
  "parity/fixtures/checker_mock.json",
];

let total = 0;
const categories: Record<string, number> = {};

for (const f of fixtures) {
  const rows = JSON.parse(readFileSync(f, "utf8"));
  for (const row of rows) {
    if (row.bucket === "NOT_APPLICABLE") {
      total++;
      const reason = row.reason || "unknown";
      const key = reason.length > 80 ? reason.slice(0, 80) + "..." : reason;
      categories[key] = (categories[key] || 0) + 1;
      console.log(`  [${f.split("/").pop()}] ${row.expr}`);
      console.log(`    Reason: ${reason}`);
    }
  }
}

console.log(`\n=== Total N/A: ${total} ===`);
console.log("\nBy category:");
for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}x ${cat}`);
}
