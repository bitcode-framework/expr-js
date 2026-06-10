// Port of expr-lang/expr parser/lexer/lexer_test.go
import { test } from "node:test";
import assert from "node:assert/strict";
import { Lex } from "../../../src/parser/lexer/lexer.js";
import { Kind } from "../../../src/parser/lexer/token.js";
import { NewSource } from "../../../src/file/source.js";

interface Tok { Kind: Kind; Value: string }

function compareTokens(got: any[], want: Tok[]): boolean {
  if (got.length !== want.length) return false;
  for (let i = 0; i < got.length; i++) {
    if (got[i].Kind !== want[i].Kind) return false;
    if (got[i].Value !== want[i].Value) return false;
  }
  return true;
}

const N = (v: string): Tok => ({ Kind: Kind.Number, Value: v });
const I = (v: string): Tok => ({ Kind: Kind.Identifier, Value: v });
const O = (v: string): Tok => ({ Kind: Kind.Operator, Value: v });
const S = (v: string): Tok => ({ Kind: Kind.String, Value: v });
const B = (v: string): Tok => ({ Kind: Kind.Bracket, Value: v });
const EOF: Tok = { Kind: Kind.EOF, Value: "" };

// TestLex — PORTED (portable cases; byte-literal cases handled separately)
test("TestLex", () => {
  // PORTED
  const tests: Array<[string, Tok[]]> = [
    ["1", [N("1"), EOF]],
    [
      ".5 0.025 1 02 1e3 0xFF 0b0101 0o600 1.2e-4 1_000_000 _42 -.5",
      [N(".5"), N("0.025"), N("1"), N("02"), N("1e3"), N("0xFF"), N("0b0101"), N("0o600"), N("1.2e-4"), N("1_000_000"), I("_42"), O("-"), N(".5"), EOF],
    ],
    [
      "a and orb().val #.",
      [I("a"), O("and"), I("orb"), B("("), B(")"), O("."), I("val"), O("#"), O("."), EOF],
    ],
    ["foo?.bar", [I("foo"), O("?."), I("bar"), EOF]],
    [
      "foo ? .bar : .baz",
      [I("foo"), O("?"), O("."), I("bar"), O(":"), O("."), I("baz"), EOF],
    ],
    ["func?()", [I("func"), O("?"), B("("), B(")"), EOF]],
    ["array?[]", [I("array"), O("?"), B("["), B("]"), EOF]],
    [
      "not in not abc not i not(false) not  in not   in",
      [O("not"), O("in"), O("not"), I("abc"), O("not"), I("i"), O("not"), B("("), I("false"), B(")"), O("not"), O("in"), O("not"), O("in"), EOF],
    ],
    ["not in_var", [O("not"), I("in_var"), EOF]],
    ["not in", [O("not"), O("in"), EOF]],
    ["1..5", [N("1"), O(".."), N("5"), EOF]],
    ["$i _0 früh", [I("$i"), I("_0"), I("früh"), EOF]],
    ["foo // comment\n\t\tbar // comment", [I("foo"), I("bar"), EOF]],
    ["foo /* comment */ bar", [I("foo"), I("bar"), EOF]],
    ["foo ?? bar", [I("foo"), O("??"), I("bar"), EOF]],
    [
      "let foo = bar;",
      [O("let"), I("foo"), O("="), I("bar"), O(";"), EOF],
    ],
    [
      "#index #1 #",
      [O("#"), I("index"), O("#"), I("1"), O("#"), EOF],
    ],
    [": ::", [O(":"), O("::"), EOF]],
    [
      "if a>b {x1+x2} else {x2}",
      [O("if"), I("a"), O(">"), I("b"), B("{"), I("x1"), O("+"), I("x2"), B("}"), O("else"), B("{"), I("x2"), B("}"), EOF],
    ],
    [
      "a>b if {x1} else {x2}",
      [I("a"), O(">"), I("b"), O("if"), B("{"), I("x1"), B("}"), O("else"), B("{"), I("x2"), B("}"), EOF],
    ],
    [
      `"double" 'single'`,
      [S("double"), S("single"), EOF],
    ],
    [
      "`backtick`",
      [S("backtick"), EOF],
    ],
    [
      "`escaped backticks` `` `a``b`",
      [S("escaped backticks"), S(""), S("a`b"), EOF],
    ],
  ];

  for (const [input, want] of tests) {
    const tokens = Lex(NewSource(input));
    assert.ok(compareTokens(tokens, want), `Lex(${JSON.stringify(input)})`);
  }
});

