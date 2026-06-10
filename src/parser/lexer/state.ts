// Port of expr-lang/expr parser/lexer/state.go
import * as utils from "../utils/utils.js";
import { Kind } from "./token.js";
import { Lexer, eof } from "./lexer.js";
import { unescape, unescapeBytes } from "./utils.js";

export type StateFn = (l: Lexer) => StateFn | null;

function isSpaceCp(r: number): boolean {
  return r !== eof && utils.IsSpace(String.fromCodePoint(r));
}

function isAlphaNumericCp(r: number): boolean {
  return r !== eof && utils.IsAlphaNumeric(String.fromCodePoint(r));
}

export function root(l: Lexer): StateFn | null {
  const r = l.next();
  if (r === eof) {
    l.emitEOF();
    return null;
  } else if (isSpaceCp(r)) {
    l.skip();
    return root;
  } else if (r === 0x27 || r === 0x22) {
    // ' or "
    l.scanString(r);
    try {
      const str = unescape(l.word());
      l.emitValue(Kind.String, str);
    } catch (e) {
      l.error(String((e as Error).message));
    }
  } else if (r === 0x60) {
    // `
    l.scanRawString(r);
  } else if (
    (r === 0x62 || r === 0x42) &&
    (l.peek() === 0x27 || l.peek() === 0x22)
  ) {
    // b' or b" / B' or B"
    const quote = l.next();
    l.scanString(quote);
    try {
      const str = unescapeBytes(l.word().slice(1)); // skip 'b'
      l.emitValue(Kind.Bytes, str);
    } catch (e) {
      l.error(String((e as Error).message));
    }
  } else if (0x30 <= r && r <= 0x39) {
    // digit
    l.backup();
    return number;
  } else if (r === 0x3f) {
    // ?
    return questionMark;
  } else if (r === 0x2f) {
    // /
    return slash;
  } else if (r === 0x23) {
    // #
    return pointer;
  } else if (r === 0x7c) {
    // |
    l.accept("|");
    l.emit(Kind.Operator);
  } else if (r === 0x3a) {
    // :
    l.accept(":");
    l.emit(Kind.Operator);
  } else if ("([{".includes(String.fromCodePoint(r))) {
    l.emit(Kind.Bracket);
  } else if (")]}".includes(String.fromCodePoint(r))) {
    l.emit(Kind.Bracket);
  } else if (",;%+-^".includes(String.fromCodePoint(r))) {
    l.emit(Kind.Operator);
  } else if ("&!=*<>".includes(String.fromCodePoint(r))) {
    l.accept("&=*");
    l.emit(Kind.Operator);
  } else if (r === 0x2e) {
    // .
    l.backup();
    return dot;
  } else if (isAlphaNumericCp(r)) {
    l.backup();
    return identifier;
  } else {
    return l.error(`unrecognized character: ${formatU(r)}`);
  }
  return root;
}

function formatU(r: number): string {
  // Mimic Go's %#U format, e.g. U+0021 '!'.
  const hex = r.toString(16).toUpperCase().padStart(4, "0");
  return `U+${hex} ${JSON.stringify(String.fromCodePoint(r))}`;
}

function number(l: Lexer): StateFn | null {
  if (!scanNumber(l)) {
    return l.error(`bad number syntax: ${JSON.stringify(l.word())}`);
  }
  l.emit(Kind.Number);
  return root;
}

function scanNumber(l: Lexer): boolean {
  let digits = "0123456789_";
  if (l.accept("0")) {
    if (l.accept("xX")) {
      digits = "0123456789abcdefABCDEF_";
    } else if (l.accept("oO")) {
      digits = "01234567_";
    } else if (l.accept("bB")) {
      digits = "01_";
    }
  }
  l.acceptRun(digits);
  const end = { byte: l.end.byte, rune: l.end.rune };
  if (l.accept(".")) {
    if (l.peek() === 0x2e) {
      // .. range operator: restore saved end.
      l.end = end;
      return true;
    }
    l.acceptRun(digits);
  }
  if (l.accept("eE")) {
    l.accept("+-");
    l.acceptRun(digits);
  }
  const p = l.peek();
  if (p !== eof && utils.IsAlphaNumeric(String.fromCodePoint(p))) {
    l.next();
    return false;
  }
  return true;
}

function dot(l: Lexer): StateFn | null {
  l.next();
  if (l.accept("0123456789")) {
    l.backup();
    return number;
  }
  l.accept(".");
  l.emit(Kind.Operator);
  return root;
}

function identifier(l: Lexer): StateFn | null {
  loop: for (;;) {
    const r = l.next();
    if (isAlphaNumericCp(r)) {
      // absorb
    } else {
      l.backup();
      switch (l.word()) {
        case "not":
          return not;
        case "in":
        case "or":
        case "and":
        case "matches":
        case "contains":
        case "startsWith":
        case "endsWith":
        case "let":
          l.emit(Kind.Operator);
          break;
        case "if":
        case "else":
          if (!l.DisableIfOperator) {
            l.emit(Kind.Operator);
          } else {
            l.emit(Kind.Identifier);
          }
          break;
        default:
          l.emit(Kind.Identifier);
      }
      break loop;
    }
  }
  return root;
}

function not(l: Lexer): StateFn | null {
  l.emit(Kind.Operator);
  l.skipSpaces();
  const end = { byte: l.end.byte, rune: l.end.rune };
  for (;;) {
    const r = l.next();
    if (isAlphaNumericCp(r)) {
      // absorb
    } else {
      l.backup();
      break;
    }
  }
  switch (l.word()) {
    case "in":
    case "matches":
    case "contains":
    case "startsWith":
    case "endsWith":
      l.emit(Kind.Operator);
      break;
    default:
      l.end = end;
  }
  return root;
}

function questionMark(l: Lexer): StateFn | null {
  l.accept(".?");
  l.emit(Kind.Operator);
  return root;
}

function slash(l: Lexer): StateFn | null {
  if (l.accept("/")) {
    return singleLineComment;
  }
  if (l.accept("*")) {
    return multiLineComment;
  }
  l.emit(Kind.Operator);
  return root;
}

function singleLineComment(l: Lexer): StateFn | null {
  for (;;) {
    const r = l.next();
    if (r === eof || r === 0x0a) {
      break;
    }
  }
  l.skip();
  return root;
}

function multiLineComment(l: Lexer): StateFn | null {
  for (;;) {
    const r = l.next();
    if (r === eof) {
      return l.error("unclosed comment");
    }
    if (r === 0x2a && l.accept("/")) {
      break;
    }
  }
  l.skip();
  return root;
}

function pointer(l: Lexer): StateFn | null {
  l.accept("#");
  l.emit(Kind.Operator);
  for (;;) {
    const r = l.next();
    if (isAlphaNumericCp(r)) {
      // absorb
    } else {
      l.backup();
      if (l.word() !== "") {
        l.emit(Kind.Identifier);
      }
      return root;
    }
  }
}
