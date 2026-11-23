import { searchPattern, type SearchOptions } from "../document/search";
import type { ReactNode } from "react";

/** Treat Find as literal text; never interpret it as a regular expression. */
export function FindHighlight({ text, search, caseSensitive, wholeWord }: { text: string; search: string } & SearchOptions) {
  if (!search) return <>{text}</>;
  const pattern = searchPattern(search, { caseSensitive, wholeWord });
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    parts.push(text.slice(end, start));
    parts.push(<mark className="find-match" key={start}>{match[0]}</mark>);
    end = start + match[0].length;
    // Bound markup for repetitive values while leaving the rest of the text intact.
    if (parts.length >= 400) break;
  }
  parts.push(text.slice(end));
  return <>{parts}</>;
}