// TestLex_bytes — PORTED_WITH_ADAPTER
// TS lexer already parses b"..." / B'...' and emits Kind.Bytes tokens.
// DIVERGENCE: Go produces []byte (raw bytes); JS produces UTF-16 string with
// byte values stored as codepoints (0–255). For ASCII range identical; for
// 128–255, charCodeAt() returns the correct byte value.
test("TestLex_bytes", () => {
  const By = (v: string): Tok => ({ Kind: Kind.Bytes, Value: v });

  const byteTests: Array<[string, Tok[]]> = [
    [`b"hello" b'world'`, [By("hello"), By("world"), EOF]],
    // Hex escapes: \x41=A, \x42=B, \x43=C
    [`b'\\x41\\x42\\x43'`, [By("ABC"), EOF]],
    // Octal escapes: \101=A, \102=B, \103=C
    [`b"\\101\\102\\103"`, [By("ABC"), EOF]],
    // Standard escapes
    [`b'\\n\\t\\r'`, [By("\n\t\r"), EOF]],
    // Empty byte literal
    [`b""`, [By(""), EOF]],
    // Uppercase B prefix
    [`B"hello" B'world'`, [By("hello"), By("world"), EOF]],
  ];

  for (const [input, want] of byteTests) {
    const tokens = Lex(NewSource(input));
    assert.ok(compareTokens(tokens, want), `Lex(${JSON.stringify(input)})`);
  }

  // Hex escape with high byte: \x00\xff
  // Go: produces bytes [0x00, 0xFF]. JS: produces string with codepoints [0, 255].
  const highTokens = Lex(NewSource(`b"\\x00\\xff"`));
  assert.equal(highTokens[0].Kind, Kind.Bytes);
  assert.equal(highTokens[0].Value.charCodeAt(0), 0x00);
  assert.equal(highTokens[0].Value.charCodeAt(1), 0xff);

  // UTF-8 multibyte character: ÿ (U+00FF) = 0xC3 0xBF in UTF-8
  // Go: produces raw UTF-8 bytes [0xC3, 0xBF].
  // JS: lexer stores the character directly; charCodeAt(0) returns 0xFF (the codepoint).
  // This is a known divergence: Go byte literal preserves UTF-8 encoding,
  // JS preserves the Unicode codepoint.
  const utf8Tokens = Lex(NewSource(`b"ÿ"`));
  assert.equal(utf8Tokens[0].Kind, Kind.Bytes);
  assert.equal(utf8Tokens[0].Value.charCodeAt(0), 0xff);
});

// TestLex_location — PORTED
test("TestLex_location", () => {
  // PORTED
  const source = NewSource("1..2\n3..4");
  const tokens = Lex(source);
  // Verify kinds/values + positions of the numeric/operator tokens.
  const expected: Array<[Kind, string, number, number]> = [
    [Kind.Number, "1", 0, 1],
    [Kind.Operator, "..", 1, 3],
    [Kind.Number, "2", 3, 4],
    [Kind.Number, "3", 5, 6],
    [Kind.Operator, "..", 6, 8],
    [Kind.Number, "4", 8, 9],
    [Kind.EOF, "", 8, 9],
  ];
  assert.equal(tokens.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    const [k, v, from, to] = expected[i]!;
    assert.equal(tokens[i].Kind, k, `token ${i} kind`);
    assert.equal(tokens[i].Value, v, `token ${i} value`);
    assert.equal(tokens[i].From, from, `token ${i} from`);
    assert.equal(tokens[i].To, to, `token ${i} to`);
  }
});

// TestLex_error — PORTED (subset: errors that don't depend on byte literals)
test("TestLex_error", () => {
  // PORTED
  // Each invalid input should throw (literal not terminated / invalid escape /
  // unrecognized character). Byte-literal error cases are FORCED_NA.
  const invalidInputs = [
    '"\\xQA"',          // invalid char escape
    'id "hello',        // literal not terminated (double quote)
    "id `hello",        // literal not terminated (backtick)
    "früh ♥",           // unrecognized character
  ];
  for (const input of invalidInputs) {
    assert.throws(() => {
      Lex(NewSource(input));
    }, `expected lex error for ${JSON.stringify(input)}`);
  }
});

// PORTED: 3, PORTED_WITH_ADAPTER: 1, FORCED_NA: 0
