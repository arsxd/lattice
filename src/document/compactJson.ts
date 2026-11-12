// Remove formatting whitespace only outside strings. Exact numeric and string tokens survive.
export function compactJson(raw: string): string {
  let result = "",
    quoted = false,
    escaped = false;
  for (const char of raw) {
    if (quoted) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true;
      result += char;
    } else if (!/\s/u.test(char))
      result += char === "," ? ", " : char === ":" ? ": " : char;
  }
  return result;
}
