import type { ReactNode } from "react";
import { searchPattern, type SearchOptions } from "../document/search";
import { tokenizeJsonPreview, type JsonToken } from "./jsonTokens";

const cache = new Map<string, JsonToken[]>();
function tokens(text: string): JsonToken[] {
  let found = cache.get(text);
  if (!found) {
    if (cache.size >= 500) cache.clear();
    found = tokenizeJsonPreview(text);
    cache.set(text, found);
  }
  return found;
}

/** A nested value preview with Source-style colours and Find highlighting. */
export function JsonPreview({
  text,
  search,
  caseSensitive,
  wholeWord,
}: { text: string; search: string } & SearchOptions) {
  const ranges: [number, number][] = [];
  if (search)
    for (const match of text.matchAll(
      searchPattern(search, { caseSensitive, wholeWord }),
    )) {
      ranges.push([match.index, match.index + match[0].length]);
      if (ranges.length >= 400) break;
    }
  const out: ReactNode[] = [];
  let r = 0;
  for (const token of tokens(text)) {
    let pos = token.start;
    while (pos < token.end) {
      while (r < ranges.length && ranges[r][1] <= pos) r++;
      const range = ranges[r];
      const hit = !!range && range[0] <= pos;
      const end = hit
        ? Math.min(token.end, range[1])
        : range && range[0] < token.end
          ? range[0]
          : token.end;
      const piece = text.slice(pos, end);
      const content: ReactNode = hit ? (
        <mark className="find-match">{piece}</mark>
      ) : (
        piece
      );
      out.push(
        token.kind === "plain" ? (
          <span key={pos}>{content}</span>
        ) : (
          <span key={pos} className={`json-${token.kind}`}>
            {content}
          </span>
        ),
      );
      pos = end;
    }
  }
  return <>{out}</>;
}
