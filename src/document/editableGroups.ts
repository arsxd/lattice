import { expandMappings } from "./expandMappings";
import type { Node } from "jsonc-parser";
import type { Cell, Path, AtomicMutation } from "./engine";
export type ExpandedCell = { cell: Cell; value: string; identifier?: string };
export type ExpandedGroup = {
  path: Path;
  arrayPresent: boolean;
  parent: ExpandedCell[];
  children: ExpandedCell[][];
};
export type ExpandedSection = {
  mapping?: boolean;
  recordPaths?: Path[];
  key: string;
  parentHeaders: string[];
  childHeaders: string[];
  columnPaths?: string[][];
  groups: ExpandedGroup[];
};
export type ExpandedDocument = {
  revision: number;
  sections: ExpandedSection[];
};
const entries = (node: Node): [string | number, Node][] =>
  node.type === "array"
    ? (node.children ?? []).map((n, i) => [i, n])
    : (node.children ?? []).map((n) => [
        String(n.children![0].value),
        n.children![1],
      ]);
const field = (node: Node, key: string) =>
  node.children?.find((n) => n.children?.[0].value === key)?.children?.[1];
export function expandRecords(
  text: string,
  node: Node,
  path: Path,
  revision: number,
  cell: (node: Node, path: Path) => Cell,
): ExpandedDocument {
  const encoder = new TextEncoder();
  if (
    encoder.encode(text.slice(node.offset, node.offset + node.length)).length >
    2 * 1024 * 1024
  )
    throw new Error(
      "This selected table is too large to expand at once. Open a smaller nested table; expansion supports 2 MiB per table.",
    );
  if (node.type === "object") {
    const immediate = entries(node);
    const hasRecordArrays = immediate.some(
      ([, n]) =>
        n.type === "object" &&
        entries(n).some(
          ([, v]) =>
            v.type === "array" &&
            (v.children?.length ?? 0) > 0 &&
            (v.children ?? []).every((c) => c.type === "object"),
        ),
    );
    if (!hasRecordArrays)
      return expandMappings(text, node, path, revision, cell);
  }
  const parents = entries(node);
  if (!parents.length || parents.some(([, n]) => n.type !== "object"))
    throw new Error("Expand a collection of records containing child tables.");
  if (parents.length > 100)
    throw new Error("Expanded rows support up to 100 parent records.");
  const arrays = new Set<string>();
  for (const [, parent] of parents)
    for (const [key, n] of entries(parent))
      if (
        n.type === "array" &&
        (n.children?.length ?? 0) > 0 &&
        (n.children ?? []).every((c) => c.type === "object")
      )
        arrays.add(String(key));
  if (!arrays.size) return expandMappings(text, node, path, revision, cell);
  if (arrays.size > 8)
    throw new Error("Expand up to 8 child tables in one sheet.");
  let rendered = 0,
    outputChars = 0;
  const item = (n: Node | undefined, at: Path): ExpandedCell => {
    if (!n)
      return {
        cell: { path: at, type: "missing", display: "", container: false },
        value: "",
      };
    const raw = text.slice(n.offset, n.offset + n.length);
    const value =
      n.type === "string"
        ? String(n.value)
        : n.type === "object" || n.type === "array"
          ? cell(n, at).display
          : raw;
    outputChars += encoder.encode(value).length;
    if (outputChars > 2 * 1024 * 1024)
      throw new Error(
        "Expanded cell contents exceed the preview limit. Use the compact sheet.",
      );
    return { cell: cell(n, at), value };
  };
  const sections = [...arrays].map((key) => {
    const parentHeaders: string[] = [],
      childHeaders: string[] = [];
    for (const [, parent] of parents) {
      for (const [name] of entries(parent))
        if (!arrays.has(String(name)) && !parentHeaders.includes(String(name)))
          parentHeaders.push(String(name));
      const children = field(parent, key);
      if (children && children.type !== "array")
        throw new Error(`“${key}” is not an array in every parent.`);
      for (const child of children?.children ?? []) {
        if (child.type !== "object")
          throw new Error(
            `“${key}” contains mixed values. Use the compact sheet.`,
          );
        for (const [name] of entries(child))
          if (!childHeaders.includes(String(name)))
            childHeaders.push(String(name));
      }
    }
    if (!childHeaders.length) childHeaders.push("Value");
    const mapped = node.type === "object";
    if (parentHeaders.length + childHeaders.length + (mapped ? 1 : 0) > 20)
      throw new Error("Expanded rows support up to 20 columns per table.");
    const groups = parents.map(([index, parent]) => {
      const at = [...path, index];
      const children = field(parent, key)?.children ?? [];
      if (children.length > 500)
        throw new Error(
          "Expanded rows support up to 500 rows per child table.",
        );
      rendered +=
        Math.max(1, children.length) *
        (parentHeaders.length + childHeaders.length + (mapped ? 1 : 0));
      if (rendered > 10000)
        throw new Error("Expanded rows support up to 10,000 rendered cells.");
      const p = parentHeaders.map((name) =>
        item(field(parent, name), [...at, name]),
      );
      if (mapped)
        p.unshift({
          cell: {
            path: at,
            type: "string",
            display: String(index),
            container: false,
            writable: false,
          },
          value: String(index),
          identifier: String(index),
        });
      return {
        path: at,
        arrayPresent: !!field(parent, key),
        parent: p,
        children: children.map((child, i) =>
          childHeaders.map((name) =>
            item(field(child, name), [...at, key, i, name]),
          ),
        ),
      };
    });
    if (
      groups.reduce((sum, g) => sum + Math.max(1, g.children.length), 0) > 500
    )
      throw new Error("Expanded rows support up to 500 rows per child table.");
    for (
      let c = 0;
      c < parentHeaders.length + (mapped ? 1 : 0) + childHeaders.length;
      c++
    ) {
      const cells = groups.flatMap((group) =>
        c < parentHeaders.length + (mapped ? 1 : 0)
          ? [group.parent[c]]
          : group.children.map(
              (row) => row[c - parentHeaders.length - (mapped ? 1 : 0)],
            ),
      );
      const types = new Set(
        cells
          .filter(
            (item) => item.cell.type !== "null" && item.cell.type !== "missing",
          )
          .map((item) => item.cell.type),
      );
      if (types.size === 1) {
        const kind = [...types][0];
        for (const item of cells)
          if (item.cell.type === "null" || item.cell.type === "missing")
            item.cell.inputKind =
              kind === "number" || kind === "boolean" ? kind : "string";
      }
    }
    return {
      key,
      parentHeaders: mapped ? ["Key", ...parentHeaders] : parentHeaders,
      childHeaders,
      groups,
    };
  });
  return { revision, sections };
}
export function uniqueGroupEdits(
  edits: { cell: Cell; raw: string }[],
): AtomicMutation[] {
  const unique = new Map<string, { cell: Cell; raw: string }>();
  for (const edit of edits) {
    if (edit.cell.writable === false || edit.cell.container)
      throw new Error("Paste into editable values.");
    const key = JSON.stringify(edit.cell.path);
    const previous = unique.get(key);
    if (previous && previous.raw !== edit.raw)
      throw new Error(
        "A merged parent cell received different values. Paste one value for that shared cell.",
      );
    unique.set(key, edit);
  }
  return [...unique.values()].map(({ cell, raw }) =>
    cell.type === "missing"
      ? {
          action: "insert",
          path: cell.path.slice(0, -1),
          key: String(cell.path.at(-1)),
          raw,
        }
      : { action: "replace", path: cell.path, raw },
  );
}
export type ExpandedSort = { column: number; direction: "ASC" | "DESC" };
export function expandedRows(
  section: ExpandedSection,
  search: string,
  sort: ExpandedSort | undefined,
  filters: Record<string, string[]>,
  compare: (a: string, b: string) => number,
) {
  const p = section.parentHeaders.length,
    term = search.toLocaleLowerCase();
  const accepts = (cells: ExpandedCell[], offset: number) =>
    cells.every(
      (cell, i) =>
        !filters[String(i + offset)] ||
        filters[String(i + offset)].includes(cell.cell.type + ":" + cell.value),
    );
  const matches = (cells: ExpandedCell[]) =>
    cells.some((c) => c.value.toLocaleLowerCase().includes(term));
  const groups = section.groups.flatMap((group) => {
    if (!accepts(group.parent, 0)) return [];
    const children = group.children.filter(
      (row) =>
        accepts(row, p) && (!term || matches(group.parent) || matches(row)),
    );
    if (group.children.length && !children.length) return [];
    if (
      !group.children.length &&
      (Object.keys(filters).some((k) => Number(k) >= p) ||
        (term && !matches(group.parent)))
    )
      return [];
    return [{ ...group, children: [...children] }];
  });
  if (sort) {
    const cmp = (a: ExpandedCell, b: ExpandedCell) =>
      (sort.direction === "DESC" ? -1 : 1) *
      (a.cell.type === "number" && b.cell.type === "number"
        ? compare(a.value, b.value)
        : a.value.localeCompare(b.value));
    if (sort.column < p)
      groups.sort((a, b) => cmp(a.parent[sort.column], b.parent[sort.column]));
    else
      for (const group of groups)
        group.children.sort((a, b) =>
          cmp(a[sort.column - p], b[sort.column - p]),
        );
  }
  let start = 0;
  return groups.flatMap((group) => {
    const children = group.children.length
      ? group.children
      : [
          section.childHeaders.map((_, i): ExpandedCell => ({
            cell: {
              path: [...group.path, section.key, 0, section.childHeaders[i]],
              type: "missing" as const,
              display: "",
              container: false,
              writable: false,
            },
            value: "",
          })),
        ];
    const first = start;
    start += children.length;
    return children.map((row, index) => ({
      cells: [...group.parent, ...row],
      groupPath: group.path,
      first: section.parentHeaders.length ? first : first + index,
      end: section.parentHeaders.length ? start : first + index + 1,
      index: section.parentHeaders.length ? index : 0,
      count: section.parentHeaders.length ? children.length : 1,
    }));
  });
}
/** Tab follows rendered cells, skipping parent cells covered by a vertical merge. */
export function nextExpandedCell(
  rows: { index: number }[],
  columns: number,
  parents: number,
  row: number,
  column: number,
  direction: 1 | -1,
) {
  for (
    let index = row * columns + column + direction;
    index >= 0 && index < rows.length * columns;
    index += direction
  ) {
    const r = Math.floor(index / columns),
      c = index % columns;
    if (c < parents && rows[r].index > 0) continue;
    return { r, c };
  }
  return { r: row, c: column };
}
