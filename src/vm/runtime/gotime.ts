// GoTime / GoDuration: TS models of Go's time.Time and time.Duration.
// DIVERGENCE (documented in PARITY.md): Go uses time.Time/time.Duration with
// reflection identity. This port wraps a JS epoch-millis value and a bigint
// nanosecond duration, exposing the method surface expr relies on
// (Year/Month/Day/Hour/.../Before/After/Equal/Add/Sub, Duration arithmetic).

export class GoDuration {
  // nanoseconds, like Go time.Duration (int64)
  value: bigint;
  constructor(value: bigint) {
    this.value = value;
  }
  Nanoseconds(): bigint {
    return this.value;
  }
  Microseconds(): bigint {
    return this.value / 1000n;
  }
  Milliseconds(): bigint {
    return this.value / 1000000n;
  }
  Seconds(): number {
    return Number(this.value) / 1e9;
  }
  Minutes(): number {
    return Number(this.value) / 6e10;
  }
  Hours(): number {
    return Number(this.value) / 3.6e12;
  }
  String(): string {
    return formatDuration(this.value);
  }
}

// GoLocation models Go's *time.Location for timezone-aware time operations.
// Uses Intl.DateTimeFormat for offset computation (no external dependencies).
export class GoLocation {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  String(): string {
    return this.name;
  }
}

// UTC location constant.
export const UTC = new GoLocation("UTC");

// Compute the UTC offset (in ms) for a given IANA timezone at a given UTC instant.
function getTimezoneOffsetMs(utcMs: number, tz: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const get = (type: string): number => {
    const p = parts.find((p) => p.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };
  let h = get("hour");
  if (h === 24) h = 0;
  const tzAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    h,
    get("minute"),
    get("second"),
  );
  return tzAsUtc - utcMs;
}

// Parse a date string as local time in the given IANA timezone.
// Returns epoch milliseconds adjusted so that the local time in `tz`
// matches the parsed date string.
export function parseInTimezone(dateStr: string, tz: string): number {
  const normalized = dateStr.replace(" ", "T");
  const asUtc = Date.parse(normalized + "Z");
  if (Number.isNaN(asUtc)) {
    throw new Error(`invalid date ${dateStr}`);
  }
  const offset1 = getTimezoneOffsetMs(asUtc, tz);
  const adjusted = asUtc - offset1;
  const offset2 = getTimezoneOffsetMs(adjusted, tz);
  if (offset1 !== offset2) {
    return asUtc - offset2;
  }
  return adjusted;
}

export class GoTime {
  ms: number;
  location: GoLocation;
  constructor(ms: number, location?: GoLocation) {
    this.ms = ms;
    this.location = location ?? UTC;
  }
  private d(): Date {
    return new Date(this.ms);
  }
  private localParts(): Intl.DateTimeFormatPart[] {
    const tz = this.location.name;
    if (tz === "UTC") {
      return [];
    }
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return formatter.formatToParts(this.d());
  }
  localGet(type: string): number {
    if (this.location.name === "UTC") {
      const d = this.d();
      switch (type) {
        case "year": return d.getUTCFullYear();
        case "month": return d.getUTCMonth() + 1;
        case "day": return d.getUTCDate();
        case "hour": return d.getUTCHours();
        case "minute": return d.getUTCMinutes();
        case "second": return d.getUTCSeconds();
        default: return 0;
      }
    }
    const parts = this.localParts();
    const p = parts.find((p) => p.type === type);
    if (!p) return 0;
    let v = parseInt(p.value, 10);
    if (type === "hour" && v === 24) v = 0;
    return v;
  }
  Year(): bigint {
    return BigInt(this.localGet("year"));
  }
  Month(): bigint {
    return BigInt(this.localGet("month"));
  }
  Day(): bigint {
    return BigInt(this.localGet("day"));
  }
  Hour(): bigint {
    return BigInt(this.localGet("hour"));
  }
  Minute(): bigint {
    return BigInt(this.localGet("minute"));
  }
  Second(): bigint {
    return BigInt(this.localGet("second"));
  }
  Before(t: GoTime): boolean {
    return this.ms < t.ms;
  }
  After(t: GoTime): boolean {
    return this.ms > t.ms;
  }
  Equal(t: GoTime): boolean {
    return this.ms === t.ms;
  }
  Add(d: GoDuration): GoTime {
    return new GoTime(this.ms + Number(d.value / 1000000n), this.location);
  }
  Sub(t: GoTime): GoDuration {
    return new GoDuration(BigInt(Math.round(this.ms - t.ms)) * 1000000n);
  }
  Unix(): bigint {
    return BigInt(Math.floor(this.ms / 1000));
  }
  Location(): GoLocation {
    return this.location;
  }
  // Format supports Go time layout strings.
  // Reference time: Mon Jan 2 15:04:05 MST 2006 (Unix 1136239445).
  Format(layout: string): string {
    if (layout === "RFC3339") {
      layout = "2006-01-02T15:04:05Z07:00";
    }
    return formatGoLayout(layout, this);
  }
  String(): string {
    if (this.location.name === "UTC") {
      return formatGoLayout("2006-01-02 15:04:05.999999999 -0700 MST", this);
    }
    return formatGoLayout("2006-01-02 15:04:05.999999999 -0700 MST", this);
  }
}

