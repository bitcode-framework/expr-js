import { parseGoLayout } from "../src/vm/runtime/gotime.ts";
try {
  console.log("Parsing '2006.01.02' with layout '2006.01.02'...");
  const ms = parseGoLayout("2006.01.02", "2006.01.02");
  console.log("ms:", ms, "date:", new Date(ms).toISOString());
} catch (e: any) {
  console.log("error:", e.message);
  console.log("stack:", e.stack?.split("\n").slice(0, 5).join("\n"));
}
// Test basic Date.UTC
console.log("Date.UTC(2006,0,2):", Date.UTC(2006, 0, 2));
console.log("Date.UTC(0,0,1):", Date.UTC(0, 0, 1));
try {
  const ms2 = parseGoLayout("2023-04-23T00:30:00.000+0100", "2006-01-02T15:04:05-0700");
  console.log("ms2:", ms2, "date2:", new Date(ms2).toISOString());
} catch (e: any) {
  console.log("error2:", e.message);
}
