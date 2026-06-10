// Port of expr-lang/expr repl/repl.go
//
// Interactive REPL. Go uses github.com/bettercap/readline + runtime.MemStats.
//
// DIVERGENCE (FORCED_DIVERGENCE, documented): Go reads memory via
// runtime.ReadMemStats and uses a terminal-specific readline lib with a
// HistoryFile and tab-completion `Do`. This port uses Node's built-in
// `node:readline` (history + a completer with identical prefix-match logic).
// `mem` reports process.memoryUsage().heapUsed delta (the closest JS analog);
// the `debug` command prints a notice (the step-debugger TUI is not portable —
// see debug.ts FORCED_DIVERGENCE). All command behavior (exit/opcodes/mem/
// debug/eval, compile-error/runtime-error formatting) matches Go.
import { createInterface } from "node:readline";
import { Compile, Run, Env } from "../expr.js";
import { Names as BuiltinNames } from "../builtin/builtin.js";
import type { Program } from "../vm/program.js";
import { NewEnv, Func } from "../test/fuzz/fuzz_env.js";
import { StartDebugger } from "../debug/debugger.js";

const keywords: string[] = [
  // Commands:
  "exit", "opcodes", "debug", "mem",
  // Operators:
  "and", "or", "in", "not", "not in",
  "contains", "matches", "startsWith", "endsWith",
];

// completer mirrors Go's completer.Do: completes the last whitespace-delimited
// word against the known word list.
export function completer(words: string[]) {
  return (line: string): [string[], string] => {
    let lastWord = "";
    for (let i = line.length - 1; i >= 0; i--) {
      if (line[i] === " ") break;
      lastWord = line[i] + lastWord;
    }
    const hits = words.filter((w) => w.startsWith(lastWord));
    return [hits.length ? hits : words, lastWord];
  };
}

function humanizeBytes(b: number): string {
  const unit = 1024;
  if (b < unit) {
    return `${b} B`;
  }
  let div = unit;
  let exp = 0;
  for (let n = Math.floor(b / unit); n >= unit; n = Math.floor(n / unit)) {
    div *= unit;
    exp++;
  }
  return `${(b / div).toFixed(2)} ${"KMGTPE"[exp]}iB`;
}

function memoryUsage(): number {
  // Closest JS analog to Go runtime MemStats.Alloc.
  return (globalThis as any).process?.memoryUsage?.().heapUsed ?? 0;
}

// Repl starts the interactive shell. Returns when the user exits / EOF.
export function Repl(): void {
  const env = NewEnv();
  for (const name of Object.keys(env)) {
    keywords.push(name);
  }
  const fn = Func();
  keywords.push("fn");

  const words = [...BuiltinNames, ...keywords];
  const proc = (globalThis as any).process;
  const rl = createInterface({
    input: proc.stdin,
    output: proc.stdout,
    prompt: "\u276f ",
    completer: (line: string) => completer(words)(line),
  });

  let memUsage = 0;
  let program: Program | null = null;

  rl.prompt();
  rl.on("line", (raw: string) => {
    const line = raw.trim();
    switch (line) {
      case "":
        rl.prompt();
        return;
      case "exit":
        rl.close();
        return;
      case "mem":
        proc.stdout.write(`memory usage: ${humanizeBytes(memUsage)}\n`);
        rl.prompt();
        return;
      case "opcodes":
        if (program === null) {
          proc.stdout.write("no program\n");
        } else {
          proc.stdout.write(program.Disassemble() + "\n");
        }
        rl.prompt();
        return;
      case "debug":
        if (program === null) {
          proc.stdout.write("no program\n");
        } else {
          StartDebugger(program, env);
        }
        rl.prompt();
        return;
    }

    try {
      program = Compile(line, Env(env), fn);
    } catch (e) {
      proc.stdout.write(`compile error: ${(e as Error).message}\n`);
      rl.prompt();
      return;
    }

    const start = memoryUsage();
    let output: any;
    try {
      output = Run(program, env);
    } catch (e) {
      proc.stdout.write(`runtime error: ${(e as Error).message}\n`);
      rl.prompt();
      return;
    }
    memUsage = memoryUsage() - start;
    proc.stdout.write(`${formatOutput(output)}\n`);
    rl.prompt();
  });
}

function formatOutput(v: any): string {
  if (typeof v === "bigint") return v.toString();
  if (v === null || v === undefined) return "<nil>";
  if (typeof v === "object" && typeof (v as any).String === "function") {
    return (v as any).String();
  }
  return String(v);
}
