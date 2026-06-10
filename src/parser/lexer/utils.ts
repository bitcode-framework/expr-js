// Port of expr-lang/expr parser/lexer/utils.go
// Unescape logic adapted from Go strconv/quote.go semantics.
// NOTE: Go operates on bytes. This port operates on JS strings (UTF-16). For
// ASCII/BMP source (all expression text), behavior is identical. Documented.

const RuneSelf = 0x80;
const MaxRune = 0x10ffff;

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// unescape takes a quoted string, unquotes, and unescapes it.
export function unescape(value: string): string {
  value = normalizeNewlines(value);
  const n = value.length;
  if (n < 2) {
    throw new Error("unable to unescape string");
  }
  if (value[0] !== value[n - 1] || (value[0] !== '"' && value[0] !== "'")) {
    throw new Error("unable to unescape string");
  }
  value = value.slice(1, n - 1);

  let out = "";
  while (value.length > 0) {
    const [c, , rest] = unescapeChar(value);
    value = rest;
    out += String.fromCodePoint(c);
  }
  return out;
}

// unescapeBytes takes a quoted string, unquotes, and unescapes it as bytes.
export function unescapeBytes(value: string): string {
  value = normalizeNewlines(value);
  const n = value.length;
  if (n < 2) {
    throw new Error("unable to unescape string");
  }
  if (value[0] !== value[n - 1] || (value[0] !== '"' && value[0] !== "'")) {
    throw new Error("unable to unescape string");
  }
  value = value.slice(1, n - 1);

  let out = "";
  while (value.length > 0) {
    const [c, , rest] = unescapeByteChar(value);
    value = rest;
    out += String.fromCharCode(c & 0xff);
  }
  return out;
}

// unescapeChar: [value, multibyte, tail]
function unescapeChar(s: string): [number, boolean, string] {
  const c0 = s.codePointAt(0)!;
  if (c0 >= RuneSelf) {
    const ch = String.fromCodePoint(c0);
    return [c0, true, s.slice(ch.length)];
  }
  if (s[0] !== "\\") {
    return [s.charCodeAt(0), false, s.slice(1)];
  }
  if (s.length <= 1) {
    throw new Error("unable to unescape string, found '\\' as last character");
  }

  const c = s[1]!;
  s = s.slice(2);
  switch (c) {
    case "a":
      return [0x07, false, s];
    case "b":
      return [0x08, false, s];
    case "f":
      return [0x0c, false, s];
    case "n":
      return [0x0a, false, s];
    case "r":
      return [0x0d, false, s];
    case "t":
      return [0x09, false, s];
    case "v":
      return [0x0b, false, s];
    case "\\":
      return [0x5c, false, s];
    case "'":
      return [0x27, false, s];
    case '"':
      return [0x22, false, s];
    case "`":
      return [0x60, false, s];
    case "?":
      return [0x3f, false, s];
    case "x":
    case "X":
    case "u":
    case "U": {
      if (c === "u" && s.length > 0 && s[0] === "{") {
        s = s.slice(1);
        let v = 0;
        let digits = 0;
        while (s.length > 0 && s[0] !== "}") {
          const [x, ok] = unhex(s.charCodeAt(0));
          if (!ok) throw new Error("unable to unescape string");
          if (digits >= 6) throw new Error("unable to unescape string");
          v = (v << 4) | x;
          s = s.slice(1);
          digits++;
        }
        if (s.length === 0 || s[0] !== "}" || digits === 0) {
          throw new Error("unable to unescape string");
        }
        s = s.slice(1);
        if (v > MaxRune) throw new Error("unable to unescape string");
        return [v, true, s];
      }
      let nDigits = 0;
      if (c === "x" || c === "X") nDigits = 2;
      else if (c === "u") nDigits = 4;
      else if (c === "U") nDigits = 8;
      let v = 0;
      if (s.length < nDigits) throw new Error("unable to unescape string");
      for (let j = 0; j < nDigits; j++) {
        const [x, ok] = unhex(s.charCodeAt(j));
        if (!ok) throw new Error("unable to unescape string");
        v = (v << 4) | x;
      }
      s = s.slice(nDigits);
      if (v > MaxRune) throw new Error("unable to unescape string");
      return [v, true, s];
    }
    case "0":
    case "1":
    case "2":
    case "3": {
      if (s.length < 2) {
        throw new Error("unable to unescape octal sequence in string");
      }
      let v = c.charCodeAt(0) - 0x30;
      for (let j = 0; j < 2; j++) {
        const x = s.charCodeAt(j);
        if (x < 0x30 || x > 0x37) {
          throw new Error("unable to unescape octal sequence in string");
        }
        v = v * 8 + (x - 0x30);
      }
      if (v > MaxRune) throw new Error("unable to unescape string");
      return [v, true, s.slice(2)];
    }
    default:
      throw new Error("unable to unescape string");
  }
}

function unescapeByteChar(s: string): [number, boolean, string] {
  const c0 = s.codePointAt(0)!;
  if (s[0] !== "\\") {
    if (c0 >= RuneSelf) {
      const ch = String.fromCodePoint(c0);
      return [c0, true, s.slice(ch.length)];
    }
    return [s.charCodeAt(0), false, s.slice(1)];
  }
  if (s.length <= 1) {
    throw new Error("unable to unescape string, found '\\' as last character");
  }
  const c = s[1]!;
  s = s.slice(2);
  switch (c) {
    case "a":
      return [0x07, false, s];
    case "b":
      return [0x08, false, s];
    case "f":
      return [0x0c, false, s];
    case "n":
      return [0x0a, false, s];
    case "r":
      return [0x0d, false, s];
    case "t":
      return [0x09, false, s];
    case "v":
      return [0x0b, false, s];
    case "\\":
      return [0x5c, false, s];
    case "'":
      return [0x27, false, s];
    case '"':
      return [0x22, false, s];
    case "`":
      return [0x60, false, s];
    case "?":
      return [0x3f, false, s];
    case "x":
    case "X": {
      if (s.length < 2) throw new Error("unable to unescape string");
      const [hi, ok1] = unhex(s.charCodeAt(0));
      const [lo, ok2] = unhex(s.charCodeAt(1));
      if (!ok1 || !ok2) throw new Error("unable to unescape string");
      return [(hi << 4) | lo, false, s.slice(2)];
    }
    case "0":
    case "1":
    case "2":
    case "3": {
      if (s.length < 2) {
        throw new Error("unable to unescape octal sequence in string");
      }
      if (
        s.charCodeAt(0) < 0x30 ||
        s.charCodeAt(0) > 0x37 ||
        s.charCodeAt(1) < 0x30 ||
        s.charCodeAt(1) > 0x37
      ) {
        throw new Error("unable to unescape octal sequence in string");
      }
      const v =
        (c.charCodeAt(0) - 0x30) * 64 +
        (s.charCodeAt(0) - 0x30) * 8 +
        (s.charCodeAt(1) - 0x30);
      if (v > 255) throw new Error("unable to unescape string");
      return [v, false, s.slice(2)];
    }
    default:
      throw new Error("unable to unescape string");
  }
}

function unhex(b: number): [number, boolean] {
  const c = b;
  if (0x30 <= c && c <= 0x39) return [c - 0x30, true];
  if (0x61 <= c && c <= 0x66) return [c - 0x61 + 10, true];
  if (0x41 <= c && c <= 0x46) return [c - 0x41 + 10, true];
  return [0, false];
}
