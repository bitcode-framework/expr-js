import { readFileSync, writeFileSync } from "node:fs";

const f = "parity/fixtures/builtin_mock.json";
const rows = JSON.parse(readFileSync(f, "utf8"));
for (const row of rows) {
  if (row.expr === 'now().Format("2006-01-02T15:04Z")') {
    row.bucket = "NOT_APPLICABLE";
    row.reason = "Dynamic: now() returns current time, expected value changes per run";
    delete row.expected;
    console.log("Reverted:", row.expr);
  }
}
writeFileSync(f, JSON.stringify(rows, null, 2) + "\n");
console.log("Done");
