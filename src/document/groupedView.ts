import { compareNumbers } from "./engine";
import type { GroupCell, GroupedProjection } from "./groupedProjection";
export type GroupSort = {
  scope: "parent" | "child";
  column: number;
  descending: boolean;
};
const compare = (a: GroupCell, b: GroupCell) =>
  a.type === "number" && b.type === "number"
    ? compareNumbers(a.text, b.text)
    : a.text.localeCompare(b.text);
export function groupedView(
  projection: GroupedProjection,
  search = "",
  sort?: GroupSort,
): GroupedProjection {
  const term = search.toLocaleLowerCase();
  const matches = (cells: GroupCell[]) =>
    cells.some((cell) => cell.text.toLocaleLowerCase().includes(term));
  const groups = projection.groups.flatMap((group) => {
    const children =
      !term || matches(group.parent)
        ? [...group.children]
        : group.children.filter(matches);
    return !term || matches(group.parent) || children.length
      ? [{ ...group, children }]
      : [];
  });
  if (sort) {
    const order = (a: GroupCell[], b: GroupCell[]) =>
      (sort.descending ? -1 : 1) * compare(a[sort.column], b[sort.column]);
    if (sort.scope === "parent")
      groups.sort((a, b) => order(a.parent, b.parent));
    else for (const group of groups) group.children.sort(order);
  }
  return { ...projection, groups };
}
