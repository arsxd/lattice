import type { Cell, ColumnKind, Projection } from "../document/engine";
export function fieldColumnKey(
  view: Pick<Projection, "columnKinds" | "headers">,
  index: number,
): string {
  if (view.columnKinds[index] !== "field")
    throw new Error("This view column is not a JSON property.");
  return view.headers[index];
}
export function columnLabel(
  view: Pick<Projection, "columnKinds" | "headers">,
  index: number,
): string {
  return view.columnKinds[index] === "mixed"
    ? "Array value"
    : view.headers[index];
}

export function nestedTablePath(
  cell: Cell | undefined,
  kind: ColumnKind | undefined,
) {
  return kind &&
    kind !== "index" &&
    (cell?.type === "array" || cell?.type === "object")
    ? cell.path
    : undefined;
}
