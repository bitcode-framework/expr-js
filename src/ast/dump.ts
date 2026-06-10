// Port of expr-lang/expr ast/dump.go
//
// Go's dump uses reflect over struct fields. TS divergence: nodes are class
// instances, so we enumerate own enumerable (public) properties instead of
// reflect struct fields. Private fields in Base (loc, nature) are protected
// instance properties; we skip the AST-internal bookkeeping keys (loc, nature)
// to mirror Go's isPrivate() exclusion of unexported fields.
import { Node } from "./node.js";
import { TextDecoderShim } from "./print.js";

const INTERNAL_KEYS = new Set(["loc", "nature"]);

export function Dump(node: Node): string {
  return dump(node, "");
}

function dump(v: unknown, ident: string): string {
  if (v === null || v === undefined) {
    return "nil";
  }

  if (typeof v === "string") {
    return quoteGo(v);
  }
  if (typeof v === "bigint") {
    return v.toString();
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }

  if (Array.isArray(v)) {
    if (v.length === 0) {
      return "[]ast.Node{}";
    }
    let out = "[]ast.Node{\n";
    for (let i = 0; i < v.length; i++) {
      out += `${ident}\t${dump(v[i], ident + "\t")},`;
      if (i + 1 < v.length) {
        out += "\n";
      }
    }
    return out + "\n" + ident + "}";
  }

  if (v instanceof Uint8Array) {
    return quoteGo(new TextDecoderShim().decode(v));
  }

  if (typeof v === "object") {
    const name = (v as object).constructor?.name ?? "";
    let out = name + "{\n";
    for (const key of publicKeys(v as Record<string, unknown>)) {
      const s = (v as Record<string, unknown>)[key];
      out += `${ident}\t${key}: ${dump(s, ident + "\t")},\n`;
    }
    return out + ident + "}";
  }

  return String(v);
}

// publicKeys returns exported-equivalent field names. Go skips unexported
// (lowercase) fields and internal node bookkeeping (loc, nature).
function publicKeys(obj: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    if (INTERNAL_KEYS.has(key)) {
      continue;
    }
    if (isPrivate(key)) {
      continue;
    }
    if (typeof obj[key] === "function") {
      continue;
    }
    keys.push(key);
  }
  return keys;
}

function isPrivate(s: string): boolean {
  return !/^[A-Z]/.test(s);
}

// quoteGo emulates Go's %q string formatting.
function quoteGo(s: string): string {
  return JSON.stringify(s);
}
