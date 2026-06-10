// Port of expr-lang/expr vm/program_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Program } from "../../../src/vm/program.js";
import { Opcode } from "../../../src/vm/opcodes.js";
import { Source } from "../../../src/file/source.js";

// TestProgram_Disassemble — PORTED
test("TestProgram_Disassemble", () => {
  // PORTED
  // Go constructs vm.Program{Constants, Bytecode, Arguments} as a struct literal.
  // The TS Program constructor requires all fields; we supply minimal defaults.
  for (let op = Opcode.OpPush; op < Opcode.OpEnd; op++) {
    const program = new Program(
      new Source(""),
      null,
      [],
      0,
      [1, 2],
      [op],
      [1],
      [],
      new Map<string, string>(),
      null,
    );
    const d = program.Disassemble();
    assert.ok(!d.includes("(unknown)"), `cannot disassemble all opcodes (op=${op})`);
  }
});

// PORTED: 1, PORTED_WITH_ADAPTER: 0, FORCED_NA: 0
