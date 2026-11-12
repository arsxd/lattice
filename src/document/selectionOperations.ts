import type {
  DocumentEngine,
  AtomicMutation,
  Kind,
  SelectedCell,
  Query,
} from "./engine";
import {
  selectCell,
  selectionOrigin,
  type SheetSelection,
} from "./sheetSelection";
import { parseTSV, toTSV } from "../grid/clipboard";
import { scalarText } from "../editor/scalar";
const COPY_CHARACTER_LIMIT = 16 * 1024 * 1024;
function cells(
  engine: DocumentEngine,
  query: Query,
  selection: SheetSelection | null,
  revision: number,
) {
  if (!selection) throw new Error("Select cells first.");
  const rows = engine.selection(query, selection, revision);
  if (!rows.length) throw new Error("No data is selected.");
  return rows;
}
export function copySelection(
  engine: DocumentEngine,
  query: Query,
  selection: SheetSelection | null,
  revision: number,
): string {
  let characters = 0;
  const values = cells(engine, query, selection, revision).map((row) =>
    row.map(({ cell, identifier }) => {
      const raw =
        identifier ?? (cell.type === "missing" ? "" : engine.raw(cell.path));
      const value =
        identifier === undefined && cell.type === "string"
          ? (JSON.parse(raw) as string)
          : raw;
      characters += value.length;
      if (characters > COPY_CHARACTER_LIMIT)
        throw new Error(
          "Selection is too large for the clipboard. Copy a smaller range or use Copy JSON for one value.",
        );
      return value;
    }),
  );
  return toTSV(values);
}
function writable({ cell, identifier }: SelectedCell) {
  if (identifier !== undefined || cell.writable === false || cell.container)
    throw new Error(
      "Paste into editable value cells, not row identifiers or nested tables.",
    );
}
function replacement(item: SelectedCell, raw: string): AtomicMutation {
  const cell = item.cell;
  return cell.type === "missing"
    ? {
        action: "insert",
        path: cell.path.slice(0, -1),
        key: String(cell.path.at(-1)),
        raw,
      }
    : { action: "replace", path: cell.path, raw };
}
export function pasteSelection(
  engine: DocumentEngine,
  query: Query,
  selection: SheetSelection | null,
  text: string,
  revision: number,
): void {
  if (!selection) throw new Error("Select a destination cell first.");
  if (selection.mode !== "cells" && selection.spans.length > 1)
    throw new Error(
      "Pasting into nonadjacent areas is not supported. Select one destination cell.",
    );
  const values = parseTSV(text);
  if (values.length * values[0].length > 10000)
    throw new Error("Paste at most 10,000 cells.");
  const origin = selectionOrigin(selection);
  const target = selectCell(
    selectCell(null, origin),
    { r: origin.r + values.length - 1, c: origin.c + values[0].length - 1 },
    true,
  );
  const targets = cells(engine, query, target, revision);
  if (
    targets.length !== values.length ||
    targets.some((row) => row.length !== values[0].length)
  )
    throw new Error("Paste exceeds this table. Add rows or columns first.");
  const commands: AtomicMutation[] = [];
  for (let r = 0; r < values.length; r++)
    for (let c = 0; c < values[r].length; c++) {
      const item = targets[r][c];
      writable(item);
      const kind = (
        item.cell.type === "missing" || item.cell.type === "null"
          ? (item.cell.inputKind ?? "string")
          : item.cell.type
      ) as Kind;
      commands.push(
        replacement(
          item,
          values[r][c] === "" ? "null" : scalarText(kind, values[r][c]),
        ),
      );
    }
  engine.mutate({ action: "batch", commands }, revision);
}
export function fillSelection(
  engine: DocumentEngine,
  query: Query,
  selection: SheetSelection | null,
  revision: number,
): void {
  const rows = cells(engine, query, selection, revision);
  if (rows.length < 2) return;
  const commands: AtomicMutation[] = [];
  for (let c = 0; c < rows[0].length; c++) {
    const source = rows[0][c];
    writable(source);
    const raw =
      source.cell.type === "missing" ? "null" : engine.raw(source.cell.path);
    for (let r = 1; r < rows.length; r++) {
      const target = rows[r][c];
      writable(target);
      const kind =
        target.cell.type === "missing" || target.cell.type === "null"
          ? target.cell.inputKind
          : target.cell.type;
      if (
        source.cell.type !== "missing" &&
        source.cell.type !== "null" &&
        kind &&
        kind !== source.cell.type
      )
        throw new Error("Selected cells have incompatible types.");
      commands.push(replacement(target, raw));
    }
  }
  engine.mutate({ action: "batch", commands }, revision);
}
