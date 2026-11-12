import {
  PAGE_SIZE,
  type ColumnKind,
  type Path,
  type Projection,
  type Query,
} from "../document/engine";
import { selectCell, type SheetSelection } from "../document/sheetSelection";

type ColumnIdentity = { kind: ColumnKind; header: string };
export type ReloadPosition = {
  rowPath: Path;
  column?: ColumnIdentity;
  selected: boolean;
  cellPath?: Path;
  cellWasMissing?: boolean;
};
function columnIdentity(
  view: Projection,
  column: number,
): ColumnIdentity | undefined {
  const kind = view.columnKinds[column];
  return kind === undefined
    ? undefined
    : { kind, header: view.headers[column] };
}
function columnIndex(view: Projection, identity: ColumnIdentity): number {
  return view.columnKinds.findIndex(
    (kind, index) =>
      kind === identity.kind && view.headers[index] === identity.header,
  );
}
/** Paths retain object keys; array indices deliberately retain positions, not record identity. */
export function captureReloadPosition(
  view: Projection,
  selection: SheetSelection | null,
  fallbackRow = view.page * PAGE_SIZE,
): ReloadPosition | null {
  const point = selection?.anchor;
  const row = view.rows[(point?.r ?? fallbackRow) - view.page * PAGE_SIZE];
  if (!row) return null;
  return {
    rowPath: [...row.path],
    column: point ? columnIdentity(view, point.c) : undefined,
    selected: !!point,
    cellPath: point ? row.cells[point.c]?.path : undefined,
    cellWasMissing: point ? row.cells[point.c]?.type === "missing" : undefined,
  };
}
/** Column indices can change when an external edit reorders or removes fields. */
export function remapReloadQuery(
  query: Query,
  before: Projection,
  after: Projection,
): Query {
  const remap = (index: number) => {
    const identity = columnIdentity(before, index);
    return identity ? columnIndex(after, identity) : -1;
  };
  const columns = <T>(
    values: Record<string, T> | undefined,
  ): Record<string, T> | undefined => {
    if (!values) return undefined;
    return Object.fromEntries(
      Object.entries(values).flatMap(([index, value]) => {
        const column = remap(Number(index));
        return column < 0 ? [] : [[String(column), value]];
      }),
    );
  };
  const sortColumn = query.sort ? remap(query.sort.column) : -1;
  const optionsColumn =
    query.optionsColumn === undefined ? -1 : remap(query.optionsColumn);
  return {
    ...query,
    filters: columns(query.filters),
    valueFilters: columns(query.valueFilters),
    sort:
      query.sort && sortColumn >= 0
        ? { ...query.sort, column: sortColumn }
        : undefined,
    optionsColumn: optionsColumn >= 0 ? optionsColumn : undefined,
  };
}
export function restoreReloadSelection(
  position: ReloadPosition | null,
  view: Projection,
  row: number | undefined,
): SheetSelection | null {
  if (
    !position?.selected ||
    !position.column ||
    row === undefined ||
    row < 0 ||
    row >= view.matched
  )
    return null;
  const column = columnIndex(view, position.column);
  const restoredRow = view.rows[row - view.page * PAGE_SIZE];
  const cell = restoredRow?.cells[column];
  if (
    column < 0 ||
    !restoredRow ||
    !cell ||
    restoredRow.path.length !== position.rowPath.length ||
    restoredRow.path.some((part, i) => part !== position.rowPath[i]) ||
    (position.cellPath &&
      (cell.path.length !== position.cellPath.length ||
        cell.path.some((part, i) => part !== position.cellPath![i]))) ||
    (!position.cellWasMissing && cell.type === "missing")
  )
    return null;
  return selectCell(null, { r: row, c: column });
}
