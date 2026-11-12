import type { Cell } from "../document/engine";
export function blankState(cell: Cell): string | null {
  if (cell.type === "missing") return "Property not set";
  if (cell.type === "null") return "No value (null)";
  if (!cell.empty) return null;
  if (cell.type === "string") return "Empty text";
  if (cell.type === "object") return "Empty object";
  if (cell.type === "array") return "Empty array";
  return null;
}
export function wrappedHeight(
  cells: { text: string; width: number }[],
  measure: (text: string) => number,
): number {
  let maxLines = 1;
  for (const cell of cells) {
    if (!cell.text) continue;
    const width = Math.max(20, cell.width - 16);
    let lines = 0;
    for (const paragraph of cell.text
      .replace(/\t/g, "    ")
      .split(/\r\n|\r|\n/)) {
      lines++;
      if (measure(paragraph) > width) {
        let used = 0;
        for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
          const size = measure(token);
          if (/^\s+$/u.test(token)) {
            used = Math.min(width, used + size);
          } else if (size <= width) {
            if (used && used + size > width) {
              lines++;
              used = 0;
            }
            used += size;
          } else {
            if (used) {
              lines++;
              used = 0;
            }
            for (const char of token) {
              const charWidth = measure(char);
              if (used && used + charWidth > width) {
                lines++;
                used = 0;
              }
              used += charWidth;
              if (lines >= 3) break;
            }
          }
          if (lines >= 3) break;
        }
      }
      if (lines >= 3) break;
    }
    maxLines = Math.max(maxLines, Math.min(3, lines));
  }
  return 28 + (maxLines - 1) * 20;
}

export const VALUE_BAR_PREVIEW_LIMIT = 4096;
export const JSON_PREVIEW_LIMIT = 8192;
export function valueBarPresentation(
  cell: Cell,
  raw: string,
): { text: string; previewOnly: boolean } {
  if (blankState(cell)) return { text: "", previewOnly: false };
  if (cell.container) return { text: cell.display, previewOnly: true };
  const text = cell.type === "string" ? (JSON.parse(raw) as string) : raw;
  return text.length > VALUE_BAR_PREVIEW_LIMIT
    ? { text: text.slice(0, VALUE_BAR_PREVIEW_LIMIT) + "…", previewOnly: true }
    : { text, previewOnly: false };
}
export function jsonSelectionPreview(raw: string): {
  text: string;
  truncated: boolean;
} {
  return {
    text: raw.slice(0, JSON_PREVIEW_LIMIT),
    truncated: raw.length > JSON_PREVIEW_LIMIT,
  };
}
