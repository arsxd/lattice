import { ColumnMenu } from "./grid/ColumnMenu";
import { ValueBar } from "./editor/ValueBar";
import { SheetRange } from "./grid/SheetRange";
import ReviewDiff from "./editor/ReviewDiff";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DataGrid,
  type Column,
  type SortColumn,
  type DataGridHandle,
} from "react-data-grid";
import { DocumentClient } from "./worker/client";
import {
  pointer,
  type Cell,
  type Kind,
  type Mutation,
  type Path,
  type Projection,
  type Query,
  type Row,
} from "./document/engine";
import {
  browserSave,
  prepareBrowserSave,
  reloadFile,
  openFile,
  saveFile,
  desktop,
  release,
  type Opened,
} from "./platform/files";
import { SourceEditor } from "./editor/SourceEditor";
import { scalarText, cellInputKind } from "./editor/scalar";
import {
  packRecovery,
  unpackRecovery,
  type RecoveryDocument,
} from "./workspace/recovery";
import { sample } from "./sample";
import "react-data-grid/lib/styles.css";
import "./style.css";
const initialQuery: Query = { path: [], records: true, search: "", page: 0 };
type Selection = { cell: Cell; revision: number; raw: string };
type Editing = {
  action: "replace" | "insert" | "rename" | "remove";
  path: Path;
  revision: number;
  kind: Kind;
  value: string;
  key: string;
  parentKind?: string;
};
type Session = {
  id: string;
  client: DocumentClient;
  doc: Opened;
  view: Projection;
  query: Query;
  selection: Selection | null;
  mode: "table" | "source" | "review";
  source: string;
  sourceBase: string;
  sourceRevision: number;
  review: { before: string; after: string } | null;
  sheets: Projection["children"];
  truncatedSheets: boolean;
};
const sessionDirty = (s: Session) => s.view.dirty || s.source !== s.sourceBase;
type InlineEdit = {
  rename?: boolean;
  cell: Cell;
  kind: Kind;
  selectAll: boolean;
  revision: number;
  value: string;
  row: number;
  column: number;
  error: string;
};
function columnLetter(index: number): string {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
}
export default function App() {
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [discardContext, setDiscardContext] = useState("");
  const discardResolve = useRef<((answer: boolean) => void) | null>(null);
  function discard(
    context = "Closing the application will discard unsaved changes in all open documents.",
  ): Promise<boolean> {
    setDiscardContext(context);
    if (discardResolve.current) return Promise.resolve(false);
    setDiscardPrompt(true);
    return new Promise((resolve) => {
      discardResolve.current = resolve;
    });
  }
  function answerDiscard(answer: boolean) {
    const resolve = discardResolve.current;
    discardResolve.current = null;
    setDiscardPrompt(false);
    resolve?.(answer);
  }
  const recoveryEpoch = useRef(0);
  const [recoveryReady, setRecoveryReady] = useState(!desktop);
  const [recovered, setRecovered] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [recoveryEnabled, setRecoveryEnabled] = useState(
    localStorage.getItem("json-workbench-recovery") !== "off",
  );
  const client = useRef<DocumentClient | null>(null);
  const request = useRef(0);
  const selectionRequest = useRef(0);
  const busyRef = useRef(false);
  const [doc, setDoc] = useState<Opened | null>(null);
  const [view, setView] = useState<Projection | null>(null);
  const [query, setQuery] = useState<Query>(initialQuery);
  const [operationBusy, setBusy] = useState(false);
  const [columnName, setColumnName] = useState<string | null>(null);
  const [columnError, setColumnError] = useState("");
  const [inline, setInline] = useState<InlineEdit | null>(null);
  const busy = operationBusy;
  const committingCell = useRef(false);
  const inlineInput = useRef<HTMLInputElement>(null);
  const suppressBlur = useRef(false);
  const suppressPointerClick = useRef(false);
  const replayingClick = useRef(false);
  const grid = useRef<DataGridHandle>(null);
  const [frozenRows, setFrozenRows] = useState(0);
  const [frozenColumns, setFrozenColumns] = useState(1);
  const sessions = useRef(new Map<string, Session>());
  const [activeId, setActiveId] = useState("");
  const [tabVersion, setTabVersion] = useState(0);
  const [sheets, setSheets] = useState<Projection["children"]>([]);
  const [truncatedSheets, setTruncatedSheets] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeCell, setActiveCell] = useState<{
    row: number;
    column: number;
  } | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(
    null,
  );
  const [headerMenu, setHeaderMenu] = useState<number | null>(null);
  useEffect(() => {
    setActiveCell(null);
    setFrozenRows(0);
    setHeaderMenu(null);
  }, [activeId, query.path.join("\0")]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editError, setEditError] = useState("");
  const [mode, setMode] = useState<"table" | "source" | "review">("table");
  const [sourceTarget, setSourceTarget] = useState<{
    from: number;
    to: number;
    id: number;
  } | null>(null);
  useEffect(() => {
    if (view && view.rows.length * (view.headers.length + 1) > 10000)
      setFrozenRows(0);
  }, [view?.rows.length, view?.headers.length]);
  const [source, setSource] = useState("");
  const [sourceBase, setSourceBase] = useState("");
  const [sourceRevision, setSourceRevision] = useState(0);
  const [review, setReview] = useState<{
    before: string;
    after: string;
  } | null>(null);
  const [theme, setTheme] = useState(
    localStorage.getItem("json-workbench-theme") ?? "system",
  );
  const [inspector, setInspector] = useState(false);
  const [outlineVisible, setOutlineVisible] = useState(false);
  const sourceDirty = mode === "source" && source !== sourceBase;
  const dirty = !!view?.dirty || sourceDirty;
  const anyDirty =
    dirty ||
    !!inline ||
    [...sessions.current.values()].some(
      (s) => s.id !== activeId && sessionDirty(s),
    );
  const latest = useRef({ dirty: anyDirty, busy: operationBusy });
  latest.current = { dirty: anyDirty, busy: operationBusy };
  function snapshot(): Session | null {
    if (!doc || !view || !client.current) return null;
    return {
      id: activeId,
      client: client.current,
      doc,
      view,
      query,
      selection,
      mode,
      source,
      sourceBase,
      sourceRevision,
      review,
      sheets,
      truncatedSheets,
    };
  }
  function remember() {
    const current = snapshot();
    if (current) sessions.current.set(current.id, current);
  }
  function activate(s: Session) {
    ++request.current;
    ++selectionRequest.current;
    client.current = s.client;
    setActiveId(s.id);
    setSourceTarget(null);
    setDoc(s.doc);
    setView(s.view);
    setQuery(s.query);
    setSelection(s.selection);
    setMode(s.mode);
    setSource(s.source);
    setSourceBase(s.sourceBase);
    setSourceRevision(s.sourceRevision);
    setReview(s.review);
    setSheets(s.sheets);
    setTruncatedSheets(s.truncatedSheets);
    setEditing(null);
    setColumnName(null);
    setInline(null);
    setError("");
    setNotice("");
  }
  function switchDocument(id: string) {
    if (busy || editing || discardPrompt || id === activeId) return;
    remember();
    const next = sessions.current.get(id);
    if (next) activate(next);
  }
  async function closeDocument(id: string) {
    if (busy || editing || discardPrompt) return;
    await run(async () => {
      remember();
      const target = sessions.current.get(id);
      if (
        !target ||
        (sessionDirty(target) &&
          !(await discard(
            `Close ${target.doc.name} and discard its unsaved changes? Other documents stay open.`,
          )))
      )
        return;
      if (target.doc.token) await release(target.doc.token);
      target.client.dispose();
      sessions.current.delete(id);
      if (id === activeId) {
        const next = [...sessions.current.values()].at(-1);
        if (next) activate(next);
        else {
          client.current = null;
          setActiveId("");
          setDoc(null);
          setView(null);
          setSource("");
          setSourceBase("");
          setSelection(null);
          setMode("table");
          setSheets([]);
          setInline(null);
        }
      }
      setTabVersion((v) => v + 1);
    });
  }
  function progress(value: boolean) {
    busyRef.current = value;
    setBusy(value);
  }
  async function run(fn: () => Promise<void>) {
    if (busyRef.current) return;
    progress(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      progress(false);
    }
  }
  async function refresh(q = query) {
    if (!client.current) return;
    const id = ++request.current;
    const p = await client.current.call<Projection>("project", q);
    if (id !== request.current) return;
    setView(p);
    const root = q.path.length
      ? await client.current.call<Projection>("project", initialQuery)
      : p;
    if (id !== request.current) return;
    setSheets(root.sheets ?? root.children);
    setTruncatedSheets(root.rootKind === "object" && root.truncatedChildren);
    if (p.diagnostics.length && mode === "table") await showSource();
  }
  async function prepare(
    opened: Opened,
    path: Path = [],
    recovered = false,
  ): Promise<Session> {
    const next = new DocumentClient();
    try {
      await next.call("open", { text: opened.text });
      if (recovered) await next.call("saved", { text: "" });
      const q = { ...initialQuery, path };
      let p = await next.call<Projection>("project", q);
      if (!path.length && p.rootKind === "object" && !p.recordsAvailable) {
        q.records = false;
        p = await next.call<Projection>("project", q);
      }
      const root = path.length
        ? await next.call<Projection>("project", initialQuery)
        : p;
      return {
        id: crypto.randomUUID(),
        client: next,
        doc: recovered ? { ...opened, text: "" } : opened,
        view: p,
        query: q,
        selection: null,
        mode: p.diagnostics.length ? "source" : "table",
        source: opened.text,
        sourceBase: opened.text,
        sourceRevision: p.revision,
        review: null,
        sheets: root.sheets ?? root.children,
        truncatedSheets: root.rootKind === "object" && root.truncatedChildren,
      };
    } catch (e) {
      next.dispose();
      if (opened.token) await release(opened.token);
      throw e;
    }
  }
  async function load(opened: Opened, path: Path = []) {
    const next = await prepare(opened, path);
    remember();
    sessions.current.set(next.id, next);
    activate(next);
    setTabVersion((v) => v + 1);
  }
  async function open() {
    await run(async () => {
      const file = await openFile();
      if (file) await load(file);
    });
  }
  async function reloadSource() {
    if (!doc) return;
    await run(async () => {
      if (
        dirty &&
        !(await discard(
          "Reload source and discard this document's unsaved changes? Other tabs stay open.",
        ))
      )
        return;
      const opened = await reloadFile(doc);
      if (!opened) return;
      const next = await prepare(opened);
      next.id = activeId;
      if (doc.token) await release(doc.token);
      client.current?.dispose();
      sessions.current.set(activeId, next);
      activate(next);
      setTabVersion((v) => v + 1);
      setNotice("Source reloaded. Undo history, sorting and filters reset.");
    });
  }
  async function save(as = false) {
    await run(async () => {
      if (!doc || !client.current || !view) return;
      if (sourceDirty)
        throw new Error("Apply or discard the source draft before saving.");
      if (view.diagnostics.length)
        throw new Error("Repair the JSON errors before saving.");
      const target = await prepareBrowserSave(doc, as);
      if (!target) return;
      const { text } = await client.current.call<{
        text: string;
        revision: number;
      }>("text");
      const saved = await saveFile(target, text, as);
      if (saved) {
        if (desktop || saved.confirmed) {
          setDoc({ ...doc, ...saved, text });
          if (mode === "review") setReview({ before: text, after: text });
          await client.current.call("saved", { text });
          await refresh();
          setNotice("Saved.");
        } else
          setNotice(
            "Download requested. Browser mode cannot confirm the file was saved. Unsaved state is retained.",
          );
      }
    });
  }
  async function navigate(path: Path) {
    setColumnName(null);
    if (busyRef.current) return;
    await run(async () => {
      if (sourceDirty)
        throw new Error("Apply or discard the source draft before navigating.");
      const q = {
        ...query,
        path,
        filters: undefined,
        valueFilters: undefined,
        records: true,
        search: "",
        sort: undefined,
        page: 0,
      };
      setQuery(q);
      setSelection(null);
      setMode("table");
      await refresh(q);
    });
  }
  async function showInSource(path: Path, property = false) {
    await run(async () => {
      if (sourceDirty)
        throw new Error(
          "Apply or discard the source draft before locating a value.",
        );
      const target = await client.current!.call<{
        from: number;
        to: number;
        revision: number;
      }>("locate", { path, property });
      await showSource();
      setSourceTarget({ ...target, id: Date.now() });
    });
  }
  async function showSource() {
    setSourceTarget(null);
    if (!client.current) return;
    const result = await client.current.call<{
      text: string;
      revision: number;
    }>("text");
    setSource(result.text);
    setSourceBase(result.text);
    setSourceRevision(result.revision);
    setMode("source");
  }
  async function history(action: "undo" | "redo") {
    await run(async () => {
      if (sourceDirty)
        throw new Error("Apply or discard the source draft first.");
      await client.current?.call(action);
      setSelection(null);
      await refresh();
      if (mode === "source") await showSource();
      if (mode === "review" && doc && client.current)
        setReview({
          before: doc.text,
          after: (await client.current.call<{ text: string }>("text")).text,
        });
    });
  }
  async function select(cell: Cell) {
    if (cell.writable === false) {
      setSelection(null);
      return;
    }
    if (busyRef.current || !view || !client.current) return;
    const id = ++selectionRequest.current;
    try {
      const raw =
        cell.type === "missing"
          ? ""
          : await client.current.call<string>("raw", { path: cell.path });
      if (id === selectionRequest.current)
        setSelection({ cell, raw, revision: view.revision });
    } catch (e) {
      setError(String(e));
    }
  }
  async function edit(cell: Cell) {
    if (!view || !client.current || busyRef.current) return;
    await run(async () => {
      const raw =
        cell.type === "missing"
          ? "null"
          : await client.current!.call<string>("raw", { path: cell.path });
      const kind = cell.type === "missing" ? "null" : cell.type;
      setEditError("");
      setEditing({
        action: cell.type === "missing" ? "insert" : "replace",
        path: cell.type === "missing" ? cell.path.slice(0, -1) : cell.path,
        revision: view.revision,
        kind,
        value: kind === "string" ? JSON.parse(raw) : raw,
        key: cell.type === "missing" ? String(cell.path.at(-1)) : "",
        parentKind: cell.type === "missing" ? "object" : undefined,
      });
    });
  }
  async function mutate(command: Mutation, revision: number) {
    await client.current!.call("mutate", { command, revision });
    selectionRequest.current++;
    setSelection(null);
    await refresh();
  }
  async function applyEdit() {
    if (!editing) return;
    await run(async () => {
      try {
        const e = editing;
        let command: Mutation;
        if (e.action === "remove") command = { action: "remove", path: e.path };
        else if (e.action === "rename")
          command = { action: "rename", path: e.path, key: e.key };
        else {
          let raw =
            e.kind === "string"
              ? JSON.stringify(e.value)
              : e.kind === "null"
                ? "null"
                : e.value;
          const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
          if (e.kind === "number" && !number.test(raw))
            throw new Error("Enter a JSON number, such as 12, -0.5 or 1e3.");
          if (e.kind === "boolean" && !["true", "false"].includes(raw))
            throw new Error("Boolean must be true or false.");
          if (
            (e.kind === "array" && !raw.trim().startsWith("[")) ||
            (e.kind === "object" && !raw.trim().startsWith("{"))
          )
            throw new Error(`Enter a JSON ${e.kind}.`);
          command =
            e.action === "replace"
              ? { action: "replace", path: e.path, raw }
              : {
                  action: "insert",
                  path: e.path,
                  key: e.parentKind === "object" ? e.key : undefined,
                  raw,
                };
        }
        await mutate(command, e.revision);
        setEditing(null);
      } catch (e) {
        setEditError(e instanceof Error ? e.message : String(e));
      }
    });
  }
  function newEdit(action: "rename" | "remove") {
    if (!selection) return;
    setEditError("");
    setEditing({
      action,
      path: selection.cell.path,
      revision: selection.revision,
      kind: "string",
      value: "",
      key: String(selection.cell.path.at(-1) ?? ""),
    });
  }
  function valueColumn(index: number) {
    return view?.recordsAvailable && query.records
      ? index > 0
      : index === (view?.headers.length ?? 0) - 1;
  }
  function keyEditable(column: number) {
    return column === 0 && view?.kind === "object" && view.headers.length > 1;
  }
  function startKey(cell: Cell, row: number, initial?: string) {
    if (!view || busy) return;
    setInline({
      cell,
      kind: "string",
      rename: true,
      selectAll: initial === undefined,
      revision: view.revision,
      value: initial ?? String(cell.path.at(-1) ?? ""),
      row,
      column: 0,
      error: "",
    });
  }
  async function startInline(
    cell: Cell,
    row: number,
    column: number,
    initial?: string,
  ) {
    if (!view || !client.current || busy || cell.writable === false) return;
    const blank = cell.type === "missing" || cell.type === "null";
    const kind = cellInputKind(cell);
    if (cell.container || kind === "object") {
      await edit(cell);
      return;
    }
    if (initial !== undefined) {
      setInline({
        cell,
        kind,
        selectAll: false,
        revision: view.revision,
        value: initial,
        row,
        column,
        error: "",
      });
      return;
    }
    await run(async () => {
      const raw = blank
        ? ""
        : await client.current!.call<string>("raw", { path: cell.path });
      const value =
        kind === "array"
          ? raw.replace(/[\r\n\t]+/g, " ")
          : !blank && kind === "string"
            ? (JSON.parse(raw) as string)
            : raw;
      if (value.includes("\n") || value.includes("\r")) {
        setEditing({
          action: "replace",
          path: cell.path,
          revision: view.revision,
          kind,
          value,
          key: "",
        });
        setEditError("");
      } else
        setInline({
          cell,
          kind,
          selectAll: true,
          revision: view.revision,
          value,
          row,
          column,
          error: "",
        });
    });
  }
  async function addRow() {
    if (!view) return;
    await run(async () => {
      await client.current!.call("mutate", {
        command: { action: "add-row", path: view.path },
        revision: view.revision,
      });
      const next = {
        ...query,
        records: true,
        search: "",
        sort: undefined,
        page: Math.floor(view.total / 500),
      };
      setQuery(next);
      setSelection(null);
      await refresh(next);
      setNotice(
        query.search || query.sort
          ? "Row added. Search and sorting cleared to show the new row."
          : "",
      );
    });
  }
  async function addColumn() {
    if (!view || columnName === null) return;
    await run(async () => {
      try {
        await mutate(
          { action: "add-column", path: view.path, key: columnName },
          view.revision,
        );
        setColumnName(null);
        setColumnError("");
        requestAnimationFrame(() =>
          grid.current?.scrollToCell({ idx: view.headers.length }),
        );
        setNotice("");
      } catch (e) {
        setColumnError(e instanceof Error ? e.message : String(e));
      }
    });
  }
  function focusCell(row: number, column: number) {
    requestAnimationFrame(() => {
      if (inlineInput.current) return;
      grid.current?.setActivePosition(
        { rowIdx: row, idx: column + 1 },
        { shouldFocus: true },
      );
      // The pinned grid skips focus when the active position is unchanged.
      // Restore focus after our inline input unmounts, including Enter/Escape.
      requestAnimationFrame(() => {
        if (inlineInput.current) return;
        const element = grid.current?.element;
        const cell = element?.querySelector<HTMLElement>(
          `[role="row"][aria-rowindex="${row + 2}"] [role="gridcell"][aria-colindex="${column + 2}"]`,
        );
        (cell ?? element)?.focus();
      });
    });
  }
  async function commitInline(
    move:
      | "down"
      | "up"
      | "next"
      | "previous"
      | { row: number; column: number }
      | null = null,
  ): Promise<boolean> {
    if (!inline || !view || busyRef.current || committingCell.current)
      return false;
    committingCell.current = true;
    const current = inline;
    let succeeded = false;
    await run(async () => {
      try {
        const blank =
          current.cell.type === "missing" || current.cell.type === "null";
        const raw =
          (blank || current.kind !== "string") && current.value === ""
            ? "null"
            : scalarText(current.kind, current.value);
        await mutate(
          current.rename
            ? { action: "rename", path: current.cell.path, key: current.value }
            : current.cell.type === "missing"
              ? {
                  action: "insert",
                  path: current.cell.path.slice(0, -1),
                  key: String(current.cell.path.at(-1)),
                  raw,
                }
              : { action: "replace", path: current.cell.path, raw },
          current.revision,
        );
        setInline(null);
        succeeded = true;
        let row = current.row,
          column = current.column;
        if (move && typeof move === "object") {
          row = move.row;
          column = move.column;
        } else if (move === "down" || move === "up")
          row = Math.max(
            0,
            Math.min(view.rows.length - 1, row + (move === "down" ? 1 : -1)),
          );
        else if (move === "next" || move === "previous") {
          const width = view.headers.length,
            direction = move === "next" ? 1 : -1;
          let index = row * width + column + direction;
          while (index >= 0 && index < view.rows.length * width) {
            const r = Math.floor(index / width),
              c = index % width;
            if (valueColumn(c) && view.rows[r].cells[c].writable !== false) {
              row = r;
              column = c;
              break;
            }
            index += direction;
          }
        }
        if (move) focusCell(row, column);
      } catch (e) {
        setInline({
          ...current,
          error: e instanceof Error ? e.message : String(e),
        });
        requestAnimationFrame(() => inlineInput.current?.focus());
      }
    });
    committingCell.current = false;
    return succeeded;
  }
  function cancelInline() {
    if (!inline) return;
    suppressBlur.current = true;
    setInline(null);
    focusCell(inline.row, inline.column);
    requestAnimationFrame(() => {
      suppressBlur.current = false;
    });
  }
  const columns = useMemo<Column<Row>[]>(
    () =>
      view
        ? [
            {
              key: "-1",
              name: "",
              width: 44,
              minWidth: 44,
              frozen: true,
              cellClass: "row-number",
              renderCell: ({ rowIdx }) => view.page * 500 + rowIdx + 1,
            },
            ...view.headers.map<Column<Row>>((name, i) => ({
              key: String(i),
              name,
              renderHeaderCell: () => (
                <div className="sheet-column-heading">
                  <small>{columnLetter(i)}</small>
                  <span>
                    {name}
                    {query.sort?.column === i && (
                      <span
                        className="sort-indicator"
                        aria-label={
                          query.sort.direction === "ASC"
                            ? "Sorted ascending"
                            : "Sorted descending"
                        }
                      >
                        {query.sort.direction === "ASC" ? " ↑" : " ↓"}
                      </span>
                    )}
                  </span>
                  <button
                    className="header-filter"
                    aria-label={`Sort and filter ${name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterAnchor(e.currentTarget);
                      setHeaderMenu(headerMenu === i ? null : i);
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="m4 6 4 4 4-4" />
                    </svg>
                    {query.valueFilters?.[String(i)] !== undefined && (
                      <span className="filter-dot" />
                    )}
                  </button>
                </div>
              ),
              width: i === 0 ? (view.kind === "array" ? 64 : 150) : 155,
              minWidth: i === 0 && view.kind === "array" ? 48 : 80,
              resizable: true,
              sortable: false,
              frozen: i < frozenColumns,
              renderCell: ({ row, rowIdx }) => {
                if (inline && inline.row === rowIdx && inline.column === i)
                  return (
                    <input
                      ref={inlineInput}
                      className="inline-cell"
                      aria-label={`Edit ${name} (${inline.kind})`}
                      aria-invalid={!!inline.error}
                      aria-describedby={inline.error ? "cell-error" : undefined}
                      autoFocus
                      value={inline.value}
                      onFocus={(e) => {
                        if (inline.selectAll) e.currentTarget.select();
                      }}
                      onBlur={() => {
                        if (!suppressBlur.current && !committingCell.current)
                          void commitInline();
                      }}
                      onChange={(e) =>
                        setInline({
                          ...inline,
                          value: e.target.value,
                          error: "",
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.nativeEvent.isComposing) return;
                        if (
                          (e.metaKey || e.ctrlKey) &&
                          e.key.toLowerCase() === "s"
                        ) {
                          e.preventDefault();
                          void commitInline().then((ok) => {
                            if (ok) void save(e.shiftKey);
                          });
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelInline();
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          void commitInline(
                            e.key === "Tab"
                              ? e.shiftKey
                                ? "previous"
                                : "next"
                              : e.shiftKey
                                ? "up"
                                : "down",
                          );
                        }
                      }}
                    />
                  );
                const c = row.cells[i];
                return (
                  <span
                    className={`cell-value ${c.type === "missing" ? "missing" : ""} ${c.container ? "container-value" : ""} ${c.type === "number" ? "numeric" : ""}`}
                    title={`${c.type} — ${pointer(c.path) || "root"}`}
                  >
                    {c.display}
                  </span>
                );
              },
            })),
          ]
        : [],
    [view, inline, operationBusy, query, headerMenu, frozenColumns],
  );
  const sortColumns: SortColumn[] = query.sort
    ? [
        {
          columnKey: String(query.sort.column),
          direction: query.sort.direction,
        },
      ]
    : [];
  async function checkpoint(text?: string) {
    if (!desktop) return;
    const epoch = ++recoveryEpoch.current;
    await invoke("checkpoint", {
      epoch,
      name: text === undefined ? null : packRecovery([]).name,
      text: text ?? null,
    });
  }
  useEffect(() => {
    if (desktop)
      invoke<{ name: string; text: string } | null>("read_recovery")
        .then((draft) => {
          setRecovered(draft);
          setRecoveryReady(true);
        })
        .catch((e) => setError("Recovery checkpoint retained: " + String(e)));
  }, []);
  useEffect(() => {
    localStorage.setItem(
      "json-workbench-recovery",
      recoveryEnabled ? "on" : "off",
    );
    if (!desktop || !recoveryReady || operationBusy || recovered) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            if (!recoveryEnabled) {
              await checkpoint();
              return;
            }
            const current = snapshot();
            const all = [...sessions.current.values()].filter(
              (s) => s.id !== activeId,
            );
            if (current) all.push(current);
            const documents: RecoveryDocument[] = [];
            for (const s of all.filter(sessionDirty)) {
              const text =
                s.source !== s.sourceBase
                  ? s.source
                  : (await s.client.call<{ text: string }>("text")).text;
              documents.push({ name: s.doc.name, text });
            }
            if (!cancelled)
              await checkpoint(
                documents.length ? packRecovery(documents).text : undefined,
              );
          } catch (e) {
            if (!cancelled) setError("Local recovery failed: " + String(e));
          }
        })();
      },
      anyDirty ? 2000 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    view?.revision,
    doc?.name,
    source,
    sourceDirty,
    anyDirty,
    operationBusy,
    recoveryEnabled,
    recovered,
    activeId,
    tabVersion,
    recoveryReady,
  ]);
  useEffect(() => {
    if (desktop)
      void invoke("set_guard", { blocked: anyDirty || operationBusy }).catch(
        (e) => setError(String(e)),
      );
  }, [anyDirty, operationBusy]);
  useEffect(() => {
    if (!desktop) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(async ({ listen }) => {
      unlisten = await listen("request-quit", async () => {
        if (latest.current.busy) return;
        if (!latest.current.dirty || (await discard())) {
          await invoke("checkpoint", {
            epoch: ++recoveryEpoch.current,
            name: null,
            text: null,
          });
          await invoke("quit_app");
        }
      });
    });
    return () => unlisten?.();
  }, []);
  useEffect(() => {
    if (!editing && !discardPrompt) return;
    const dialog = document.querySelector<HTMLElement>(".edit-dialog");
    const previous = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const items = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
        ),
      ];
      const first = items[0],
        last = items.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [!!editing, discardPrompt]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("json-workbench-theme", theme);
  }, [theme]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (
        latest.current.dirty ||
        latest.current.busy ||
        (!desktop && client.current !== null)
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    let unlisten: (() => void) | undefined;
    if (desktop)
      import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
        unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
          if (latest.current.busy) {
            event.preventDefault();
            return;
          }
          if (latest.current.dirty) {
            event.preventDefault();
            if (await discard()) {
              await invoke("checkpoint", {
                epoch: ++recoveryEpoch.current,
                name: null,
                text: null,
              });
              await invoke("quit_app");
            }
          }
        });
      });
    return () => {
      window.removeEventListener("beforeunload", before);
      unlisten?.();
      for (const session of sessions.current.values()) session.client.dispose();
    };
  }, []);
  useEffect(() => {
    if (desktop)
      import("@tauri-apps/api/window")
        .then(({ getCurrentWindow }) =>
          getCurrentWindow().setTitle(
            `${dirty ? "● " : ""}${doc?.name ?? "Lattice"} — Lattice`,
          ),
        )
        .catch(() => {});
  }, [dirty, doc?.name]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (discardPrompt) {
        if (e.key === "Escape") answerDiscard(false);
        return;
      }
      if (inline) return;
      if (editing) {
        if (e.key === "Escape" && !busy) setEditing(null);
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "o") {
        e.preventDefault();
        void open();
      }
      if (k === "s") {
        e.preventDefault();
        void save(e.shiftKey);
      }
      if (k === "z") {
        if (sourceDirty) return;
        e.preventDefault();
        void history(e.shiftKey ? "redo" : "undo");
      }
      if (k === "f" && mode === "table") {
        e.preventDefault();
        document.getElementById("find")?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });
  const currentCell =
    activeCell && activeCell.column >= 0
      ? view?.rows[activeCell.row]?.cells[activeCell.column]
      : undefined;
  function changeQuery(next: Query) {
    setQuery(next);
    void run(() => refresh(next));
  }
  return (
    <div
      className="app-shell"
      onClickCapture={(e) => {
        if (suppressPointerClick.current && !replayingClick.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressPointerClick.current = false;
        }
      }}
      onPointerCancel={() => {
        suppressPointerClick.current = false;
      }}
      onPointerDownCapture={(e) => {
        if (
          !inline ||
          committingCell.current ||
          !(e.target instanceof HTMLElement) ||
          e.target.closest(".inline-cell")
        )
          return;
        suppressPointerClick.current = true;
        const target = e.target;
        const cell = target.closest<HTMLElement>('[role="gridcell"]');
        const row = cell?.closest('[role="row"]');
        e.preventDefault();
        e.stopPropagation();
        if (cell && row) {
          void commitInline({
            row: Number(row.getAttribute("aria-rowindex")) - 2,
            column: Number(cell.getAttribute("aria-colindex")) - 2,
          });
        } else {
          const control = target.closest<HTMLElement>("button,input,select");
          void commitInline().then((ok) => {
            if (ok && control)
              requestAnimationFrame(() => {
                control.focus();
                replayingClick.current = true;
                control.click();
                replayingClick.current = false;
              });
          });
        }
      }}
    >
      <header className="toolbar">
        <strong title="JSON Workbench">Lattice</strong>
        <span className="divider" />
        <button
          disabled={busy}
          onClick={() =>
            void run(() => load({ name: "untitled.json", text: "{}\n" }))
          }
        >
          New
        </button>
        <button onClick={() => void open()} disabled={busy}>
          Open…
        </button>
        <button
          onClick={() => void save()}
          disabled={busy || !doc || !!view?.diagnostics.length || sourceDirty}
        >
          {desktop || browserSave ? "Save" : "Download"}
        </button>
        {(desktop || browserSave) && (
          <button
            onClick={() => void save(true)}
            disabled={busy || !doc || !!view?.diagnostics.length || sourceDirty}
          >
            Save as…
          </button>
        )}
        <span className="divider" />
        <button
          onClick={() => void history("undo")}
          disabled={busy || !view?.undo || sourceDirty}
        >
          Undo
        </button>
        <button
          onClick={() => void history("redo")}
          disabled={busy || !view?.redo || sourceDirty}
        >
          Redo
        </button>
        <div className="spacer" />
        <button
          disabled={busy || !doc}
          onClick={() => void reloadSource()}
          title={
            doc?.handle
              ? "Read the latest source file"
              : "Choose the source file again to reload it"
          }
        >
          Reload source…
        </button>
        {!desktop && <span className="muted">Web client</span>}
        <label className="sr-only" htmlFor="theme">
          Theme
        </label>
        <span className="select-inset">
          <select
            id="theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">System theme</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </span>
      </header>
      {error && (
        <div className="message error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="message" role="status">
          {notice}
        </div>
      )}
      {recovered && (
        <div className="message">
          <span>
            Recovered workspace available. Restore its unsaved documents into
            new tabs.
          </span>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const drafts = unpackRecovery(recovered);
                const restored: Session[] = [];
                try {
                  for (const draft of drafts)
                    restored.push(
                      await prepare(
                        { name: "recovered-" + draft.name, text: draft.text },
                        [],
                        true,
                      ),
                    );
                } catch (e) {
                  restored.forEach((s) => s.client.dispose());
                  throw e;
                }
                remember();
                for (const s of restored) sessions.current.set(s.id, s);
                if (restored.length) activate(restored.at(-1)!);
                setTabVersion((v) => v + 1);
                setRecovered(null);
              })
            }
          >
            Restore draft
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await checkpoint();
                setRecovered(null);
              })
            }
          >
            Discard recovered draft
          </button>
        </div>
      )}
      {!doc ? (
        <main className="welcome">
          <div className="file-symbol">{"{ }"}</div>
          <h1>Work directly with your JSON.</h1>
          <p>
            Inspect nested data as tables. Edit values without losing their
            types or numeric precision.
          </p>
          <div className="welcome-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void open()}
            >
              Open JSON file…
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(() => load({ name: "untitled.json", text: "{}\n" }))
              }
            >
              New document
            </button>
          </div>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(() =>
                load({ name: "example-signals.json", text: sample }, [
                  "signals",
                ]),
              )
            }
          >
            Explore illustrative engineering data
          </button>
          <p className="small">
            Local files only. Build limits: UTF-8 input, 64 MiB files, 256
            nesting levels. Large-file performance is still under evaluation.
          </p>
        </main>
      ) : (
        <>
          <div className="document-tab">
            <div
              className="document-tabs"
              role="tablist"
              aria-label="Open documents"
            >
              {[...sessions.current.values()].map((s) => (
                <div
                  className={`document-tab-item ${s.id === activeId ? "active" : ""}`}
                  key={s.id}
                >
                  <button
                    role="tab"
                    aria-selected={s.id === activeId}
                    tabIndex={s.id === activeId ? 0 : -1}
                    onKeyDown={(e) => {
                      const ids = [...sessions.current.keys()];
                      let index = ids.indexOf(s.id);
                      if (e.key === "ArrowRight")
                        index = (index + 1) % ids.length;
                      else if (e.key === "ArrowLeft")
                        index = (index - 1 + ids.length) % ids.length;
                      else if (e.key === "Home") index = 0;
                      else if (e.key === "End") index = ids.length - 1;
                      else return;
                      e.preventDefault();
                      switchDocument(ids[index]);
                      requestAnimationFrame(() =>
                        document
                          .querySelector<HTMLElement>(
                            '[role="tab"][aria-selected="true"]',
                          )
                          ?.focus(),
                      );
                    }}
                    disabled={busy || !!editing}
                    onClick={() => switchDocument(s.id)}
                  >
                    {s.id === activeId ? doc.name : s.doc.name}
                    {(s.id === activeId ? dirty : sessionDirty(s)) && (
                      <span aria-label="Unsaved changes" className="dirty-dot">
                        {" "}
                        ●
                      </span>
                    )}
                  </button>
                  <button
                    aria-label={`Close ${s.id === activeId ? doc.name : s.doc.name}`}
                    disabled={busy || !!editing}
                    onClick={() => void closeDocument(s.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="spacer" />
            <button
              disabled={busy || sourceDirty}
              onClick={() =>
                void run(async () => {
                  const current = await client.current!.call<{ text: string }>(
                    "text",
                  );
                  setReview({ before: doc.text, after: current.text });
                  setMode("review");
                })
              }
            >
              Review changes
            </button>
          </div>
          <main className="workspace">
            {outlineVisible && (
              <aside className="outline">
                <div className="pane-label">Document</div>
                <button
                  className={query.path.length === 0 ? "tree active" : "tree"}
                  onClick={() => void navigate([])}
                  disabled={busy}
                >
                  ⌂ <span>root</span>
                  <small>{view?.rootKind}</small>
                </button>
                {query.path.length > 0 && (
                  <button
                    className="tree"
                    disabled={busy}
                    onClick={() => void navigate(query.path.slice(0, -1))}
                  >
                    ↑ Parent
                  </button>
                )}
                <div className="outline-path">
                  {pointer(view?.path ?? []) || "/"}
                </div>
                {view?.children.map((item) => (
                  <button
                    className="tree"
                    key={pointer(item.path)}
                    disabled={busy}
                    onClick={() => void navigate(item.path)}
                  >
                    <span className="node-icon">
                      {item.kind === "array" ? "[ ]" : "{ }"}
                    </span>
                    <span className="tree-label">{item.label}</span>
                  </button>
                ))}
                {view?.truncatedChildren && (
                  <p className="small">
                    First 200 nested entries shown here. All entries remain
                    accessible in the table.
                  </p>
                )}
                <p className="outline-help">
                  Double-click a nested value to open its table. Select a value
                  to inspect its exact JSON.
                </p>
              </aside>
            )}
            <section className="document">
              <div className="location">
                <button
                  aria-pressed={outlineVisible}
                  onClick={() => setOutlineVisible(!outlineVisible)}
                >
                  Browse
                </button>
                <nav aria-label="JSON path">
                  <button disabled={busy} onClick={() => void navigate([])}>
                    root
                  </button>
                  {(view?.path ?? []).map((part, i) => (
                    <span key={i}>
                      {" "}
                      /{" "}
                      <button
                        disabled={busy}
                        onClick={() =>
                          void navigate(view!.path.slice(0, i + 1))
                        }
                      >
                        {String(part)}
                      </button>
                    </span>
                  ))}
                </nav>
                <div className="spacer" />
                <div className="segmented">
                  <button
                    aria-pressed={mode === "table"}
                    disabled={busy || sourceDirty || !!view?.diagnostics.length}
                    onClick={() => setMode("table")}
                  >
                    Table
                  </button>
                  <button
                    title={
                      currentCell
                        ? "Open source at selected cell"
                        : "Open JSON source"
                    }
                    aria-pressed={mode === "source"}
                    disabled={busy || mode === "source"}
                    onClick={() => {
                      if (currentCell && currentCell.type !== "missing")
                        void showInSource(currentCell.path);
                      else {
                        setSourceTarget(null);
                        void run(showSource);
                      }
                    }}
                  >
                    Source
                  </button>
                </div>
                <button
                  aria-label="Toggle value inspector"
                  onClick={() => setInspector(!inspector)}
                >
                  Details
                </button>
              </div>
              {!!view?.diagnostics.length && (
                <div className="diagnostics" role="alert">
                  <strong>
                    {view.diagnostics.length} JSON issue
                    {view.diagnostics.length === 1 ? "" : "s"}
                  </strong>
                  <div>
                    {view.diagnostics.slice(0, 5).map((d, i) => (
                      <p key={i}>
                        Line {d.line}, column {d.column}: {d.message}
                      </p>
                    ))}
                  </div>
                  <span>
                    Repair in Source. Table editing and saving are paused.
                  </span>
                </div>
              )}
              {mode === "table" && view && (
                <>
                  {headerMenu !== null && (
                    <ColumnMenu
                      key={`${pointer(query.path)}:${headerMenu}`}
                      onShowSource={() => {
                        const row = view.rows.find(
                          (r) =>
                            r.cells[headerMenu]?.type !== "missing" &&
                            r.cells[headerMenu]?.writable !== false,
                        );
                        setHeaderMenu(null);
                        if (row)
                          void showInSource(row.cells[headerMenu].path, true);
                      }}
                      anchor={filterAnchor}
                      name={view.headers[headerMenu]}
                      selected={query.valueFilters?.[String(headerMenu)]}
                      load={async () => {
                        const p = await client.current!.call<Projection>(
                          "project",
                          { ...query, optionsColumn: headerMenu },
                        );
                        return {
                          options: p.filterOptions ?? [],
                          truncated: !!p.filterOptionsTruncated,
                        };
                      }}
                      onClose={() => setHeaderMenu(null)}
                      onSort={(direction) => {
                        changeQuery({
                          ...query,
                          page: 0,
                          sort: direction
                            ? { column: headerMenu, direction }
                            : undefined,
                        });
                        setHeaderMenu(null);
                      }}
                      onApply={(keys) => {
                        const filters = { ...query.valueFilters };
                        if (keys === undefined)
                          delete filters[String(headerMenu)];
                        else filters[String(headerMenu)] = keys;
                        changeQuery({
                          ...query,
                          page: 0,
                          valueFilters: filters,
                        });
                        setHeaderMenu(null);
                      }}
                    />
                  )}
                  {selection && activeCell && (
                    <ValueBar
                      address={
                        activeCell
                          ? `${columnLetter(activeCell.column)}${view.page * 500 + activeCell.row + 1}`
                          : ""
                      }
                      value={
                        selection
                          ? selection.cell.type === "string"
                            ? JSON.parse(selection.raw)
                            : selection.raw
                          : ""
                      }
                      editable={
                        !!selection &&
                        !!activeCell &&
                        valueColumn(activeCell.column) &&
                        !selection.cell.container &&
                        selection.cell.writable !== false
                      }
                      onCommit={async (value) => {
                        if (!selection) return;
                        const c = selection.cell;
                        const kind = cellInputKind(c);
                        const raw =
                          value === "" && kind !== "string"
                            ? "null"
                            : scalarText(kind as Kind, value);
                        await mutate(
                          c.type === "missing"
                            ? {
                                action: "insert",
                                path: c.path.slice(0, -1),
                                key: String(c.path.at(-1)),
                                raw,
                              }
                            : { action: "replace", path: c.path, raw },
                          selection.revision,
                        );
                      }}
                    />
                  )}
                  {frozenRows > 0 && (
                    <style>
                      {Array.from(
                        { length: Math.min(frozenRows, view.rows.length) },
                        (_, r) =>
                          `.data-grid [role=row][aria-rowindex="${r + 2}"] > [role=gridcell] {position:sticky;inset-block-start:${48 + r * 28}px;z-index:4;background:var(--surface);} .data-grid [role=row][aria-rowindex="${r + 2}"] > [role=gridcell]:nth-child(-n+${frozenColumns + 1}){z-index:5;}`,
                      ).join("")}
                    </style>
                  )}
                  <div className="table-tools">
                    <input
                      id="find"
                      aria-label="Find in table"
                      placeholder="Find in this table…"
                      value={query.search}
                      disabled={busy}
                      onChange={(e) =>
                        changeQuery({
                          ...query,
                          search: e.target.value,
                          page: 0,
                        })
                      }
                    />
                    {inspector && view.recordsAvailable && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          changeQuery({
                            ...query,
                            records: !query.records,
                            page: 0,
                            sort: undefined,
                          })
                        }
                      >
                        {query.records ? "Properties view" : "Records view"}
                      </button>
                    )}
                    {(Object.values(query.filters ?? {}).some(Boolean) ||
                      Object.keys(query.valueFilters ?? {}).length > 0) && (
                      <button
                        onClick={() =>
                          changeQuery({
                            ...query,
                            page: 0,
                            filters: undefined,
                            valueFilters: undefined,
                          })
                        }
                      >
                        Clear filters
                      </button>
                    )}
                    <details className="freeze-controls">
                      <summary>Freeze panes</summary>
                      <div>
                        <label>
                          Rows{" "}
                          <select
                            aria-label="Freeze rows"
                            value={frozenRows}
                            disabled={busy}
                            onChange={(e) => {
                              const count = Number(e.target.value);
                              if (
                                count &&
                                view.rows.length * (view.headers.length + 1) >
                                  10000
                              ) {
                                setError(
                                  "Freezing rows is limited to pages with at most 10,000 cells.",
                                );
                                return;
                              }
                              setFrozenRows(count);
                            }}
                          >
                            {[0, 1, 2, 3, 5].map((n) => (
                              <option key={n} value={n}>
                                {n === 0 ? "None" : `First ${n}`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Columns{" "}
                          <select
                            aria-label="Freeze columns"
                            value={frozenColumns}
                            disabled={busy}
                            onChange={(e) =>
                              setFrozenColumns(Number(e.target.value))
                            }
                          >
                            {[0, 1, 2, 3, 5].map((n) => (
                              <option key={n} value={n}>
                                {n === 0 ? "None" : `First ${n}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </details>
                    <div className="spacer" />
                    {((query.records && view.recordsAvailable) ||
                      view.total === 0) &&
                    (view.kind === "object" || view.kind === "array") ? (
                      <>
                        <button
                          disabled={busy || columnName !== null}
                          onClick={() => void addRow()}
                        >
                          Add row
                        </button>
                        <button
                          disabled={
                            busy || view.total === 0 || columnName !== null
                          }
                          onClick={() => {
                            setColumnName("");
                            setColumnError("");
                          }}
                        >
                          Add column
                        </button>
                      </>
                    ) : (
                      (view.kind === "object" || view.kind === "array") && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            setEditError("");
                            setEditing({
                              action: "insert",
                              path: view.path,
                              revision: view.revision,
                              kind: "string",
                              value: "",
                              key: "",
                              parentKind: view.kind,
                            });
                          }}
                        >
                          {view.kind === "object" ? "Add property" : "Add item"}
                        </button>
                      )
                    )}
                  </div>
                  {columnName !== null && (
                    <form
                      className="column-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void addColumn();
                      }}
                    >
                      <label>
                        Column name{" "}
                        <input
                          autoFocus
                          value={columnName}
                          disabled={operationBusy}
                          onChange={(e) => {
                            setColumnName(e.target.value);
                            setColumnError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setColumnName(null);
                          }}
                        />
                      </label>
                      <button type="submit" disabled={operationBusy}>
                        Add column
                      </button>
                      <button
                        type="button"
                        disabled={operationBusy}
                        onClick={() => setColumnName(null)}
                      >
                        Cancel
                      </button>
                      {columnError && <span role="alert">{columnError}</span>}
                    </form>
                  )}
                  <div className="table-summary">
                    {view.matched.toLocaleString()} of{" "}
                    {view.total.toLocaleString()} rows <span>•</span>{" "}
                    {view.headers.length} columns{" "}
                    {query.sort && (
                      <span className="sort-summary">
                        Sorted by {view.headers[query.sort.column]} (
                        {query.sort.direction === "ASC"
                          ? "ascending"
                          : "descending"}
                        ){" "}
                        <button
                          disabled={busy}
                          onClick={() =>
                            changeQuery({ ...query, sort: undefined, page: 0 })
                          }
                        >
                          Clear sort
                        </button>
                      </span>
                    )}
                  </div>
                  <SheetRange
                    isValueColumn={valueColumn}
                    recordMode={query.records && view.recordsAvailable}
                    view={view}
                    read={(p) =>
                      client.current!.call<string>("raw", { path: p })
                    }
                    apply={async (ops) => {
                      await mutate(
                        { action: "batch", commands: ops },
                        view.revision,
                      );
                    }}
                    onAddRow={() => void addRow()}
                    onAddColumn={() => {
                      setColumnName("");
                      setColumnError("");
                    }}
                  >
                    <DataGrid<Row>
                      ref={grid}
                      enableVirtualization={frozenRows === 0}
                      className="data-grid"
                      columns={columns}
                      rows={view.rows}
                      getRowKey={(r) => r.id}
                      rowHeight={28}
                      headerRowHeight={48}
                      sortColumns={sortColumns}
                      onSortColumnsChange={(sort) => {
                        if (busy) return;
                        const s = sort.at(-1);
                        changeQuery({
                          ...query,
                          sort: s
                            ? {
                                column: Number(s.columnKey),
                                direction: s.direction,
                              }
                            : undefined,
                          page: 0,
                        });
                      }}
                      onCellClick={({ row, rowIdx, column }) => {
                        const index = Number(column.key);
                        setActiveCell({ row: rowIdx, column: index });
                        if (index >= 0 && !inline)
                          void select(row.cells[index]);
                      }}
                      onActivePositionChange={({ row, rowIdx, column }) => {
                        if (column)
                          setActiveCell({
                            row: rowIdx,
                            column: Number(column.key),
                          });
                        if (!inline && row && column && Number(column.key) >= 0)
                          void select(row.cells[Number(column.key)]);
                      }}
                      onCellDoubleClick={({ row, rowIdx, column }) => {
                        if (busy || Number(column.key) < 0) return;
                        const cell = row.cells[Number(column.key)];
                        if (keyEditable(Number(column.key)))
                          startKey(cell, rowIdx);
                        else if (cell.container) void navigate(cell.path);
                        else if (valueColumn(Number(column.key)))
                          void startInline(cell, rowIdx, Number(column.key));
                      }}
                      onCellKeyDown={(args, event) => {
                        if (busy) return;
                        if (args.mode !== "ACTIVE" || !args.row || !args.column)
                          return;
                        if (Number(args.column.key) < 0) return;
                        const cell = args.row.cells[Number(args.column.key)];
                        if (
                          keyEditable(Number(args.column.key)) &&
                          (event.key === "F2" ||
                            event.key === "Enter" ||
                            (event.key.length === 1 &&
                              !event.metaKey &&
                              !event.ctrlKey &&
                              !event.altKey &&
                              !event.nativeEvent.isComposing))
                        ) {
                          event.preventGridDefault();
                          event.preventDefault();
                          startKey(
                            cell,
                            args.rowIdx,
                            event.key.length === 1 ? event.key : undefined,
                          );
                          return;
                        }

                        if (
                          event.key.length === 1 &&
                          !event.metaKey &&
                          !event.ctrlKey &&
                          !event.altKey &&
                          !event.nativeEvent.isComposing &&
                          valueColumn(Number(args.column.key)) &&
                          !cell.container
                        ) {
                          event.preventGridDefault();
                          event.preventDefault();
                          void startInline(
                            cell,
                            args.rowIdx,
                            Number(args.column.key),
                            event.key,
                          );
                          return;
                        }
                        if (
                          (event.key === "Delete" ||
                            event.key === "Backspace") &&
                          valueColumn(Number(args.column.key)) &&
                          !cell.container &&
                          cell.writable !== false
                        ) {
                          event.preventDefault();
                          event.preventGridDefault();
                          if (cell.type !== "missing")
                            void run(async () => {
                              await mutate(
                                {
                                  action: "replace",
                                  path: cell.path,
                                  raw: "null",
                                },
                                view.revision,
                              );
                              focusCell(args.rowIdx, Number(args.column!.key));
                            });
                          return;
                        }
                        if (event.key === "Enter" || event.key === "F2") {
                          event.preventGridDefault();
                          event.preventDefault();
                          if (
                            (cell.type === "null" || cell.type === "missing") &&
                            valueColumn(Number(args.column.key))
                          )
                            void startInline(
                              cell,
                              args.rowIdx,
                              Number(args.column.key),
                            );
                          else if (cell.container && event.key === "Enter")
                            void navigate(cell.path);
                          else if (cell.container) void edit(cell);
                          else if (event.key === "Enter")
                            focusCell(
                              Math.max(
                                0,
                                Math.min(
                                  view.rows.length - 1,
                                  args.rowIdx + (event.shiftKey ? -1 : 1),
                                ),
                              ),
                              Number(args.column.key),
                            );
                          else if (valueColumn(Number(args.column.key)))
                            void startInline(
                              cell,
                              args.rowIdx,
                              Number(args.column.key),
                            );
                        }
                      }}
                      aria-label="JSON data table"
                    />
                  </SheetRange>
                  {view.rows.length === 0 && (
                    <div className="empty-table">
                      {query.search
                        ? "No matching rows. Clear the search to show all rows."
                        : "This container is empty. Add a property or item to begin."}
                    </div>
                  )}
                  <div className="pagination">
                    <span>Showing up to 500 rows per page</span>
                    <div className="spacer" />
                    <button
                      disabled={busy || view.page === 0}
                      onClick={() =>
                        changeQuery({ ...query, page: view.page - 1 })
                      }
                    >
                      Previous
                    </button>
                    <span>
                      Page {view.page + 1} / {view.pages}
                    </span>
                    <button
                      disabled={busy || view.page + 1 >= view.pages}
                      onClick={() =>
                        changeQuery({ ...query, page: view.page + 1 })
                      }
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
              {mode === "source" && (
                <>
                  {sourceDirty && (
                    <div className="source-actions">
                      <span>
                        {sourceDirty
                          ? "Source draft has unapplied changes"
                          : "Source matches the document"}
                      </span>
                      <div className="spacer" />
                      <button
                        disabled={!sourceDirty || busy}
                        onClick={() => void run(showSource)}
                      >
                        Discard draft
                      </button>
                      <button
                        className="primary"
                        disabled={!sourceDirty || busy}
                        onClick={() =>
                          void run(async () => {
                            await client.current!.call("source", {
                              text: source,
                              revision: sourceRevision,
                            });
                            setSelection(null);
                            await refresh();
                            await showSource();
                          })
                        }
                      >
                        Apply source
                      </button>
                    </div>
                  )}
                  <SourceEditor
                    value={source}
                    onChange={setSource}
                    target={sourceTarget}
                  />
                </>
              )}
              {mode === "review" && review && (
                <ReviewDiff before={review.before} after={review.after} />
              )}
            </section>
            {inspector && mode === "table" && (
              <aside className="inspector">
                <div className="pane-heading">
                  <h2>Selected value</h2>
                  <button
                    className="inspector-close"
                    aria-label="Close inspector"
                    onClick={() => setInspector(false)}
                  >
                    ×
                  </button>
                </div>
                {selection ? (
                  <>
                    <label>Path</label>
                    <code className="path">
                      {pointer(selection.cell.path) || "(root)"}
                    </code>
                    <label>JSON type</label>
                    <span className="type-label">{selection.cell.type}</span>
                    <label>Exact JSON</label>
                    <pre className="value-preview">
                      {selection.cell.type === "missing"
                        ? "Property is absent"
                        : selection.raw}
                    </pre>
                    <div className="inspector-actions">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => {
                          if (
                            activeCell &&
                            (selection.cell.type === "null" ||
                              selection.cell.type === "missing")
                          )
                            void startInline(
                              selection.cell,
                              activeCell.row,
                              activeCell.column,
                            );
                          else void edit(selection.cell);
                        }}
                      >
                        Edit value
                      </button>
                      {selection.cell.container && (
                        <button
                          disabled={busy}
                          onClick={() => void navigate(selection.cell.path)}
                        >
                          Open table
                        </button>
                      )}
                      <button
                        disabled={busy || selection.cell.type === "missing"}
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(selection.raw)
                            .then(() => setNotice("Copied JSON value."))
                            .catch(() =>
                              setError("Clipboard access is unavailable."),
                            )
                        }
                      >
                        Copy JSON
                      </button>
                    </div>
                    {selection.cell.path.length > 0 &&
                      selection.cell.type !== "missing" && (
                        <div className="structural-actions">
                          {typeof selection.cell.path.at(-1) === "string" && (
                            <button
                              disabled={busy}
                              onClick={() => newEdit("rename")}
                            >
                              Rename key
                            </button>
                          )}
                          <button
                            className="danger"
                            disabled={busy}
                            onClick={() => newEdit("remove")}
                          >
                            Remove value…
                          </button>
                        </div>
                      )}
                    <p className="small">
                      Types are explicit. Sorting and filtering change only the
                      view.
                    </p>
                  </>
                ) : (
                  <div className="inspector-empty">
                    <span>{"{ }"}</span>
                    <p>Select a cell to see its path, type and exact value.</p>
                    <p className="small">
                      Enter edits a value.
                      <br />
                      Enter opens a nested table.
                      <br />
                      F2 edits a complete nested value.
                    </p>
                  </div>
                )}
              </aside>
            )}
          </main>
          <nav className="sheet-tabs" aria-label="Document sheets">
            <button
              aria-current={query.path.length === 0 ? "page" : undefined}
              disabled={busy || sourceDirty}
              onClick={() => void navigate([])}
            >
              {view?.rootKind === "object" ? "All data" : "Root"}
            </button>
            {sheets.map((sheet) => (
              <button
                key={pointer(sheet.path)}
                aria-current={
                  sheet.path.every((part, i) => query.path[i] === part)
                    ? "page"
                    : undefined
                }
                disabled={busy || sourceDirty}
                onClick={() => void navigate(sheet.path)}
              >
                {sheet.label || "(empty key)"}
              </button>
            ))}
            {truncatedSheets && (
              <span>First 200 sheets shown; use All data for all entries.</span>
            )}
          </nav>
          <footer className="status" aria-live="polite">
            {inline?.error && (
              <span id="cell-error" role="alert" className="cell-error">
                {inline.error}
              </span>
            )}
            <span>
              {operationBusy
                ? "Working…"
                : inline
                  ? "Editing cell"
                  : view?.diagnostics.length
                    ? "JSON needs repair"
                    : "✓ Valid JSON"}
            </span>
            <span>{dirty ? "Unsaved changes" : "Unmodified"}</span>
            <div className="spacer" />
            <span>
              {view ? new Intl.NumberFormat().format(view.bytes) : 0} bytes
            </span>
            <span>UTF-8</span>
            <span>{desktop ? "Desktop" : "Web client"}</span>
            {desktop && (
              <label>
                <input
                  type="checkbox"
                  checked={recoveryEnabled}
                  onChange={(e) => setRecoveryEnabled(e.target.checked)}
                />{" "}
                Local recovery
              </label>
            )}
          </footer>
        </>
      )}
      {discardPrompt && (
        <div className="modal-backdrop">
          <section
            className="edit-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-title"
          >
            <h2 id="discard-title">Unsaved changes</h2>
            <p>{discardContext}</p>
            <div className="dialog-actions">
              <button className="danger" onClick={() => answerDiscard(true)}>
                Discard changes
              </button>
              <button
                autoFocus
                className="primary"
                onClick={() => answerDiscard(false)}
              >
                Keep editing
              </button>
            </div>
          </section>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop">
          <section
            className="edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
          >
            <h2 id="edit-title">
              {editing.action === "remove"
                ? "Remove value?"
                : editing.action === "rename"
                  ? "Rename property"
                  : editing.action === "insert"
                    ? "Add value"
                    : "Edit value"}
            </h2>
            <code className="path">{pointer(editing.path) || "(root)"}</code>
            {editing.action === "remove" ? (
              <p>
                This removes the selected property or array item. You can undo
                it before closing the document.
              </p>
            ) : (
              <>
                {(editing.action === "rename" ||
                  (editing.action === "insert" &&
                    editing.parentKind === "object")) && (
                  <label>
                    Property key
                    <input
                      autoFocus
                      value={editing.key}
                      onChange={(e) =>
                        setEditing({ ...editing, key: e.target.value })
                      }
                    />
                  </label>
                )}
                {editing.action !== "rename" && (
                  <>
                    <label>
                      JSON type
                      <select
                        value={editing.kind}
                        onChange={(e) => {
                          const kind = e.target.value as Kind;
                          setEditing({
                            ...editing,
                            kind,
                            value:
                              kind === "string"
                                ? ""
                                : kind === "number"
                                  ? "0"
                                  : kind === "boolean"
                                    ? "false"
                                    : kind === "null"
                                      ? "null"
                                      : kind === "array"
                                        ? "[]"
                                        : "{}",
                          });
                        }}
                      >
                        {[
                          "string",
                          "number",
                          "boolean",
                          "null",
                          "object",
                          "array",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {editing.kind === "string"
                        ? "String value (without JSON quotes)"
                        : "JSON value"}
                      <textarea
                        autoFocus={editing.action === "replace"}
                        rows={
                          editing.kind === "object" || editing.kind === "array"
                            ? 10
                            : 4
                        }
                        value={editing.value}
                        disabled={editing.kind === "null"}
                        onChange={(e) =>
                          setEditing({ ...editing, value: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                            void applyEdit();
                        }}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            {editError && (
              <p className="edit-error" role="alert">
                {editError}
              </p>
            )}
            <div className="dialog-actions">
              <button disabled={busy} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                disabled={busy}
                className={editing.action === "remove" ? "danger" : "primary"}
                onClick={() => void applyEdit()}
              >
                {editing.action === "remove" ? "Remove" : "Apply change"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
