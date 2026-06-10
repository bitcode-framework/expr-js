// Port of expr-lang/expr debug/debugger.go
//
// DIVERGENCE (FORCED_DIVERGENCE, documented): Go's StartDebugger builds an
// interactive terminal UI with github.com/gdamore/tcell + github.com/rivo/tview
// (a bytecode table, live Stack/Scope panes, step-through navigation driven by
// keyboard events on a goroutine). There is no portable JS equivalent of tcell/
// tview, and a full TUI is explicitly out of scope for parity.
//
// The *data side* of the debugger is fully ported: Program.Disassemble()
// produces the opcode table, and VM exposes the same step machinery. This
// headless StartDebugger reproduces the debugger's INFORMATION (disassembly +
// final stack-trace + output/error) without the interactive widget layer, so
// the REPL `debug` command remains functional. The interactive navigation
// itself is the only forced divergence.
import { Program } from "../vm/program.js";
import { VM, Run as vmRun } from "../vm/vm.js";

// StartDebugger prints the program disassembly, then runs it and prints the
// result (or error). This is the headless analog of Go's tview UI.
export function StartDebugger(program: Program, env: any): void {
  const proc = (globalThis as any).process;
  const write = (s: string): void => {
    if (proc?.stdout?.write) proc.stdout.write(s);
  };

  write("=== Opcodes ===\n");
  write(program.Disassemble() + "\n");

  write("=== Run ===\n");
  const vm = new VM();
  try {
    const out = vm.Run(program, env);
    write(`Output: ${formatValue(out)}\n`);
  } catch (e) {
    write(`Error: ${(e as Error).message}\n`);
  }

  // Surface the final stack for inspection (the Go UI shows a live Stack pane).
  write("=== Stack (final) ===\n");
  for (let i = 0; i < vm.Stack.length; i++) {
    write(`${i}: ${formatValue(vm.Stack[i])}\n`);
  }
}

function formatValue(v: any): string {
  if (typeof v === "bigint") return v.toString();
  if (v === null || v === undefined) return "<nil>";
  if (typeof v === "object" && typeof (v as any).String === "function") {
    return (v as any).String();
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Note: vmRun re-exported for callers that want the non-debug run path.
export { vmRun as Run };
