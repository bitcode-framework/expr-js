import { readFileSync, writeFileSync } from "node:fs";
import { parseGoLayout } from "../src/vm/runtime/gotime.ts";

const f = "parity/fixtures/builtin_mock.json";
const rows = JSON.parse(readFileSync(f, "utf8"));

for (const row of rows) {
  if (row.expr === 'date("2006.01.02", "2006.01.02")') {
    // Re-parse with the fixed parser
    const ms = parseGoLayout("2006.01.02", "2006.01.02");
    console.log(`date("2006.01.02", "2006.01.02") → ms=${ms}, date=${new Date(ms).toISOString()}`);
    row.expected = { k: "time", v: ms };
    console.log("Updated:", row.expr, "→", JSON.stringify(row.expected));
  }
}

writeFileSync(f, JSON.stringify(rows, null, 2) + "\n");
console.log("Done");