// --- Go time layout parser/formatter ---
// Reference time: Mon Jan 2 15:04:05 MST 2006 (Unix 1136239445)

const MONTHS_FULL = ["", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MONTHS_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getOffsetComponents(ms: number, locName: string): { sign: string; hh: string; mm: string; ss: string; abbr: string } {
  if (locName === "UTC") {
    return { sign: "+", hh: "00", mm: "00", ss: "00", abbr: "UTC" };
  }
  const offsetMs = getTimezoneOffsetMs(ms, locName);
  const totalSec = Math.round(offsetMs / 1000);
  const sign = totalSec >= 0 ? "+" : "-";
  const absSec = Math.abs(totalSec);
  const h = Math.floor(absSec / 3600);
  const m = Math.floor((absSec % 3600) / 60);
  const s = absSec % 60;
  const abbr = `${sign}${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
  return {
    sign,
    hh: String(h).padStart(2, "0"),
    mm: String(m).padStart(2, "0"),
    ss: String(s).padStart(2, "0"),
    abbr,
  };
}

function formatGoLayout(layout: string, t: GoTime): string {
  const year = t.localGet("year");
  const month = t.localGet("month");
  const day = t.localGet("day");
  const hour = t.localGet("hour");
  const minute = t.localGet("minute");
  const second = t.localGet("second");
  const dow = new Date(t.ms).getUTCDay();
  const offset = getOffsetComponents(t.ms, t.location.name);

  let out = "";
  let i = 0;
  while (i < layout.length) {
    const rest = layout.slice(i);

    // Try longest-match token recognition
    let matched = false;

    // Full month name
    if (rest.startsWith("January")) {
      out += MONTHS_FULL[month];
      i += 7; matched = true; continue;
    }
    // Abbreviated month
    if (rest.startsWith("Jan")) {
      out += MONTHS_ABBR[month];
      i += 3; matched = true; continue;
    }
    // Full weekday
    if (rest.startsWith("Monday")) {
      out += WEEKDAYS_FULL[dow];
      i += 6; matched = true; continue;
    }
    // Abbreviated weekday
    if (rest.startsWith("Mon")) {
      out += WEEKDAYS_ABBR[dow];
      i += 3; matched = true; continue;
    }
    // 4-digit year
    if (rest.startsWith("2006")) {
      out += String(year).padStart(4, "0");
      i += 4; matched = true; continue;
    }
    // 2-digit year (only if not followed by more digits that would form a longer token)
    if (rest.startsWith("06")) {
      out += String(year % 100).padStart(2, "0");
      i += 2; matched = true; continue;
    }
    // 2-digit month (zero-padded)
    if (rest.startsWith("01")) {
      out += String(month).padStart(2, "0");
      i += 2; matched = true; continue;
    }
    // Variable month (no padding) — only if not "01"
    if (rest[0] === "1" && !rest.startsWith("15")) {
      // Check it's actually a month token (not part of a longer number)
      // In Go, "1" is month when preceded by date context. We use it when it's not "15".
      out += String(month);
      i += 1; matched = true; continue;
    }
    // 2-digit day (zero-padded)
    if (rest.startsWith("02")) {
      out += String(day).padStart(2, "0");
      i += 2; matched = true; continue;
    }
    // Space-padded day
    if (rest.startsWith("_2")) {
      out += String(day).padStart(2, " ");
      i += 2; matched = true; continue;
    }
    // Variable day (no padding)
    if (rest[0] === "2" && !rest.startsWith("20")) {
      out += String(day);
      i += 1; matched = true; continue;
    }
    // 24-hour (zero-padded)
    if (rest.startsWith("15")) {
      out += String(hour).padStart(2, "0");
      i += 2; matched = true; continue;
    }
    // 12-hour (zero-padded)
    if (rest.startsWith("03")) {
      const h12 = hour % 12 || 12;
      out += String(h12).padStart(2, "0");
      i += 2; matched = true; continue;
    }
    // 12-hour (no padding)
    if (rest[0] === "3" && !rest.startsWith("30")) {
      const h12 = hour % 12 || 12;
      out += String(h12);
      i += 1; matched = true; continue;
    }
    // Minute (zero-padded)
    if (rest.startsWith("04")) {
      out += String(minute).padStart(2, "0");
      i += 2; matched = true; continue;
    }
    // Minute (no padding)
    if (rest[0] === "4") {
      out += String(minute);
      i += 1; matched = true; continue;
    }
    // Second (zero-padded)
    if (rest.startsWith("05")) {
      out += String(second).padStart(2, "0");
      i += 2; matched = true; continue;
    }
    // Second (no padding)
    if (rest[0] === "5") {
      out += String(second);
      i += 1; matched = true; continue;
    }
    // Fractional seconds: .000... (zero-padded) or .999... (trailing zeros stripped)
    // Require at least 2 consecutive fraction digits to avoid false match on
    // date separators like "2006.01.02" where ".0" is a literal dot + month.
    if (rest[0] === "." && (rest[1] === "0" || rest[1] === "9") && rest.length > 2 && rest[2] === rest[1]) {
      let fracLen = 1;
      const fracChar = rest[1];
      while (fracLen < rest.length && rest[fracLen] === fracChar) fracLen++;
      // fracLen includes the dot
      const numDigits = fracLen - 1;
      // Get fractional ms
      const d = new Date(t.ms);
      const fracMs = d.getUTCMilliseconds();
      const fracStr = String(fracMs).padStart(3, "0");
      const padded = fracStr.padEnd(numDigits, "0").slice(0, numDigits);
      if (fracChar === "9") {
        // Strip trailing zeros
        out += "." + padded.replace(/0+$/, "");
      } else {
        out += "." + padded;
      }
      i += fracLen; matched = true; continue;
    }
    // AM/PM uppercase
    if (rest.startsWith("PM")) {
      out += hour >= 12 ? "PM" : "AM";
      i += 2; matched = true; continue;
    }
    // am/pm lowercase
    if (rest.startsWith("pm")) {
      out += hour >= 12 ? "pm" : "am";
      i += 2; matched = true; continue;
    }
    // Z07:00 — Z or ±HH:MM
    if (rest.startsWith("Z07:00")) {
      if (t.location.name === "UTC") {
        out += "Z";
      } else {
        out += `${offset.sign}${offset.hh}:${offset.mm}`;
      }
      i += 6; matched = true; continue;
    }
    // Z0700 — Z or ±HHMM
    if (rest.startsWith("Z0700")) {
      if (t.location.name === "UTC") {
        out += "Z";
      } else {
        out += `${offset.sign}${offset.hh}${offset.mm}`;
      }
      i += 5; matched = true; continue;
    }
    // -07:00 — ±HH:MM
    if (rest.startsWith("-07:00")) {
      out += `${offset.sign}${offset.hh}:${offset.mm}`;
      i += 6; matched = true; continue;
    }
    // -0700 — ±HHMM
    if (rest.startsWith("-0700")) {
      out += `${offset.sign}${offset.hh}${offset.mm}`;
      i += 5; matched = true; continue;
    }
    // -07 — ±HH
    if (rest.startsWith("-07")) {
      out += `${offset.sign}${offset.hh}`;
      i += 3; matched = true; continue;
    }
    // MST — timezone abbreviation
    if (rest.startsWith("MST")) {
      out += t.location.name === "UTC" ? "UTC" : offset.abbr;
      i += 3; matched = true; continue;
    }

    if (!matched) {
      // Literal character
      out += layout[i];
      i++;
    }
  }
  return out;
}

// Parse a date string using a Go layout. Returns epoch milliseconds.
// Only handles the layout tokens that appear in test fixtures.
export function parseGoLayout(value: string, layout: string): number {
  let year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0, fracMs = 0;
  let offsetSign = "+", offsetHh = 0, offsetMm = 0;
  let hasOffset = false;
  let is12h = false, isPm = false;

  let vi = 0; // value index
  let li = 0; // layout index

  while (li < layout.length && vi <= value.length) {
    const rest = layout.slice(li);

    // Try tokens in same order as formatter
    let tokenLen = 0;

    if (rest.startsWith("January")) {
      const name = value.slice(vi, vi + 3);
      const idx = MONTHS_ABBR.findIndex((m, i) => i > 0 && m.toLowerCase() === name.toLowerCase());
      if (idx > 0) month = idx;
      // Read full month name
      let end = vi;
      while (end < value.length && /[a-zA-Z]/.test(value[end]!)) end++;
      const fullName = value.slice(vi, end);
      const fullIdx = MONTHS_FULL.findIndex((m, i) => i > 0 && m.toLowerCase() === fullName.toLowerCase());
      if (fullIdx > 0) month = fullIdx;
      vi = end;
      tokenLen = 7;
    } else if (rest.startsWith("Jan")) {
      const name = value.slice(vi, vi + 3);
      const idx = MONTHS_ABBR.findIndex((m, i) => i > 0 && m.toLowerCase() === name.toLowerCase());
      if (idx > 0) month = idx;
      vi += 3;
      tokenLen = 3;
    } else if (rest.startsWith("Monday")) {
      // Skip weekday name
      let end = vi;
      while (end < value.length && /[a-zA-Z]/.test(value[end]!)) end++;
      vi = end;
      tokenLen = 6;
    } else if (rest.startsWith("Mon")) {
      vi += 3;
      tokenLen = 3;
    } else if (rest.startsWith("2006")) {
      year = parseInt(value.slice(vi, vi + 4), 10);
      vi += 4;
      tokenLen = 4;
    } else if (rest.startsWith("06")) {
      year = 2000 + parseInt(value.slice(vi, vi + 2), 10);
      vi += 2;
      tokenLen = 2;
    } else if (rest.startsWith("01")) {
      month = parseInt(value.slice(vi, vi + 2), 10);
      vi += 2;
      tokenLen = 2;
    } else if (rest[0] === "1" && !rest.startsWith("15")) {
      // Variable-width month
      let end = vi;
      while (end < value.length && /\d/.test(value[end]!)) end++;
      // But cap at 2 digits
      const digits = Math.min(end - vi, 2);
      month = parseInt(value.slice(vi, vi + digits), 10);
      vi += digits;
      tokenLen = 1;
    } else if (rest.startsWith("02")) {
      day = parseInt(value.slice(vi, vi + 2), 10);
      vi += 2;
      tokenLen = 2;
    } else if (rest.startsWith("_2")) {
      const s = value.slice(vi, vi + 2).trim();
      day = parseInt(s, 10);
      vi += 2;
      tokenLen = 2;
    } else if (rest[0] === "2" && !rest.startsWith("20")) {
      let end = vi;
      while (end < value.length && /\d/.test(value[end]!)) end++;
      const digits = Math.min(end - vi, 2);
      day = parseInt(value.slice(vi, vi + digits), 10);
      vi += digits;
      tokenLen = 1;
    } else if (rest.startsWith("15")) {
      hour = parseInt(value.slice(vi, vi + 2), 10);
      vi += 2;
      tokenLen = 2;
    } else if (rest.startsWith("03")) {
      hour = parseInt(value.slice(vi, vi + 2), 10);
      is12h = true;
      vi += 2;
      tokenLen = 2;
    } else if (rest[0] === "3" && !rest.startsWith("30")) {
      let end = vi;
      while (end < value.length && /\d/.test(value[end]!)) end++;
      hour = parseInt(value.slice(vi, end), 10);
      is12h = true;
      vi = end;
      tokenLen = 1;
    } else if (rest.startsWith("04")) {
      minute = parseInt(value.slice(vi, vi + 2), 10);
      vi += 2;
      tokenLen = 2;
    } else if (rest[0] === "4") {
      let end = vi;
      while (end < value.length && /\d/.test(value[end]!)) end++;
      minute = parseInt(value.slice(vi, end), 10);
      vi = end;
      tokenLen = 1;
    } else if (rest.startsWith("05")) {
      second = parseInt(value.slice(vi, vi + 2), 10);
      vi += 2;
      tokenLen = 2;
    } else if (rest[0] === "5") {
      let end = vi;
      while (end < value.length && /\d/.test(value[end]!)) end++;
      second = parseInt(value.slice(vi, end), 10);
      vi = end;
      tokenLen = 1;
    } else if (rest[0] === "." && (rest[1] === "0" || rest[1] === "9") && rest.length > 2 && rest[2] === rest[1]) {
      // Fractional seconds: .000... (zero-padded) or .999... (trailing zeros stripped)
      // Require at least 2 consecutive fraction digits to avoid false match on
      // date separators like "2006.01.02" where ".0" is a literal dot + month.
      let fracLen = 1;
      const fracChar = rest[1];
      while (fracLen < rest.length && rest[fracLen] === fracChar) fracLen++;
      // Expect dot in value
      if (value[vi] === ".") {
        vi++;
        let end = vi;
        while (end < value.length && /\d/.test(value[end]!)) end++;
        const fracStr = value.slice(vi, end);
        // Convert to ms (3 digits)
        const padded = fracStr.padEnd(3, "0").slice(0, 3);
        fracMs = parseInt(padded, 10);
        vi = end;
      }
      tokenLen = fracLen;
    } else if (rest.startsWith("PM")) {
      const s = value.slice(vi, vi + 2).toUpperCase();
      isPm = s === "PM";
      vi += 2;
      tokenLen = 2;
    } else if (rest.startsWith("pm")) {
      const s = value.slice(vi, vi + 2).toLowerCase();
      isPm = s === "pm";
      vi += 2;
      tokenLen = 2;
    } else if (rest.startsWith("Z07:00")) {
      if (value[vi] === "Z") {
        hasOffset = true; offsetSign = "+"; offsetHh = 0; offsetMm = 0;
        vi += 1;
      } else {
        offsetSign = value[vi]!;
        offsetHh = parseInt(value.slice(vi + 1, vi + 3), 10);
        offsetMm = parseInt(value.slice(vi + 4, vi + 6), 10);
        hasOffset = true;
        vi += 6;
      }
      tokenLen = 6;
    } else if (rest.startsWith("Z0700")) {
      if (value[vi] === "Z") {
        hasOffset = true; offsetSign = "+"; offsetHh = 0; offsetMm = 0;
        vi += 1;
      } else {
        offsetSign = value[vi]!;
        offsetHh = parseInt(value.slice(vi + 1, vi + 3), 10);
        offsetMm = parseInt(value.slice(vi + 3, vi + 5), 10);
        hasOffset = true;
        vi += 5;
      }
      tokenLen = 5;
    } else if (rest.startsWith("-07:00")) {
      offsetSign = value[vi]!;
      offsetHh = parseInt(value.slice(vi + 1, vi + 3), 10);
      offsetMm = parseInt(value.slice(vi + 4, vi + 6), 10);
      hasOffset = true;
      vi += 6;
      tokenLen = 6;
    } else if (rest.startsWith("-0700")) {
      offsetSign = value[vi]!;
      offsetHh = parseInt(value.slice(vi + 1, vi + 3), 10);
      offsetMm = parseInt(value.slice(vi + 3, vi + 5), 10);
      hasOffset = true;
      vi += 5;
      tokenLen = 5;
    } else if (rest.startsWith("-07")) {
      offsetSign = value[vi]!;
      offsetHh = parseInt(value.slice(vi + 1, vi + 3), 10);
      offsetMm = 0;
      hasOffset = true;
      vi += 3;
      tokenLen = 3;
    } else if (rest.startsWith("MST")) {
      // Skip timezone abbreviation in value
      let end = vi;
      while (end < value.length && /[A-Za-z]/.test(value[end]!)) end++;
      vi = end;
      tokenLen = 3;
    }

    if (tokenLen > 0) {
      li += tokenLen;
    } else {
      // Literal character — must match
      if (value[vi] === layout[li]) {
        vi++;
        li++;
      } else {
        throw new Error(`cannot parse ${JSON.stringify(value)} as ${JSON.stringify(layout)}`);
      }
    }
  }

  // Apply 12-hour conversion
  if (is12h) {
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
  }

  // Compute epoch ms
  let ms: number;
  if (hasOffset) {
    const offsetMinutes = (offsetSign === "-" ? -1 : 1) * (offsetHh * 60 + offsetMm);
    // Parse as UTC then subtract offset
    ms = Date.UTC(year, month - 1, day, hour, minute, second, fracMs) - offsetMinutes * 60000;
  } else {
    // No timezone in layout — treat as UTC
    ms = Date.UTC(year, month - 1, day, hour, minute, second, fracMs);
  }

  return ms;
}

function formatDuration(ns: bigint): string {
  if (ns === 0n) return "0s";
  let neg = ns < 0n;
  let v = neg ? -ns : ns;
  let out = "";
  const hours = v / 3600000000000n;
  v %= 3600000000000n;
  const mins = v / 60000000000n;
  v %= 60000000000n;
  const secs = Number(v) / 1e9;
  if (hours > 0n) out += `${hours}h`;
  if (mins > 0n) out += `${mins}m`;
  if (secs > 0 || out === "") out += `${secs}s`;
  return (neg ? "-" : "") + out;
}
