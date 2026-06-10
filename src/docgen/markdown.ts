// Port of expr-lang/expr docgen/markdown.go
// Renders a Context to Markdown. Attached to Context.prototype in index.ts.
import type { Context, DocType, Identifier, TypeName } from "./docgen.js";

function link(t: DocType | undefined | null): string {
  if (t === null || t === undefined) {
    return "nil";
  }
  if (t.name !== undefined && t.name !== "") {
    return `[${t.name}](#${t.name})`;
  }
  if (t.kind === "array") {
    return `array(${link(t.type)})`;
  }
  if (t.kind === "map") {
    return `map(${link(t.key)} => ${link(t.type)})`;
  }
  return `\`${t.kind}\``;
}

function fields(t: DocType): string {
  const names = Object.keys(t.fields ?? {}).sort();
  let out = "";
  let foundFields = false;
  for (const name of names) {
    const v = t.fields![name]!;
    if (v.kind !== "func") {
      if (!foundFields) {
        out += "| Field | Type |\n|---|---|\n";
      }
      foundFields = true;
      out += `| ${name} | ${link(v)} |\n`;
    }
  }
  let foundMethod = false;
  for (const name of names) {
    const v = t.fields![name]!;
    if (v.kind === "func") {
      if (!foundMethod) {
        out += "\n| Method | Returns |\n|---|---|\n";
      }
      foundMethod = true;
      const args = (v.arguments ?? []).map((a) => link(a));
      out += `| ${name}(${args.join(", ")}) | ${link(v.return)} |\n`;
    }
  }
  return out;
}

export function Markdown(c: Context): string {
  const variables: string[] = Object.keys(c.Variables).sort();
  const types: string[] = Object.keys(c.Types).sort();

  let out = `### Variables
| Name | Type |
|------|------|
`;
  for (const name of variables) {
    const v = c.Variables[name as Identifier]!;
    if (v.kind === "func") continue;
    if (v.kind === "operator") continue;
    out += `| ${name} | ${link(v)} |\n`;
  }

  out += `
### Functions
| Name | Return type |
|------|-------------|
`;
  for (const name of variables) {
    const v = c.Variables[name as Identifier]!;
    if (v.kind === "func") {
      const args = (v.arguments ?? []).map((a) => link(a));
      out += `| ${name}(${args.join(", ")}) | ${link(v.return)} |\n`;
    }
  }

  out += "\n### Types\n";
  for (const name of types) {
    const t = c.Types[name as TypeName]!;
    out += `#### ${name}\n`;
    out += fields(t);
    out += "\n";
  }

  return out;
}
