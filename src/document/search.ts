export type SearchOptions = { caseSensitive?: boolean; wholeWord?: boolean };
export function searchPattern(search: string, options: SearchOptions = {}): RegExp {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = options.wholeWord
    ? `(?<![\\p{L}\\p{N}_])(?:${escaped})(?![\\p{L}\\p{N}_])` : escaped;
  return new RegExp(pattern, options.caseSensitive ? "gu" : "giu");
}
export function textMatcher(search: string, options: SearchOptions = {}) {
  const pattern = searchPattern(search, options);
  return (text: string) => { pattern.lastIndex = 0; return !!search && pattern.test(text); };
}
