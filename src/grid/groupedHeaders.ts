export type GroupedHeader = {
  label: string;
  column: number;
  colSpan: number;
  rowSpan: number;
  leaf: boolean;
};
/** A real JSON key containing '/' remains one label, never a parsed path. */
export function groupedHeaderRows(paths: string[][]): GroupedHeader[][] {
  const shown = paths.map((path) =>
    path.length > 4 ? [...path.slice(0, 3), path.slice(3).join(" / ")] : path,
  );
  const height = Math.max(1, ...shown.map((path) => path.length));
  const rows: GroupedHeader[][] = Array.from({ length: height }, () => []);
  const add = (from: number, to: number, depth: number) => {
    let column = from;
    while (column < to) {
      const path = shown[column];
      if (path.length <= depth + 1) {
        rows[depth].push({
          label: path[depth] ?? "Value",
          column,
          colSpan: 1,
          rowSpan: height - depth,
          leaf: true,
        });
        column++;
        continue;
      }
      let end = column + 1;
      while (
        end < to &&
        shown[end].length > depth + 1 &&
        shown[end].slice(0, depth + 1).every((part, i) => part === path[i])
      )
        end++;
      rows[depth].push({
        label: path[depth],
        column,
        colSpan: end - column,
        rowSpan: 1,
        leaf: false,
      });
      add(column, end, depth + 1);
      column = end;
    }
  };
  add(0, shown.length, 0);
  return rows;
}
