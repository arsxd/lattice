export type JsonTokenKind = "string" | "number" | "literal" | "plain";
export type JsonToken = { start: number; end: number; kind: JsonTokenKind };

// Strings (possibly cut off by the preview limit), numbers, words and punctuation.
const PIECE =
  /"(?:[^"\\]|\\.)*(?:"|$)|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\],:]|\s+|[^\s"{}[\],:]+/gy;

/** Only this many leading characters are coloured; the rest stays plain text. */
export const COLOUR_LIMIT = 2000;

/**
 * Split a bounded JSON preview into coloured value tokens and plain text.
 * Keys, punctuation and spacing are plain so cells stay quiet, as in Source.
 * Tokens cover the whole text without gaps or overlaps.
 */
export function tokenizeJsonPreview(text: string): JsonToken[] {
  const head = text.slice(0, COLOUR_LIMIT);
  const raw: { start: number; end: number; piece: string }[] = [];
  PIECE.lastIndex = 0;
  let at = 0;
  for (;;) {
    PIECE.lastIndex = at;
    const m = PIECE.exec(head);
    if (!m || !m[0]) break;
    raw.push({ start: at, end: at + m[0].length, piece: m[0] });
    at += m[0].length;
  }
  const tokens: JsonToken[] = [];
  const push = (start: number, end: number, kind: JsonTokenKind) => {
    const last = tokens.at(-1);
    if (last && last.kind === "plain" && kind === "plain") last.end = end;
    else tokens.push({ start, end, kind });
  };
  for (let i = 0; i < raw.length; i++) {
    const { start, end, piece } = raw[i];
    let kind: JsonTokenKind = "plain";
    if (piece.startsWith('"')) {
      let next = i + 1;
      while (next < raw.length && /^\s+$/.test(raw[next].piece)) next++;
      kind = raw[next]?.piece === ":" ? "plain" : "string";
    } else if (/^-?\d/.test(piece)) kind = "number";
    else if (piece === "true" || piece === "false" || piece === "null")
      kind = "literal";
    push(start, end, kind);
  }
  if (at < text.length) push(at, text.length, "plain");
  return tokens;
}
