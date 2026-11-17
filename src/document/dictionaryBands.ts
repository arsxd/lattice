import type {
  ExpandedCell,
  ExpandedSection,
  ExpandedSort,
} from "./editableGroups";
import type { Path } from "./engine";
/** Stack independent lists: no display row can imply a cross-dictionary pairing. */
export function alignBands(
  bands: ExpandedCell[][][],
  path: Path,
): ExpandedCell[][] {
  const count = Math.max(
    1,
    bands.reduce((sum, band) => sum + band.length, 0),
  );
  const starts = bands.map((_, i) =>
    bands.slice(0, i).reduce((sum, band) => sum + band.length, 0),
  );
  return Array.from({ length: count }, (_, r) =>
    bands.flatMap((band, i) => {
      const start = starts[i],
        end = start + band.length;
      if (r >= start && r < end) return band[r - start];
      const origin = !band.length || r < start ? 0 : end;
      const span = !band.length ? count : r < start ? start : count - end;
      return Array.from({ length: 2 }, (): ExpandedCell => ({
        cell: {
          path,
          type: "missing",
          display: "",
          container: false,
          writable: false,
        },
        value: "",
        layoutGap: true,
        rowSpan: span,
        rowOffset: origin - r,
      }));
    }),
  );
}
export function dictionaryRows(
  section: ExpandedSection,
  search: string,
  sort: ExpandedSort | undefined,
  filters: Record<string, string[]>,
  compare: (a: string, b: string) => number,
) {
  const p = section.parentHeaders.length,
    descriptors = section.dictionaryBands!;
  const accepts = (cells: ExpandedCell[], offset: number) =>
    cells.every(
      (c, i) =>
        !filters[String(offset + i)] ||
        filters[String(offset + i)].includes(c.cell.type + ":" + c.value),
    );
  const matches = (cells: ExpandedCell[]) =>
    cells.some((c) =>
      c.value.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    );
  const scopeSort = (key: string, owns: (column: number) => boolean) =>
    sort?.scopes
      ? sort.scopes[key]
      : sort && owns(sort.column)
        ? sort
        : undefined;
  const cmp = (a: ExpandedCell, b: ExpandedCell, direction: string) =>
    (direction === "DESC" ? -1 : 1) *
    (a.cell.type === "number" && b.cell.type === "number"
      ? compare(a.value, b.value)
      : a.value.localeCompare(b.value));
  const groups = section.groups.flatMap((group) => {
    if (!accepts(group.parent, 0)) return [];
    const bands = group.bands!.map((band, i) => {
      const offset = p + descriptors[i].start;
      const result = band.filter((pair) => accepts(pair, offset));
      const order = scopeSort(
        `dictionary:${descriptors[i].key}`,
        (c) => c >= offset && c < offset + 2,
      );
      if (order)
        result.sort((a, b) =>
          cmp(
            a[order.column - offset],
            b[order.column - offset],
            order.direction,
          ),
        );
      return result;
    });
    if (
      bands.some(
        (band, i) =>
          !band.length &&
          [0, 1].some((c) => filters[String(p + descriptors[i].start + c)]),
      )
    )
      return [];
    if (search && !matches(group.parent) && !bands.some((b) => b.some(matches)))
      return [];
    return [{ ...group, bands }];
  });
  const order = scopeSort("parent", (c) => c < p);
  if (order)
    groups.sort((a, b) =>
      cmp(a.parent[order.column], b.parent[order.column], order.direction),
    );
  let start = 0;
  return groups.flatMap((group) => {
    const children = alignBands(group.bands, group.path),
      first = start;
    start += children.length;
    return children.map((row, index) => ({
      cells: [...group.parent, ...row],
      groupPath: group.path,
      first,
      end: start,
      index,
      count: children.length,
    }));
  });
}
