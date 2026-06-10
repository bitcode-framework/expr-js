// Port of expr-lang/expr docgen package barrel.
// Attaches Markdown() to Context (Go defines it as a method on *Context).
import { Context } from "./docgen.js";
import { Markdown as renderMarkdown } from "./markdown.js";

Context.prototype.Markdown = function (this: Context): string {
  return renderMarkdown(this);
};

export { Context, CreateDoc, Operators, Builtins } from "./docgen.js";
export type { DocType, Kind, Identifier, TypeName } from "./docgen.js";
