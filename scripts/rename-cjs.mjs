import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

// Rename emitted .js -> .cjs in dist/cjs and fix relative require paths.
const dir = fileURLToPath(new URL("../dist/cjs/", import.meta.url));

async function walk(d) {
  const entries = await readdir(d, { withFileTypes: true });
  for (const e of entries) {
    const p = join(d, e.name);
    if (e.isDirectory()) {
      await walk(p);
    } else if (extname(e.name) === ".js") {
      let content = await readFile(p, "utf8");
      content = content.replace(/require\("(\.[^"]*?)"\)/g, (m, spec) => {
        if (spec.endsWith(".js")) return `require("${spec.slice(0, -3)}.cjs")`;
        return `require("${spec}.cjs")`;
      });
      const target = p.replace(/\.js$/, ".cjs");
      await writeFile(target, content, "utf8");
    }
  }
}

await walk(dir);
console.log("CJS rename complete");
