// Remove formatting whitespace only outside strings. Exact numeric and string tokens survive.
const PIECE = /"(?:[^"\\]|\\[\s\S])*"?|[^"]+/g;
export function compactJson(raw: string): string {
  let result = "";
  for (const [piece] of raw.matchAll(PIECE))
    result +=
      piece.charCodeAt(0) === 34
        ? piece
        : piece.replace(/\s+/g, "").replace(/[,:]/g, "$& ");
  return result;
}
