export type SheetPoint = { r: number; c: number };
export type Span = [number, number];
export type SheetSelection = {
  mode: "cells" | "rows" | "columns";
  anchor: SheetPoint;
  end: SheetPoint;
  spans: Span[];
};
function merge(spans: Span[]): Span[] {
  const result: Span[] = [];
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1);
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}
export function selectCell(
  previous: SheetSelection | null,
  point: SheetPoint,
  extend = false,
): SheetSelection {
  return {
    mode: "cells",
    anchor: extend && previous?.mode === "cells" ? previous.anchor : point,
    end: point,
    spans: [],
  };
}
export function selectHeader(
  previous: SheetSelection | null,
  mode: "rows" | "columns",
  point: SheetPoint,
  options: { extend?: boolean; additive?: boolean } = {},
): SheetSelection | null {
  const index = mode === "rows" ? point.r : point.c;
  const same = previous?.mode === mode;
  const anchor = options.extend && same ? previous.anchor : point;
  const from = mode === "rows" ? anchor.r : anchor.c;
  let spans: Span[] = [[Math.min(from, index), Math.max(from, index)]];
  if (options.additive && same) {
    if (options.extend) spans = merge([...previous.spans, ...spans]);
    else if (previous.spans.some(([a, b]) => index >= a && index <= b))
      spans = previous.spans.flatMap(([a, b]): Span[] =>
        index < a || index > b
          ? [[a, b]]
          : [
              ...(a < index ? [[a, index - 1] as Span] : []),
              ...(index < b ? [[index + 1, b] as Span] : []),
            ],
      );
    else spans = merge([...previous.spans, [index, index]]);
  }
  return spans.length ? { mode, anchor, end: point, spans } : null;
}
export function selectionOrigin(selection: SheetSelection): SheetPoint {
  if (selection.mode === "cells")
    return {
      r: Math.min(selection.anchor.r, selection.end.r),
      c: Math.min(selection.anchor.c, selection.end.c),
    };
  return {
    r: selection.mode === "rows" ? selection.spans[0][0] : 0,
    c: selection.mode === "columns" ? selection.spans[0][0] : 0,
  };
}
export function axisSelected(
  selection: SheetSelection | null,
  mode: "rows" | "columns",
  index: number,
): boolean {
  return (
    selection?.mode === mode &&
    selection.spans.some(([a, b]) => index >= a && index <= b)
  );
}
export function selectionContains(
  selection: SheetSelection | null,
  point: SheetPoint,
  rows: number,
  columns: number,
): boolean {
  if (
    !selection ||
    point.r < 0 ||
    point.r >= rows ||
    point.c < 0 ||
    point.c >= columns
  )
    return false;
  if (selection.mode === "rows")
    return axisSelected(selection, "rows", point.r);
  if (selection.mode === "columns")
    return axisSelected(selection, "columns", point.c);
  return (
    point.r >= Math.min(selection.anchor.r, selection.end.r) &&
    point.r <= Math.max(selection.anchor.r, selection.end.r) &&
    point.c >= Math.min(selection.anchor.c, selection.end.c) &&
    point.c <= Math.max(selection.anchor.c, selection.end.c)
  );
}
export function selectedCellCount(
  selection: SheetSelection | null,
  rows: number,
  columns: number,
): number {
  if (!selection || !rows || !columns) return 0;
  const count = (spans: Span[], limit: number) =>
    spans.reduce(
      (sum, [a, b]) =>
        sum + Math.max(0, Math.min(b, limit - 1) - Math.max(a, 0) + 1),
      0,
    );
  if (selection.mode === "rows") return count(selection.spans, rows) * columns;
  if (selection.mode === "columns")
    return count(selection.spans, columns) * rows;
  return (
    count(
      [
        [
          Math.min(selection.anchor.r, selection.end.r),
          Math.max(selection.anchor.r, selection.end.r),
        ],
      ],
      rows,
    ) *
    count(
      [
        [
          Math.min(selection.anchor.c, selection.end.c),
          Math.max(selection.anchor.c, selection.end.c),
        ],
      ],
      columns,
    )
  );
}
