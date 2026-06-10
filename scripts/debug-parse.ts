// Debug: manually trace parseGoLayout for "2006.01.02"
const value = "2006.01.02";
const layout = "2006.01.02";

let year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0, fracMs = 0;
let vi = 0, li = 0;

while (li < layout.length && vi <= value.length) {
  const rest = layout.slice(li);
  let tokenLen = 0;

  if (rest.startsWith("2006")) {
    year = parseInt(value.slice(vi, vi + 4), 10);
    vi += 4; tokenLen = 4;
  } else if (rest.startsWith("01")) {
    month = parseInt(value.slice(vi, vi + 2), 10);
    vi += 2; tokenLen = 2;
  } else if (rest[0] === "1" && !rest.startsWith("15")) {
    let end = vi;
    while (end < value.length && /\d/.test(value[end]!)) end++;
    const digits = Math.min(end - vi, 2);
    month = parseInt(value.slice(vi, vi + digits), 10);
    vi += digits; tokenLen = 1;
  } else if (rest.startsWith("02")) {
    day = parseInt(value.slice(vi, vi + 2), 10);
    vi += 2; tokenLen = 2;
  } else if (rest[0] === "2" && !rest.startsWith("20")) {
    let end = vi;
    while (end < value.length && /\d/.test(value[end]!)) end++;
    const digits = Math.min(end - vi, 2);
    day = parseInt(value.slice(vi, vi + digits), 10);
    vi += digits; tokenLen = 1;
  }

  if (tokenLen > 0) {
    console.log(`li=${li} token='${layout.slice(li, li+tokenLen)}' → year=${year} month=${month} day=${day}, vi=${vi}`);
    li += tokenLen;
  } else {
    console.log(`li=${li} literal: layout[${li}]='${layout[li]}' value[${vi}]='${value[vi]}' match=${value[vi] === layout[li]}`);
    if (value[vi] === layout[li]) { vi++; li++; }
    else { console.log("MISMATCH!"); break; }
  }
}

console.log(`Final: year=${year} month=${month} day=${day}`);
console.log(`Date.UTC(${year}, ${month-1}, ${day}) =`, Date.UTC(year, month - 1, day));
