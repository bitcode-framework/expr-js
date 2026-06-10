// Port of expr-lang/expr parser/utils/utils.go

export function IsValidIdentifier(str: string): boolean {
  if (str.length === 0) {
    return false;
  }
  const chars = Array.from(str);
  const h = chars[0]!;
  if (!IsAlphabetic(h)) {
    return false;
  }
  for (let i = 1; i < chars.length; i++) {
    if (!IsAlphaNumeric(chars[i]!)) {
      return false;
    }
  }
  return true;
}

export function IsSpace(r: string): boolean {
  return /\s/.test(r);
}

export function IsAlphaNumeric(r: string): boolean {
  return IsAlphabetic(r) || IsDigit(r);
}

export function IsAlphabetic(r: string): boolean {
  return r === "_" || r === "$" || IsLetter(r);
}

export function IsDigit(r: string): boolean {
  return r >= "0" && r <= "9";
}

// IsLetter mirrors unicode.IsLetter: any Unicode letter.
export function IsLetter(r: string): boolean {
  return /\p{L}/u.test(r);
}
