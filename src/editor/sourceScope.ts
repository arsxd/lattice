import type { Path } from "../document/engine";
import { sourceDocumentText, sourceLineSeparator } from "./sourceText";
export type SourceScope = { path: Path; from: number; to: number };
type Range = { from: number; to: number };
const validRange = (r: Range, length: number) =>
  Number.isInteger(r.from) &&
  Number.isInteger(r.to) &&
  r.from >= 0 &&
  r.to >= r.from &&
  r.to <= length;
function validateScope(full: string, scope: SourceScope) {
  if (!validRange(scope, full.length))
    throw new Error("Source scope is outside the canonical document");
}
export function scopedSourceText(
  fullDraft: string,
  canonicalFull: string,
  scope: SourceScope | null,
): string {
  if (!scope) return fullDraft;
  validateScope(canonicalFull, scope);
  const prefix = canonicalFull.slice(0, scope.from),
    suffix = canonicalFull.slice(scope.to);
  if (
    fullDraft.length < prefix.length + suffix.length ||
    !fullDraft.startsWith(prefix) ||
    !fullDraft.endsWith(suffix)
  )
    throw new Error("Source draft changed outside its scope");
  return fullDraft.slice(prefix.length, fullDraft.length - suffix.length);
}
export function applyScopedDraft(
  canonicalFull: string,
  scope: SourceScope | null,
  displayDraft: string,
): string {
  if (!scope) return displayDraft;
  validateScope(canonicalFull, scope);
  return (
    canonicalFull.slice(0, scope.from) +
    displayDraft +
    canonicalFull.slice(scope.to)
  );
}
export function scopedSelectionRange(
  range: Range,
  scope: SourceScope | null,
): Range | null {
  if (!validRange(range, Number.MAX_SAFE_INTEGER)) return null;
  if (!scope) return { from: range.from, to: range.to };
  const from = Math.max(range.from, scope.from),
    to = Math.min(range.to, scope.to);
  return from < to ? { from: from - scope.from, to: to - scope.from } : null;
}
// Worker offsets count raw UTF16 units; CodeMirror counts each line break once.
export function sourceRawRangeToDocument(
  text: string,
  range: Range,
): Range | null {
  if (!validRange(range, text.length)) return null;
  const separator = sourceLineSeparator(text);
  const document = sourceDocumentText(text);
  const lines = text.split(separator);
  const position = (offset: number) => {
    let rawStart = 0;
    for (let index = 0; index < lines.length; index++) {
      const rawEnd = rawStart + lines[index].length;
      if (offset <= rawEnd)
        return document.line(index + 1).from + offset - rawStart;
      if (offset < rawEnd + separator.length)
        return document.line(index + 2).from;
      rawStart = rawEnd + separator.length;
    }
    return document.length;
  };
  return { from: position(range.from), to: position(range.to) };
}
