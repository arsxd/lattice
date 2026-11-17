import type { Node } from "jsonc-parser";
import type { Path } from "./engine";
export type GroupCell = { path: Path; text: string; type: string };
export type Group = {
  path: Path;
  parent: GroupCell[];
  children: GroupCell[][];
};
export type GroupedProjection = {
  parentHeaders: string[];
  childHeaders: string[];
  groups: Group[];
};
const entries = (node: Node): [string | number, Node][] =>
  node.type === "array"
    ? (node.children ?? []).map((value, index) => [index, value])
    : (node.children ?? []).map((property) => [
        String(property.children![0].value),
        property.children![1],
      ]);
const property = (node: Node, key: string) =>
  entries(node).find(([name]) => name === key)?.[1];
export function groupedProjection(
  text: string,
  node: Node,
  path: Path,
  childKey: string,
): GroupedProjection {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new Error("This preview supports files up to 2 MiB.");
  if (node.type !== "array" && node.type !== "object")
    throw new Error("Choose an array or object map of records.");
  const parents = entries(node);
  if (!parents.length || parents.some(([, value]) => value.type !== "object"))
    throw new Error("Choose a collection whose entries are records.");
  if (parents.length > 100)
    throw new Error("This preview supports up to 100 parent records.");
  const parentFields: string[] = [];
  const childHeaders: string[] = [];
  let childCount = 0,
    foundArray = false;
  for (const [, parent] of parents) {
    for (const [key] of entries(parent))
      if (key !== childKey && !parentFields.includes(String(key)))
        parentFields.push(String(key));
    if (parentFields.length > 20)
      throw new Error("This preview supports up to 20 columns.");
    const children = property(parent, childKey);
    if (children && children.type !== "array")
      throw new Error(
        `“${childKey}” must be an array in every parent where it exists.`,
      );
    childCount += Math.max(1, children?.children?.length ?? 0);
    if (childCount > 500)
      throw new Error("This preview supports up to 500 child rows.");
    if (!children) continue;
    foundArray = true;
    for (const [, child] of entries(children)) {
      if (child.type !== "object")
        throw new Error("This preview supports arrays of child records.");
      for (const [key] of entries(child))
        if (!childHeaders.includes(String(key))) childHeaders.push(String(key));
      if (
        parentFields.length +
          (node.type === "object" ? 1 : 0) +
          childHeaders.length >
        20
      )
        throw new Error("This preview supports up to 20 columns.");
    }
  }
  const parentHeaders =
    node.type === "object" ? ["Key", ...parentFields] : parentFields;
  if (!foundArray)
    throw new Error(`No child array named “${childKey}” was found here.`);
  if (!childHeaders.length) childHeaders.push("(empty child records)");
  if (
    parentHeaders.length + childHeaders.length > 20 ||
    Math.max(childCount, parents.length) *
      (parentHeaders.length + childHeaders.length) >
      10000
  )
    throw new Error("This preview exceeds its 20-column or 10,000-cell limit.");
  const cell = (value: Node | undefined, at: Path): GroupCell => {
    if (!value) return { path: at, text: "", type: "missing" };
    const raw = text.slice(value.offset, value.offset + value.length);
    return {
      path: at,
      type: value.type,
      text:
        value.type === "string"
          ? String(value.value)
          : value.type === "object"
            ? `{${value.children?.length ?? 0} fields}`
            : value.type === "array"
              ? `[${value.children?.length ?? 0} items]`
              : raw,
    };
  };
  return {
    parentHeaders,
    childHeaders,
    groups: parents.map(([key, parent]) => {
      const at = [...path, key];
      const values = parentHeaders.map((header, column) =>
        node.type === "object" && column === 0
          ? { path: at, text: String(key), type: "key" }
          : cell(property(parent, header), [...at, header]),
      );
      const children = property(parent, childKey);
      return {
        path: at,
        parent: values,
        children: children
          ? entries(children).map(([index, child]) =>
              childHeaders.map((header) =>
                cell(property(child, header), [...at, childKey, index, header]),
              ),
            )
          : [],
      };
    }),
  };
}
