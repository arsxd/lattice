import { SourceFormatButton } from "./editor/SourceFormatButton";
import { FileLocation } from "./workspace/FileLocation";
import { ActiveFilters, columnFilterSummaries } from "./grid/ActiveFilters";
import { FindBar } from "./grid/FindBar";
import { ThemePicker } from "./ThemePicker";
import { FindHighlight } from "./grid/FindHighlight";
import { JsonPreview } from "./grid/JsonPreview";
import { CellPreview } from "./grid/CellPreview";
import { columnLetter } from "./grid/columnAddress";
import { ColumnMenuChevron } from "./grid/SheetIcons";
import { FileDropZone, type DroppedFile } from "./workspace/FileDropZone";
import { droppedJsonFile } from "./platform/files";
import { validateSourceDraft } from "./editor/sourceValidation";
import type { Diagnostic } from "./document/engine";
import { JsonProblem } from "./editor/JsonProblem";
import { HomeScreen } from "./HomeScreen";
import { contentColumnWidths, createTextMeasurer } from "./grid/columnSizing";
import { compactJson } from "./document/compactJson";
import {
  applyScopedDraft,
  scopedSourceText,
  scopedSelectionRange,
  type SourceScope,
} from "./editor/sourceScope";
import { FreezeMenu } from "./grid/FreezeMenu";
import { frozenRowLayout, frozenRowRenderers } from "./grid/FrozenGrid";
import { BrowserRecovery } from "./workspace/browserRecovery";
import {
  captureReloadPosition,
  remapReloadQuery,
  restoreReloadSelection,
} from "./workspace/reloadPosition";
import { PaneResizeHandle, usePaneWidth } from "./grid/PaneResizeHandle";
import {
  selectCell,
  selectWholeTable,
  selectHeader,
  axisSelected,
  selectedCellCount,
  type SheetSelection,
} from "./document/sheetSelection";
import { columnLabel } from "./grid/columnRoles";
import { NavigationIcon } from "./NavigationIcon";
import {
  blankState,
  wrappedHeight,
  DEFAULT_LINE_LIMITS,
  valueBarPresentation,
  jsonSelectionPreview,
  JSON_PREVIEW_LIMIT,
} from "./grid/cellPresentation";
import { DocumentOutline } from "./grid/DocumentOutline";
import { recordNavigation, type NavigationHistory } from "./navigation";
import { RowHeightHandle } from "./grid/RowHeightHandle";
import { ValueDetails } from "./editor/ValueDetails";
import { useOfflineApp } from "./useOfflineApp";
import { ColumnMenu } from "./grid/ColumnMenu";
import { ValueBar, ValueBarPlaceholder } from "./editor/ValueBar";
import { SheetRange } from "./grid/SheetRange";
import ReviewDiff from "./editor/ReviewDiff";
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
  type Opened,
} from "./platform/files";
import { describeFileError, type FileAction } from "./platform/fileErrors";
import { InlineError } from "./grid/InlineError";
import { SourceEditor } from "./editor/SourceEditor";
import {
  cellInputKind,
  valueBarRaw,
  cellEntryText,
  gridStringDraft,
} from "./editor/scalar";
import {
  packRecovery,
  unpackRecovery,
  type RecoveryDocument,
} from "./workspace/recovery";
import { sample } from "./sample";
import "react-data-grid/lib/styles.css";
import "./style.css";
import "./workspace.css";
import "./editor/valueBar.css";
function originalIndexPreference() {
  try {
    return localStorage.getItem("lattice-show-index") === "true";
  } catch {
    return false;
  }
}
const initialQuery: Query = {
  path: [],
  records: true,
  search: "",
  page: 0,
  showIndex: originalIndexPreference(),
};
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
  sheetSelection: SheetSelection | null;
  mode: "table" | "source" | "review";
  source: string;
  sourceBase: string;
  sourceRevision: number;
  sourceScope: SourceScope | null;
  reviewOrigin: "table" | "source";
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
  /** The text the editor opened with; committing it unchanged writes nothing. */
  original?: string;
  row: number;
  column: number;
  error: string;
};
const singleCell = (selection: SheetSelection | null) =>
  selection?.mode === "cells" &&
  selection.anchor.r === selection.end.r &&
  selection.anchor.c === selection.end.c;
export default function App() {
  const [sourceWrapLines, setSourceWrapLines] = useState(false);
  const [hasSourceLocation, setHasSourceLocation] = useState(false);
  const sourceLocate = useRef<(() => void) | null>(null);
  const [formattingSource, setFormattingSource] = useState(false);
  const sourceFormatter = useRef<
    ((action: "pretty" | "compact" | "minify") => Promise<void>) | null
  >(null);
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
  const [recoveryReady, setRecoveryReady] = useState(false);
  const browserRecovery = useRef<BrowserRecovery | null>(null);
  const recoveredIds = useRef<string[]>([]);
  const [recovered, setRecovered] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [recoveryEnabled, setRecoveryEnabled] = useState(
    localStorage.getItem("lattice-browser-recovery") === "on",
  );
  const client = useRef<DocumentClient | null>(null);
  const request = useRef(0);
  const selectionRequest = useRef(0);
  const pendingSelection = useRef<string | null>(null);
  const busyRef = useRef(false);
  const [doc, setDoc] = useState<Opened | null>(null);
  const [view, setView] = useState<Projection | null>(null);
  const [query, setQuery] = useState<Query>(initialQuery);
  const [findDraft, setFindDraft] = useState(initialQuery.search);
  const [operationBusy, setBusy] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  // The latest view and selection, for async code that outlives a render.
  const shown = useRef<{
    view: Projection | null;
    sheetSelection: SheetSelection | null;
  }>({ view: null, sheetSelection: null });
  const [columnName, setColumnName] = useState<string | null>(null);
  const [columnError, setColumnError] = useState("");
  const [inline, setInline] = useState<InlineEdit | null>(null);
  const busy = operationBusy;
  const committingCell = useRef(false);
  const inlineInput = useRef<HTMLTextAreaElement>(null);
  const valueBarCommit = useRef<(() => Promise<boolean>) | null>(null);
  const valueBarHasChanges = useRef<() => boolean>(() => false);
  const suppressBlur = useRef(false);
  const suppressPointerClick = useRef(false);
  const replayingClick = useRef(false);
  const grid = useRef<DataGridHandle>(null);
  const [freezeSettings, setFreezeSettings] = useState<
    Record<string, { rows: number; columns: number }>
  >({});
  const [gridSize, setGridSize] = useState({ width: 900, height: 400 });
  const [wrapText, setWrapText] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const textMeasure = useMemo(createTextMeasurer, []);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const sessions = useRef(new Map<string, Session>());
  const navigationHistory = useRef(new Map<string, NavigationHistory>());
  const sourceTableScroll = useRef(
    new Map<string, { top: number; left: number }>(),
  );
  const [activeId, setActiveId] = useState("");
  const tableHeightKey = `${activeId}:${pointer(query.path)}:${query.showIndex !== false}:${!!query.records}`;
  const heightKey = (row: Row) => `${tableHeightKey}:${row.id}`;
  const automaticWidths = useMemo(
    () => (view ? contentColumnWidths(view, gridSize.width, textMeasure) : []),
    [view, gridSize.width, textMeasure],
  );
  const columnWidth = (index: number) =>
    columnWidths[`${tableHeightKey}:${index}`] ?? automaticWidths[index] ?? 100;
  // Wrapped cells can show more than the default 240-character preview.
  const previewCharsFor = (wrap: boolean) => (wrap ? 4096 : undefined);
  useEffect(() => {
    const want = previewCharsFor(wrapText);
    for (const s of sessions.current.values()) s.client.previewChars = want;
    if (client.current && client.current.previewChars !== want)
      client.current.previewChars = want;
    if (view && mode === "table") void run(async () => void (await refresh()));
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- refresh only when Wrap text changes
  }, [wrapText]);
  const automaticHeights = useMemo(() => {
    if (!wrapText || !view) return new Map<string, number>();
    // With few rows there is room to show more of each value: let rows grow to
    // share the viewport, but never below the usual limits.
    const share = Math.floor((gridSize.height - 64) / (view.rows.length || 1));
    const fits = Math.min(40, Math.max(0, Math.floor((share - 28) / 20) + 1));
    const limits = {
      plain: Math.max(DEFAULT_LINE_LIMITS.plain, fits),
      nested: Math.max(DEFAULT_LINE_LIMITS.nested, fits),
    };
    return new Map(
      view.rows.map((row) => [
        row.id,
        wrappedHeight(
          row.cells.map((cell, i) => ({
            text:
              (view.recordsAvailable && query.records
                ? i > 0
                : i === view.headers.length - 1) && blankState(cell)
                ? ""
                : cell.display,
            width: columnWidth(i),
            nested: cell.container || cell.type === "array",
          })),
          textMeasure,
          limits,
        ),
      ]),
    );
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- columnWidth() reads the width state listed here
  }, [
    view,
    gridSize.height,
    wrapText,
    columnWidths,
    tableHeightKey,
    automaticWidths,
    query.records,
    textMeasure,
  ]);
  const rowHeight = (row: Row) => {
    const saved =
      rowHeights[heightKey(row)] ?? automaticHeights.get(row.id) ?? 28;
    if (!inline || view?.rows[inline.row]?.id !== row.id) return saved;
    // One line fits the row as it is; only extra lines make it taller.
    const lines = inline.value.split(/\r\n|\r|\n/).length;
    return Math.max(
      saved,
      lines > 1 ? 28 + (Math.min(lines, 8) - 1) * 20 + 12 : 28,
      wrapText
        ? wrappedHeight(
            [
              {
                text: inline.value.slice(0, 4096),
                width: columnWidth(inline.column),
              },
            ],
            textMeasure,
          )
        : 0,
    );
  };
  function resizeRow(row: Row, height?: number) {
    const key = heightKey(row);
    setRowHeights((previous) => {
      const next = { ...previous };
      if (height === undefined) delete next[key];
      else next[key] = height;
      return next;
    });
  }

  const frozen = freezeSettings[tableHeightKey] ?? { rows: 0, columns: 0 };
  const headerHeight = view?.headers.some(
    (_, i) => columnLabel(view, i).length * 7 > columnWidth(i) - 42,
  )
    ? 64
    : 48;
  const frozenLayout = frozenRowLayout({
    rowHeights: view?.rows.map(rowHeight) ?? [],
    columnCount: (view?.headers.length ?? 0) + 1,
    frozenCount: Math.min(frozen.rows, view?.rows.length ?? 0),
    headerHeight,
    viewportHeight: gridSize.height,
  });
  const frozenRenderers = useMemo(
    () => frozenRowRenderers<Row>(frozenLayout),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- frozenLayout is a new object every render; its JSON is the key
    [JSON.stringify(frozenLayout)],
  );
  const frozenWidth =
    44 +
    Array.from(
      { length: Math.min(frozen.columns, view?.headers.length ?? 0) },
      (_, i) => columnWidth(i),
    ).reduce((sum, width) => sum + width, 0);
  const columnsFrozen =
    frozenWidth <= gridSize.width * 0.6 ? frozen.columns : 0;
  const freezePaused = !frozenLayout.allowed
    ? frozenLayout.reason
    : frozen.columns && !columnsFrozen
      ? "Frozen columns must leave at least 40% of the table available for scrolling."
      : undefined;
  function changeFreeze(value: { rows: number; columns: number }) {
    const layout = frozenRowLayout({
      rowHeights: view?.rows.map(rowHeight) ?? [],
      columnCount: (view?.headers.length ?? 0) + 1,
      frozenCount: value.rows,
      headerHeight,
      viewportHeight: gridSize.height,
    });
    if (!layout.allowed) {
      setNotice(layout.reason ?? "This row freeze is unavailable.");
      return;
    }
    const width =
      44 +
      Array.from({ length: value.columns }, (_, i) => columnWidth(i)).reduce(
        (sum, w) => sum + w,
        0,
      );
    if (value.columns && width > gridSize.width * 0.6) {
      setNotice("Freeze fewer columns to leave room for scrolling.");
      return;
    }
    setFreezeSettings((previous) => ({ ...previous, [tableHeightKey]: value }));
  }
  const [tabVersion, setTabVersion] = useState(0);
  const [sheets, setSheets] = useState<Projection["children"]>([]);
  // Overlay scrollbars (macOS trackpads) float over the sheet tabs instead of
  // taking space below them, so the strip reserves room when it overflows.
  const sheetStrip = useRef<HTMLElement>(null);
  const [overlayTabBar, setOverlayTabBar] = useState(false);
  useEffect(() => {
    const strip = sheetStrip.current;
    if (!strip) return;
    const measure = () => {
      const border = parseFloat(getComputedStyle(strip).borderTopWidth) || 0;
      const bar = strip.offsetHeight - strip.clientHeight - border;
      setOverlayTabBar(strip.scrollWidth > strip.clientWidth + 1 && bar < 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    return () => observer.disconnect();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- measure again when the document or its sheet list changes
  }, [doc, sheets]);
  const [truncatedSheets, setTruncatedSheets] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (notice !== "File reloaded.") return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const [sheetSelection, setSheetSelection] = useState<SheetSelection | null>(
    null,
  );
  shown.current = { view: view ?? null, sheetSelection };
  const singleCellSelected =
    sheetSelection?.mode === "cells" &&
    sheetSelection.anchor.r === sheetSelection.end.r &&
    sheetSelection.anchor.c === sheetSelection.end.c;
  const singleColumn =
    sheetSelection?.mode === "columns" &&
    sheetSelection.spans.length === 1 &&
    sheetSelection.spans[0][0] === sheetSelection.spans[0][1]
      ? sheetSelection.spans[0][0]
      : null;
  const selectedPoint = sheetSelection?.anchor;
  const activeCell =
    selectedPoint &&
    view &&
    selectedPoint.r >= view.page * 500 &&
    selectedPoint.r < view.page * 500 + view.rows.length
      ? { row: selectedPoint.r - view.page * 500, column: selectedPoint.c }
      : null;
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(
    null,
  );
  const [headerMenu, setHeaderMenu] = useState<number | null>(null);
  useEffect(() => {
    setSheetSelection(null);
    setHeaderMenu(null);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- reset only when the tab or table path changes
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
  const [source, setSource] = useState("");
  const [sourceBase, setSourceBase] = useState("");
  const [sourceRevision, setSourceRevision] = useState(0);
  const [sourceScope, setSourceScope] = useState<SourceScope | null>(null);
  const [reviewOrigin, setReviewOrigin] = useState<"table" | "source">("table");
  const [review, setReview] = useState<{
    before: string;
    after: string;
  } | null>(null);
  useEffect(() => {
    const element = grid.current?.element;
    if (!element) return;
    const measure = () => {
      if (element.clientWidth > 0 && element.clientHeight > 0)
        setGridSize({
          width: element.clientWidth,
          height: element.clientHeight,
        });
    };
    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(element);
    return () => observer.disconnect();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- re-measure only when a view appears or disappears
  }, [mode, tableHeightKey, !!view]);
  const [theme, setTheme] = useState(
    localStorage.getItem("json-workbench-theme") ?? "light",
  );
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const dark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const [leftWidth, setLeftWidth] = usePaneWidth("browse", 240);
  const [rightWidth, setRightWidth] = usePaneWidth("details", 360);
  const [inspector, setInspector] = useState(false);
  const [outlineVisible, setOutlineVisible] = useState(false);
  useEffect(() => {
    setFindDraft(query.search);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- stable key for the path array
  }, [activeId, JSON.stringify(query.path), query.search]);
  useEffect(() => {
    if (mode !== "table" || busy || findDraft === query.search) return;
    const timer = setTimeout(
      () =>
        changeQuery({
          ...query,
          search: findDraft,
          searchResult: undefined,
          page: 0,
        }),
      150,
    );
    return () => clearTimeout(timer);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- changeQuery is recreated every render; query is already listed
  }, [findDraft, query, mode, busy]);
  useEffect(() => {
    if (mode !== "table" || inline || busy) return;
    if (!activeCell || !singleCellSelected) {
      ++selectionRequest.current;
      setSelection(null);
      return;
    }
    const cell = view?.rows[activeCell.row]?.cells[activeCell.column];
    if (cell) void select(cell);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- select is recreated every render; activeCell is tracked by row and column
  }, [
    activeCell?.row,
    activeCell?.column,
    singleCellSelected,
    view,
    mode,
    inline,
    busy,
  ]);
  const sourceDirty =
    (mode === "source" || mode === "review") && source !== sourceBase;
  const [sourceValidation, setSourceValidation] = useState<{
    id: string;
    text: string;
    diagnostics: Diagnostic[];
  } | null>(null);
  const latestSourceDraft = useRef({ id: activeId, text: source });
  latestSourceDraft.current = { id: activeId, text: source };
  const displayedDiagnostics =
    mode === "source" && sourceDirty
      ? sourceValidation?.id === activeId && sourceValidation.text === source
        ? sourceValidation.diagnostics
        : []
      : (view?.diagnostics ?? []);
  const dirty = !!view?.dirty || sourceDirty;
  const anyDirty =
    dirty ||
    !!inline ||
    [...sessions.current.values()].some(
      (s) => s.id !== activeId && sessionDirty(s),
    );
  const { installPrompt, updateStatus } = useOfflineApp(
    sessions.current.size === 0 && !operationBusy && !anyDirty,
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
      sheetSelection,
      mode,
      source,
      sourceBase,
      sourceRevision,
      sourceScope,
      reviewOrigin,
      review,
      sheets,
      truncatedSheets,
    };
  }
  // File preparation can outlast source typing; save the latest rendered draft.
  const currentSnapshot = useRef<Session | null>(null);
  currentSnapshot.current = snapshot();
  function remember() {
    const current = currentSnapshot.current;
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
    setFindDraft(s.query.search);
    setSelection(s.selection);
    setSheetSelection(s.sheetSelection);
    setHeaderMenu(null);
    setFilterAnchor(null);
    setAddedColumn(null);
    setMode(s.mode);
    setSource(s.source);
    setSourceBase(s.sourceBase);
    setSourceRevision(s.sourceRevision);
    setSourceScope(s.sourceScope);
    setReviewOrigin(s.reviewOrigin);
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
      target.client.dispose();
      sessions.current.delete(id);
      navigationHistory.current.delete(id);
      sourceTableScroll.current.delete(id);
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
  async function run(fn: () => Promise<void>, action: FileAction = "open") {
    if (busyRef.current) return;
    progress(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(describeFileError(e, action));
    } finally {
      progress(false);
    }
  }
  async function refresh(q = query) {
    if (!client.current) return;
    const id = ++request.current;
    const p = await client.current.call<Projection>("project", q);
    if (id !== request.current) return;
    const before = shown.current;
    if (before.view && p.revision !== before.view.revision)
      setSheetSelection(null);
    else if (before.view && singleCell(before.sheetSelection)) {
      // A cell clicked while rows were being replaced still carries its old row
      // number; follow it by row identity or drop it, never land on another row.
      const old = before.view;
      const anchor = before.sheetSelection!.anchor;
      const id = old.rows[anchor.r - old.page * 500]?.id;
      const found =
        id === undefined ? -1 : p.rows.findIndex((r) => r.id === id);
      const row = p.page * 500 + found;
      if (found < 0) setSheetSelection(null);
      else if (row !== anchor.r) {
        setSheetSelection(selectCell(null, { r: row, c: anchor.c }));
        // The grid draws its own outline from its active position.
        requestAnimationFrame(() =>
          grid.current?.setActivePosition(
            { idx: anchor.c + 1, rowIdx: found },
            { shouldFocus: false },
          ),
        );
      }
    }
    setView(p);
    setSheets(p.sheets ?? p.children);
    setTruncatedSheets(
      p.sheetsTruncated ?? (p.rootKind === "object" && p.truncatedChildren),
    );
    if (p.diagnostics.length && mode === "table") await showSource();
    return p;
  }
  async function prepare(
    opened: Opened,
    path: Path = [],
    recovered = false,
    showIndex = originalIndexPreference(),
  ): Promise<Session> {
    let next: DocumentClient | undefined;
    try {
      next = new DocumentClient();
      next.previewChars = previewCharsFor(wrapText);
      await next.call("open", { text: opened.text });
      if (recovered) await next.call("saved", { text: "\u0000recovered" });
      const q = { ...initialQuery, path, showIndex };
      const p = await next.call<Projection>("project", q);
      if (!path.length && p.rootKind === "object" && !p.recordsAvailable) {
        q.records = false;
      }
      return {
        id: crypto.randomUUID(),
        client: next,
        doc: recovered
          ? { ...opened, text: "", reviewUnavailable: true }
          : opened,
        view: p,
        query: q,
        selection: null,
        sheetSelection: null,
        mode: p.diagnostics.length ? "source" : "table",
        source: opened.text,
        sourceBase: opened.text,
        sourceRevision: p.revision,
        sourceScope: null,
        reviewOrigin: "table",
        review: null,
        sheets: p.sheets ?? p.children,
        truncatedSheets:
          p.sheetsTruncated ?? (p.rootKind === "object" && p.truncatedChildren),
      };
    } catch (e) {
      next?.dispose();
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
  async function runOpening(action: () => Promise<void>) {
    await run(async () => {
      setOpeningFile(true);
      try {
        await action();
      } finally {
        setOpeningFile(false);
      }
    });
  }
  async function open() {
    await runOpening(async () => {
      const file = await openFile();
      if (file) await load(file);
    });
  }
  async function openDropped(files: DroppedFile[]) {
    await runOpening(async () => {
      const failures: string[] = [];
      const opened: Session[] = [];
      for (const item of files) {
        try {
          opened.push(
            await prepare(await droppedJsonFile(item.file, item.handle)),
          );
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (opened.length) {
        remember();
        for (const session of opened) sessions.current.set(session.id, session);
        activate(opened[opened.length - 1]);
        setTabVersion((value) => value + 1);
      }
      if (failures.length) setError(failures.slice(0, 3).join(" "));
    });
  }
  async function reloadSource() {
    if (!doc) return;
    await run(async () => {
      if (
        dirty &&
        !(await discard(
          "Reload the file and discard this document's unsaved changes? Other tabs stay open.",
        ))
      )
        return;
      const element = grid.current?.element;
      const scrollTop = element?.scrollTop ?? 0,
        scrollLeft = element?.scrollLeft ?? 0;
      let topIndex = 0,
        topOffset = 0;
      if (view)
        while (
          topIndex < view.rows.length - 1 &&
          topOffset + rowHeight(view.rows[topIndex]) <= scrollTop
        )
          topOffset += rowHeight(view.rows[topIndex++]);
      const topPath = view?.rows[topIndex]?.path;
      const position = view
        ? captureReloadPosition(
            view,
            sheetSelection,
            view.page * 500 + topIndex,
          )
        : null;
      const opened = await reloadFile(doc);
      if (!opened) return;
      const next = await prepare(opened, [], false, query.showIndex);
      let adopted = false;
      try {
        const path = [...query.path];
        while (path.length) {
          try {
            await next.client.call("raw", { path });
            break;
          } catch {
            path.pop();
          }
        }
        const projected = await next.client.call<Projection>("project", {
          ...query,
          path,
          page: 0,
        });
        next.query = view
          ? remapReloadQuery({ ...query, path }, view, projected)
          : { ...initialQuery, path };
        const located =
          position && JSON.stringify(path) === JSON.stringify(query.path)
            ? await next.client.call<{ row?: number; page: number }>(
                "locate-row",
                { query: next.query, path: position.rowPath },
              )
            : null;
        next.query.page =
          located?.row === undefined
            ? Math.min(query.page, projected.pages - 1)
            : located.page;
        next.view = await next.client.call<Projection>("project", next.query);
        const restoredSelection = restoreReloadSelection(
          position,
          next.view,
          located?.row,
        );
        // Stay in the view the user was working in; only Source needs restoring
        // because a freshly prepared session always opens as a table.
        if ((mode === "review" ? reviewOrigin : mode) === "source") {
          next.mode = "source";
          next.sourceScope =
            JSON.stringify(path) === JSON.stringify(query.path)
              ? sourceScope
              : null;
        }
        next.id = activeId;
        navigationHistory.current.delete(activeId);
        client.current?.dispose();
        sessions.current.set(activeId, next);
        activate(next);
        adopted = true;
        setSheetSelection(restoredSelection);
        setTabVersion((v) => v + 1);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const target = grid.current?.element;
            if (!target) return;
            const top = next.view.rows.findIndex(
              (row) => JSON.stringify(row.path) === JSON.stringify(topPath),
            );
            target.scrollLeft = scrollLeft;
            target.scrollTop =
              top >= 0
                ? next.view.rows
                    .slice(0, top)
                    .reduce((sum, row) => sum + rowHeight(row), 0) +
                  (scrollTop - topOffset)
                : next.query.page === query.page
                  ? scrollTop
                  : 0;
          }),
        );
        setNotice("File reloaded.");
      } finally {
        if (!adopted) {
          next.client.dispose();
        }
      }
    }, "reload");
  }
  async function save(as = false) {
    await run(async () => {
      if (!doc || !client.current || !view) return;
      if (sourceDirty)
        throw new Error("Apply or discard the editor draft before saving.");
      if (view.diagnostics.length)
        throw new Error("Repair the JSON errors before saving.");
      const target = await prepareBrowserSave(doc, as);
      if (!target) return;
      const { text } = await client.current.call<{
        text: string;
        revision: number;
      }>("text");
      const saved = await saveFile(target, text);
      if (saved) {
        if (saved.confirmed) {
          setDoc({ ...doc, ...saved, text, reviewUnavailable: false });
          if (mode === "review") setReview({ before: text, after: text });
          await client.current.call("saved", { text });
          await refresh();
          setNotice("Saved.");
        } else
          setNotice(
            "Download requested. Browser mode cannot confirm the file was saved. Unsaved state is retained.",
          );
      }
    }, "save");
  }
  async function navigate(path: Path, historyIndex?: number) {
    if (busyRef.current) return;
    setColumnName(null);
    await run(async () => {
      if (sourceDirty)
        throw new Error("Apply or discard the editor draft before navigating.");
      const history = navigationHistory.current.get(activeId);
      const previous =
        historyIndex === undefined ? undefined : history?.entries[historyIndex];
      let target = [...path];
      if (previous) {
        while (target.length) {
          try {
            await client.current!.call("locate", { path: target });
            break;
          } catch {
            target.pop();
          }
        }
      } else await client.current!.call("locate", { path: target });
      const q = previous
        ? { ...previous, path: target }
        : {
            ...query,
            path: target,
            filters: undefined,
            valueFilters: undefined,
            records: true,
            search: "",
            sort: undefined,
            page: 0,
          };
      await refresh(q);
      navigationHistory.current.set(
        activeId,
        recordNavigation(history, query, q, historyIndex),
      );
      ++selectionRequest.current;
      setSelection(null);
      setSheetSelection(null);
      setQuery(q);
      setMode("table");
      if (JSON.stringify(target) !== JSON.stringify(path))
        setNotice(
          "That location was removed. Opened its nearest available parent.",
        );
    });
  }
  function travel(direction: number) {
    const history = navigationHistory.current.get(activeId);
    if (!history) return;
    const index = history.index + direction;
    const entry = history.entries[index];
    if (entry) void navigate(entry.path, index);
  }
  async function showInSource(path: Path, property = false) {
    await run(async () => {
      if (sourceDirty)
        throw new Error(
          "Apply or discard the editor draft before locating a value.",
        );
      const target = await client.current!.call<{
        from: number;
        to: number;
        revision: number;
      }>("locate", { path, property });
      const scope = await showSource();
      const relative = scopedSelectionRange(target, scope ?? null);
      if (relative) setSourceTarget({ ...relative, id: Date.now() });
    });
  }
  async function showSource(
    path: Path = view?.diagnostics.length ? [] : (view?.path ?? query.path),
  ) {
    if (mode === "table" && grid.current?.element) {
      sourceTableScroll.current.set(activeId, {
        top: grid.current.element.scrollTop,
        left: grid.current.element.scrollLeft,
      });
    }
    setSourceTarget(null);
    if (!client.current) return null;
    const result = await client.current.call<{
      text: string;
      revision: number;
    }>("text");
    let scope: SourceScope | null = null;
    if (path.length) {
      try {
        const range = await client.current.call<{ from: number; to: number }>(
          "locate",
          { path },
        );
        scope = { path: [...path], from: range.from, to: range.to };
      } catch {
        scope = null;
      }
    }
    setSource(result.text);
    setSourceBase(result.text);
    setSourceRevision(result.revision);
    setSourceScope(scope);
    setMode("source");
    if (currentCell && currentCell.type !== "missing") {
      try {
        const range = await client.current.call<{ from: number; to: number }>(
          "locate",
          { path: currentCell.path, property: !!selectedIdentifier },
        );
        const relative = scopedSelectionRange(range, scope);
        if (relative) setSourceTarget({ ...relative, id: Date.now() });
      } catch {
        /* A removed value has no source location to mark. */
      }
    }
    return scope;
  }
  async function toggleReview() {
    await run(async () => {
      if (!client.current || !doc) return;
      if (mode === "review") {
        if (
          sourceDirty &&
          !(await discard(
            "Close Review and discard its unapplied draft? Committed table edits are kept.",
          ))
        )
          return;
        if (reviewOrigin === "source")
          await showSource(sourceScope?.path ?? []);
        else {
          const current = await client.current.call<{
            text: string;
            revision: number;
          }>("text");
          setSource(current.text);
          setSourceBase(current.text);
          setSourceRevision(current.revision);
          setMode("table");
        }
        return;
      }
      if (doc.reviewUnavailable) {
        setNotice(
          "Changes cannot be compared for this recovered draft because its original file was not stored. A confirmed save establishes a new comparison baseline.",
        );
        return;
      }
      if (sourceDirty)
        throw new Error(
          "Apply or discard the editor draft before reviewing changes.",
        );
      const current = await client.current.call<{
        text: string;
        revision: number;
      }>("text");
      setReviewOrigin(mode === "source" ? "source" : "table");
      setSource(current.text);
      setSourceBase(current.text);
      setSourceRevision(current.revision);
      setReview({ before: doc.text, after: current.text });
      setMode("review");
    });
  }
  async function history(action: "undo" | "redo") {
    await run(async () => {
      if (sourceDirty)
        throw new Error("Apply or discard the editor draft first.");
      await client.current?.call(action);
      setSelection(null);
      await refresh();
      if (mode === "source") await showSource(sourceScope?.path ?? []);
      if (mode === "review" && doc && client.current) {
        const current = await client.current.call<{
          text: string;
          revision: number;
        }>("text");
        setSource(current.text);
        setSourceBase(current.text);
        setSourceRevision(current.revision);
        setReview({ before: doc.text, after: current.text });
      }
    });
  }
  async function select(cell: Cell) {
    if (cell.writable === false) {
      ++selectionRequest.current;
      pendingSelection.current = null;
      setSelection(null);
      return;
    }
    if (busyRef.current || !view || !client.current) return;
    const key = JSON.stringify([
      activeId,
      view.revision,
      cell.path,
      cell.display,
    ]);
    if (pendingSelection.current === key) return;
    pendingSelection.current = key;
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
    } finally {
      if (pendingSelection.current === key) pendingSelection.current = null;
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
    const role = view?.columnKinds[index];
    return role === "field" || role === "value" || role === "mixed";
  }
  function keyEditable(column: number) {
    return view?.columnKinds[column] === "key";
  }
  async function toggleIndex() {
    if (!view || busyRef.current) return;
    await run(async () => {
      const showIndex = query.showIndex === false;
      const indexColumn = view.columnKinds.indexOf("index");
      if (
        !showIndex &&
        indexColumn >= 0 &&
        (query.sort?.column === indexColumn ||
          query.filters?.[String(indexColumn)] ||
          query.valueFilters?.[String(indexColumn)] !== undefined)
      ) {
        setNotice(
          "Clear the original index’s sort or filter before hiding it.",
        );
        return;
      }
      const next = { ...query, showIndex };
      const shape = await client.current!.call<Projection>("project", {
        ...next,
        sort: undefined,
        filters: undefined,
        valueFilters: undefined,
        optionsColumn: undefined,
      });
      const mapped = remapReloadQuery(next, view, shape);
      const layoutKey = `${activeId}:${pointer(query.path)}:${showIndex}`;
      setFreezeSettings((previous) => ({
        ...previous,
        [layoutKey]: {
          rows: frozen.rows,
          columns: frozen.columns
            ? Math.max(0, frozen.columns + (showIndex ? 1 : -1))
            : 0,
        },
      }));
      setQuery(mapped);
      setSelection(null);
      setSheetSelection(null);
      try {
        localStorage.setItem("lattice-show-index", String(showIndex));
      } catch {
        /* The view still works when preference storage is unavailable. */
      }
      await refresh(mapped);
    });
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
      original:
        initial === undefined ? String(cell.path.at(-1) ?? "") : undefined,
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
      if (!blank && valueBarPresentation(cell, raw).previewOnly) {
        setNotice(
          "This value is too large for inline editing. Use Source or Edit value for its complete contents.",
        );
        return;
      }
      const value =
        kind === "array" || kind === "object"
          ? compactJson(raw)
          : !blank && kind === "string"
            ? gridStringDraft(raw)
            : raw;
      setInline({
        cell,
        kind,
        selectAll: true,
        revision: view.revision,
        value,
        original: value,
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
  const [addedColumn, setAddedColumn] = useState<{
    table: string;
    name: string;
    row: number;
  } | null>(null);
  useEffect(() => {
    if (!addedColumn || !view || busy) return;
    if (addedColumn.table !== tableHeightKey) {
      setAddedColumn(null);
      return;
    }
    const column = view.headers.indexOf(addedColumn.name);
    if (column < 0) return;
    const row = Math.max(0, Math.min(addedColumn.row, view.rows.length - 1));
    const frame = requestAnimationFrame(() => {
      // Grid position zero is the row-number gutter, not the first JSON field.
      grid.current?.scrollToCell({ idx: column + 1, rowIdx: row });
      if (view.rows.length) {
        setSheetSelection(selectCell(null, { r: row, c: column }));
        grid.current?.setActivePosition(
          { rowIdx: row, idx: column + 1 },
          { shouldFocus: true },
        );
        void select(view.rows[row].cells[column]);
      }
      setAddedColumn(null);
    });
    return () => cancelAnimationFrame(frame);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- select is recreated every render
  }, [addedColumn, view, busy, tableHeightKey]);
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
        setAddedColumn({
          table: tableHeightKey,
          name: columnName,
          row: activeCell?.row ?? 0,
        });
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
            : cellEntryText(current.kind, current.value);
        // Leaving the editor as it opened must not rewrite the value: the
        // editor shows a compact form, and saving it would re-flow the file.
        const unchanged =
          current.original !== undefined && current.value === current.original;
        if (
          !unchanged &&
          !(
            current.cell.type === "missing" &&
            current.value === "" &&
            !current.rename
          )
        )
          await mutate(
            current.rename
              ? {
                  action: "rename",
                  path: current.cell.path,
                  key: current.value,
                }
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
  // Spreadsheet-style numbers: every table counts rows from 1 by position in
  // the current view. The zero-based JSON index stays in Details and in the
  // optional original-index column.
  function rowLabel(position: number): number {
    return (view?.page ?? 0) * 500 + position + 1;
  }
  const activeFilters = useMemo(
    () => columnFilterSummaries(query, view),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- columnFilterSummaries reads only filters and valueFilters
    [query.filters, query.valueFilters, view],
  );
  function clearColumnFilter(column?: number) {
    const filters = { ...query.filters };
    const valueFilters = { ...query.valueFilters };
    if (column !== undefined) {
      delete filters[String(column)];
      delete valueFilters[String(column)];
    }
    changeQuery({
      ...query,
      page: 0,
      searchResult: undefined,
      filters:
        column === undefined || !Object.keys(filters).length
          ? undefined
          : filters,
      valueFilters:
        column === undefined || !Object.keys(valueFilters).length
          ? undefined
          : valueFilters,
    });
  }
  // The memoized grid columns below keep closures until their dependencies
  // change. Event handlers go through this ref so they always see current state.
  const handlers = useRef({
    commitInline,
    save,
    cancelInline,
    navigate,
    resizeRow,
  });
  handlers.current = { commitInline, save, cancelInline, navigate, resizeRow };
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
              cellClass: (row) =>
                singleCellSelected &&
                activeCell &&
                view.rows[activeCell.row]?.id === row.id
                  ? "row-number active-cell-header"
                  : "row-number",
              renderHeaderCell: () => (
                <button
                  className="select-all-cells"
                  aria-label="Select all table cells"
                  title="Select all table cells"
                  disabled={busy}
                  onClick={() =>
                    setSheetSelection(
                      selectWholeTable(
                        view.matched,
                        view.headers.length,
                        view.page * 500,
                      ),
                    )
                  }
                ></button>
              ),
              renderCell: ({ rowIdx, row }) => (
                <div className="row-number-content">
                  <button
                    className="row-select"
                    aria-label={`Select row ${rowLabel(rowIdx)}`}
                    aria-pressed={axisSelected(
                      sheetSelection,
                      "rows",
                      view.page * 500 + rowIdx,
                    )}
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetSelection(
                        selectHeader(
                          sheetSelection,
                          "rows",
                          { r: view.page * 500 + rowIdx, c: 0 },
                          {
                            extend: e.shiftKey,
                            additive: e.ctrlKey || e.metaKey,
                          },
                        ),
                      );
                    }}
                  >
                    {rowLabel(rowIdx)}
                  </button>
                  <RowHeightHandle
                    number={rowLabel(rowIdx)}
                    height={rowHeight(row)}
                    onChange={(height) =>
                      handlers.current.resizeRow(row, height)
                    }
                    onReset={() => handlers.current.resizeRow(row)}
                  />
                </div>
              ),
            },
            ...view.headers.map<Column<Row>>((name, i) => ({
              key: String(i),
              name,
              headerCellClass: axisSelected(sheetSelection, "columns", i)
                ? "sheet-header sheet-header-selected"
                : singleCellSelected && activeCell?.column === i
                  ? "sheet-header active-cell-header"
                  : "sheet-header",
              frozen: i < columnsFrozen,
              renderHeaderCell: () => (
                // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut; keyboard uses the Select column button inside
                <div
                  className="sheet-column-heading"
                  onClick={(event) => {
                    if (
                      busy ||
                      (event.target as Element).closest(".header-filter")
                    )
                      return;
                    setSheetSelection(
                      selectHeader(
                        sheetSelection,
                        "columns",
                        { r: view.page * 500, c: i },
                        {
                          extend: event.shiftKey,
                          additive: event.ctrlKey || event.metaKey,
                        },
                      ),
                    );
                  }}
                >
                  <button
                    className="column-select"
                    data-column-select
                    aria-label={`Select column ${columnLetter(i)} ${columnLabel(view, i)}${view.columnKinds[i] === "mixed" ? " view" : ""}`}
                    aria-pressed={axisSelected(sheetSelection, "columns", i)}
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetSelection(
                        selectHeader(
                          sheetSelection,
                          "columns",
                          { r: view.page * 500, c: i },
                          {
                            extend: e.shiftKey,
                            additive: e.ctrlKey || e.metaKey,
                          },
                        ),
                      );
                    }}
                  >
                    <small>{columnLetter(i)}</small>{" "}
                    <span title={columnLabel(view, i)}>
                      {view.searchHeaderMatches?.includes(i) ? (
                        <FindHighlight
                          search={query.search}
                          caseSensitive={query.searchCaseSensitive}
                          wholeWord={query.searchWholeWord}
                          text={columnLabel(view, i)}
                        />
                      ) : (
                        columnLabel(view, i)
                      )}
                      {view.columnKinds[i] === "mixed" && (
                        <small
                          className="generated-column-tag"
                          title="Generated view column for non-object array items; not a JSON property"
                        >
                          view
                        </small>
                      )}
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
                  </button>
                  <button
                    className={`header-filter ${activeFilters.some((filter) => filter.column === i) ? "filter-active" : ""}`}
                    title={
                      activeFilters.find((filter) => filter.column === i)
                        ? `${columnLabel(view, i)}: ${activeFilters.find((filter) => filter.column === i)!.description}`
                        : `Sort and filter ${columnLabel(view, i)}`
                    }
                    // oxlint-disable-next-line jsx-a11y/role-supports-aria-props -- aria-description (ARIA 1.3) adds the filter summary; title carries it too
                    aria-description={
                      activeFilters.find((filter) => filter.column === i)
                        ?.description
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    disabled={operationBusy}
                    aria-expanded={headerMenu === i}
                    aria-label={`Sort and filter ${columnLabel(view, i)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterAnchor(e.currentTarget);
                      setHeaderMenu(headerMenu === i ? null : i);
                    }}
                  >
                    <ColumnMenuChevron
                      filtered={activeFilters.some(
                        (filter) => filter.column === i,
                      )}
                    />
                  </button>
                </div>
              ),
              width: columnWidth(i),
              minWidth: 80,
              resizable: true,
              sortable: false,
              cellClass: (row) =>
                valueColumn(i) && row.cells[i]?.type === "missing"
                  ? "missing-property-cell"
                  : undefined,
              renderCell: ({ row, rowIdx }) => {
                if (inline && inline.row === rowIdx && inline.column === i)
                  return (
                    <textarea
                      ref={inlineInput}
                      rows={1}
                      wrap={wrapText ? "soft" : "off"}
                      title='Enter to finish. Type "" for empty text; use quoted JSON for explicit strings. Alt+Enter adds a line.'
                      className="inline-cell"
                      aria-label={`Edit ${name} (${inline.kind})`}
                      aria-invalid={!!inline.error}
                      aria-describedby={inline.error ? "cell-error" : undefined}
                      // oxlint-disable-next-line jsx-a11y/no-autofocus -- in-cell editor must take focus when opened
                      autoFocus
                      value={inline.value}
                      onFocus={(e) => {
                        const input = e.currentTarget;
                        if (inline.selectAll) input.select();
                        else if (!inline.error) {
                          const end = input.value.length;
                          input.setSelectionRange(end, end);
                        }
                      }}
                      onBlur={(event) => {
                        if (event.relatedTarget?.id === "discard-inline-edit")
                          return;
                        if (!suppressBlur.current && !committingCell.current)
                          void handlers.current.commitInline();
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
                          void handlers.current.commitInline().then((ok) => {
                            if (ok) void handlers.current.save(e.shiftKey);
                          });
                          return;
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          handlers.current.cancelInline();
                        }
                        if (
                          e.key === "Enter" &&
                          e.altKey &&
                          inline.kind === "string"
                        ) {
                          e.preventDefault();
                          const start = e.currentTarget.selectionStart;
                          const end = e.currentTarget.selectionEnd;
                          setInline({
                            ...inline,
                            value:
                              inline.value.slice(0, start) +
                              "\n" +
                              inline.value.slice(end),
                            error: "",
                          });
                          requestAnimationFrame(() =>
                            inlineInput.current?.setSelectionRange(
                              start + 1,
                              start + 1,
                            ),
                          );
                          return;
                        }
                        if (e.key === "Tab" && !e.shiftKey && inline.error) {
                          const discard = document.getElementById(
                            "discard-inline-edit",
                          );
                          if (discard) {
                            e.preventDefault();
                            discard.focus();
                            return;
                          }
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          void handlers.current.commitInline(
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
                const originalIndex = view.columnKinds[i] === "index";
                const blank = valueColumn(i) ? blankState(c) : null;
                // Nested values get Source-style colours; plain values stay plain.
                const PreviewText =
                  !blank && (c.type === "array" || c.type === "object")
                    ? JsonPreview
                    : FindHighlight;
                return (
                  <CellPreview
                    className={`cell-value ${blank ? "empty-value" : ""} ${c.container && !originalIndex ? "container-value" : ""} ${c.type === "array" && !originalIndex ? "array-value" : ""} ${c.type === "number" ? "numeric" : ""}`}
                    onClick={
                      (c.container || c.type === "array") && !originalIndex
                        ? (event) => {
                            if (event.ctrlKey || event.metaKey) {
                              event.stopPropagation();
                              void handlers.current.navigate(c.path);
                            }
                          }
                        : undefined
                    }
                    title={
                      originalIndex
                        ? "Original array position (starting at zero). Open row from the right-click menu."
                        : c.type === "missing" && c.writable !== false
                          ? `Property absent — double-click or press F2 to add a value. ${pointer(c.path)}`
                          : `${blank ?? c.type} — ${pointer(c.path) || "root"}`
                    }
                    aria-label={
                      blank
                        ? `${blank} — ${pointer(c.path) || "root"}`
                        : undefined
                    }
                  >
                    <PreviewText
                      search={query.search}
                      caseSensitive={query.searchCaseSensitive}
                      wholeWord={query.searchWholeWord}
                      text={
                        blank
                          ? ""
                          : c.type === "array" &&
                              !c.container &&
                              singleCellSelected &&
                              activeCell?.row === rowIdx &&
                              activeCell.column === i &&
                              selectedPresentation
                            ? selectedPresentation.text
                            : c.display
                      }
                    />
                  </CellPreview>
                );
              },
            })),
          ]
        : [],
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- cells read derived state through helpers; handlers go through handlers.current
    [
      view,
      inline,
      operationBusy,
      query,
      headerMenu,
      rowHeights,
      columnWidths,
      automaticWidths,
      selection,
      automaticHeights,
      sheetSelection,
      wrapText,
      activeId,
      columnsFrozen,
    ],
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
    if (!browserRecovery.current)
      throw new Error("Local recovery storage is not ready.");
    await browserRecovery.current.write(
      text === undefined
        ? []
        : unpackRecovery({ name: packRecovery([]).name, text }),
    );
  }
  useEffect(() => {
    let cancelled = false;
    const storage = new BrowserRecovery();
    browserRecovery.current = storage;
    void (async () => {
      try {
        if (localStorage.getItem("lattice-browser-recovery") === "on") {
          const candidates = await storage.listRecoverable();
          if (!cancelled && candidates.length) {
            recoveredIds.current = candidates.map((item) => item.id);
            setRecovered(
              packRecovery(candidates.flatMap((item) => item.documents)),
            );
          }
        }
      } catch (error) {
        if (!cancelled)
          setError("Local recovery unavailable: " + String(error));
      } finally {
        if (!cancelled) setRecoveryReady(true);
      }
    })();
    const preference = (event: StorageEvent) => {
      if (event.key === "lattice-browser-recovery")
        setRecoveryEnabled(event.newValue === "on");
    };
    window.addEventListener("storage", preference);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", preference);
      browserRecovery.current?.close();
    };
  }, []);
  useEffect(() => {
    localStorage.setItem(
      "lattice-browser-recovery",
      recoveryEnabled ? "on" : "off",
    );
    if (!recoveryReady || operationBusy || recovered || !recoveryEnabled)
      return;
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- snapshot is recreated every render; the state it reads is listed
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- trap focus only while a dialog is open, not on every edit
  }, [!!editing, discardPrompt]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("json-workbench-theme", theme);
  }, [theme, dark]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (
        latest.current.dirty ||
        latest.current.busy ||
        client.current !== null
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => {
      window.removeEventListener("beforeunload", before);
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- dispose the sessions open at unmount, not those at mount
      for (const session of sessions.current.values()) session.client.dispose();
    };
  }, []);
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
        if (
          sourceDirty ||
          e.defaultPrevented ||
          (e.target instanceof Element &&
            e.target.closest(
              '.cm-editor, input, textarea, [contenteditable="true"]',
            ))
        )
          return;
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
  useEffect(() => {
    const target = view?.searchSelection;
    if (!view || !target || query.searchResult === undefined || busy) return;
    const row = target.row - view.page * 500;
    const frame = requestAnimationFrame(() => {
      grid.current?.scrollToCell({ idx: target.column + 1, rowIdx: row });
      grid.current?.setActivePosition(
        { idx: target.column + 1, rowIdx: row },
        { shouldFocus: false },
      );
      setSheetSelection(selectCell(null, { r: target.row, c: target.column }));
      if (view.rows[row]) void select(view.rows[row].cells[target.column]);
      setQuery((previous) => ({
        ...previous,
        page: view.page,
        searchResult: undefined,
      }));
    });
    return () => cancelAnimationFrame(frame);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- select is recreated every render
  }, [view, query.searchResult, busy]);
  const selectedIdentifier =
    activeCell &&
    (view?.columnKinds[activeCell.column] === "key" ||
      view?.columnKinds[activeCell.column] === "index")
      ? view.rows[activeCell.row]?.cells[activeCell.column]
      : undefined;
  const selectedKey =
    !!selectedIdentifier && !!activeCell && keyEditable(activeCell.column);
  const selectedPresentation = useMemo(
    () =>
      selection ? valueBarPresentation(selection.cell, selection.raw) : null,
    [selection],
  );
  const selectedJsonPreview = useMemo(
    () => (selection ? jsonSelectionPreview(selection.raw) : null),
    [selection],
  );
  const currentCell =
    singleCellSelected && activeCell && activeCell.column >= 0
      ? view?.rows[activeCell.row]?.cells[activeCell.column]
      : undefined;
  const selectedSourceValue =
    currentCell?.container && !selectedIdentifier ? currentCell : undefined;
  const sourceIsSelectedValue =
    !!sourceScope &&
    pointer(sourceScope.path) !== pointer(view?.path ?? query.path);
  function changeQuery(next: Query) {
    if (busyRef.current) return;
    ++selectionRequest.current;
    setSelection(null);
    const { page: _page, ...currentQuery } = query;
    const { page: _nextPage, ...nextQuery } = next;
    const onlyPage = JSON.stringify(currentQuery) === JSON.stringify(nextQuery);
    setSheetSelection((previous) =>
      onlyPage && previous?.mode === "columns"
        ? {
            ...previous,
            anchor: { ...previous.anchor, r: next.page * 500 },
            end: { ...previous.end, r: next.page * 500 },
          }
        : onlyPage
          ? previous
          : // A single cell is followed to its new row by refresh().
            singleCell(previous)
            ? previous
            : null,
    );
    setQuery(next);
    void run(async () => {
      await refresh(next);
    });
  }
  async function selectionMutation(
    action: "paste" | "fill",
    selected: SheetSelection,
    text?: string,
  ) {
    if (busyRef.current)
      throw new Error("Wait for the current operation to finish.");
    progress(true);
    try {
      await client.current!.call(action, {
        query,
        selection: selected,
        text,
        revision: view!.revision,
      });
      setSelection(null);
      setSheetSelection(null);
      await refresh();
    } finally {
      progress(false);
    }
  }
  async function toggleRecovery(enabled: boolean) {
    if (enabled && !navigator.locks)
      throw new Error(
        "Safe local recovery requires browser Web Locks support. Use current Chrome or Edge.",
      );
    setRecoveryEnabled(enabled);
    localStorage.setItem("lattice-browser-recovery", enabled ? "on" : "off");
    if (!enabled) {
      await browserRecovery.current?.clearAll();
      recoveredIds.current = [];
      setRecovered(null);
    }
  }
  const recoverySetting = (
    <label
      className="recovery-setting"
      title="Optional: store unsaved JSON drafts on this device. Turning off removes stored drafts; open documents remain unchanged."
    >
      <input
        type="checkbox"
        checked={recoveryEnabled}
        disabled={busy || !recoveryReady}
        onChange={(event) =>
          void run(() => toggleRecovery(event.target.checked))
        }
      />{" "}
      Local recovery
    </label>
  );
  const browsePaneStyle = {
    width: leftWidth,
    maxWidth:
      inspector && mode === "table"
        ? `calc(100vw - ${rightWidth + 365}px)`
        : "calc(100vw - 365px)",
  };
  const workspaceView = (
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
        if (mode !== "table") {
          suppressPointerClick.current = false;
          return;
        }
        const backgroundTarget = e.target instanceof Element ? e.target : null;
        if (backgroundTarget?.closest(".inline-error")) return;
        const blankSheet =
          backgroundTarget &&
          (backgroundTarget.matches(".workspace,.range-sheet,.data-grid") ||
            (backgroundTarget.closest(".range-sheet") &&
              !backgroundTarget.closest(
                '[role="gridcell"],[role="columnheader"],[role="rowheader"],button,input,textarea,select,[role="dialog"],.sheet-menu,[data-row-resizer]',
              )));
        if (
          e.button === 0 &&
          mode === "table" &&
          blankSheet &&
          !busyRef.current &&
          !committingCell.current
        ) {
          const clear = () => {
            ++selectionRequest.current;
            pendingSelection.current = null;
            setSheetSelection(null);
            setSelection(null);
            setHeaderMenu(null);
            if (
              document.activeElement instanceof HTMLElement &&
              document.activeElement.closest(".data-grid") &&
              !document.activeElement.matches(".inline-cell")
            )
              document.activeElement.blur();
          };
          if (
            document.activeElement?.closest(".value-bar") &&
            valueBarCommit.current
          ) {
            e.preventDefault();
            e.stopPropagation();
            suppressPointerClick.current = true;
            void valueBarCommit.current().then((ok) => {
              if (ok) clear();
            });
          } else if (inline) {
            e.preventDefault();
            e.stopPropagation();
            suppressPointerClick.current = true;
            void commitInline().then((ok) => {
              if (ok) clear();
            });
          } else clear();
          return;
        }
        if (
          e.button === 0 &&
          backgroundTarget &&
          !backgroundTarget.closest(".value-bar") &&
          valueBarHasChanges.current() &&
          valueBarCommit.current
        ) {
          const control = backgroundTarget.closest<HTMLElement>(
            "button,input,select,a[href],summary",
          );
          const cell =
            backgroundTarget.closest<HTMLElement>('[role="gridcell"]');
          if (control || cell) {
            const documentId = activeId;
            const row = cell?.closest('[role="row"]');
            const rowIndex = Number(row?.getAttribute("aria-rowindex")) - 2;
            const column = Number(cell?.getAttribute("aria-colindex")) - 2;
            const position =
              !control && view && rowIndex >= 0 && column >= 0
                ? captureReloadPosition(
                    view,
                    selectCell(null, {
                      r: view.page * 500 + rowIndex,
                      c: column,
                    }),
                  )
                : null;
            const modifiers = {
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              altKey: e.altKey,
            };
            e.preventDefault();
            e.stopPropagation();
            suppressPointerClick.current = true;
            void valueBarCommit.current().then((ok) => {
              if (!ok) return;
              requestAnimationFrame(() => {
                const latest = currentSnapshot.current;
                if (!latest || latest.id !== documentId) return;
                if (control?.isConnected) {
                  control.focus();
                  replayingClick.current = true;
                  try {
                    if (Object.values(modifiers).some(Boolean))
                      control.dispatchEvent(
                        new MouseEvent("click", {
                          bubbles: true,
                          cancelable: true,
                          ...modifiers,
                        }),
                      );
                    else control.click();
                  } finally {
                    replayingClick.current = false;
                  }
                } else if (position) {
                  const index = latest.view.rows.findIndex(
                    (row) =>
                      JSON.stringify(row.path) ===
                      JSON.stringify(position.rowPath),
                  );
                  const restored = restoreReloadSelection(
                    position,
                    latest.view,
                    index < 0 ? undefined : latest.view.page * 500 + index,
                  );
                  if (!restored) {
                    setSheetSelection(null);
                    setNotice(
                      "Value saved. The clicked row moved or is no longer visible; select it again.",
                    );
                    return;
                  }
                  const point = restored.anchor;
                  const target =
                    latest.view.rows[point.r - latest.view.page * 500]?.cells[
                      point.c
                    ];
                  if (
                    target &&
                    (modifiers.ctrlKey || modifiers.metaKey) &&
                    (target.container || target.type === "array")
                  ) {
                    void navigate(target.path);
                    return;
                  }
                  setSheetSelection(
                    selectCell(sheetSelection, point, modifiers.shiftKey),
                  );
                  grid.current?.setActivePosition(
                    {
                      rowIdx: point.r - latest.view.page * 500,
                      idx: point.c + 1,
                    },
                    { shouldFocus: true },
                  );
                  if (target) void select(target);
                }
              });
            });
            return;
          }
        }
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
        {operationBusy && (
          <span className="activity" role="status" aria-label="Working" />
        )}
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
          {browserSave ? "Save" : "Download"}
        </button>
        {browserSave && (
          <button
            onClick={() => void save(true)}
            disabled={busy || !doc || !!view?.diagnostics.length || sourceDirty}
          >
            Save as…
          </button>
        )}
        <span className="divider" />
        <button
          className="toolbar-history"
          aria-label="Undo"
          title="Undo (Ctrl/⌘+Z)"
          onClick={() => void history("undo")}
          disabled={busy || !view?.undo || sourceDirty}
        >
          <NavigationIcon name="undo" size={18} />
        </button>
        <button
          className="toolbar-history"
          aria-label="Redo"
          title="Redo (Ctrl/⌘+Shift+Z)"
          onClick={() => void history("redo")}
          disabled={busy || !view?.redo || sourceDirty}
        >
          <NavigationIcon name="redo" size={18} />
        </button>
        <div className="spacer" />
        <button
          disabled={busy || !doc}
          onClick={() => void reloadSource()}
          title={
            doc?.handle
              ? "Read the open JSON file again to pick up changes made outside Lattice."
              : "Choose the file again to reload it"
          }
        >
          {doc?.handle ? "Reload file" : "Reload file…"}
        </button>
        <ThemePicker value={theme} onChange={setTheme} />
      </header>
      {error && (
        <div className="message error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="notice-toast" role="status">
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
                  if (!browserRecovery.current)
                    throw new Error(
                      "Recovery storage is not ready. Original drafts have been retained.",
                    );
                  const existing = [...sessions.current.values()].filter(
                    (s) => s.id !== activeId,
                  );
                  const current = snapshot();
                  if (current) existing.push(current);
                  const documents: RecoveryDocument[] = [];
                  for (const session of [
                    ...existing.filter(sessionDirty),
                    ...restored,
                  ]) {
                    documents.push({
                      name: session.doc.name,
                      text:
                        session.source !== session.sourceBase
                          ? session.source
                          : (
                              await session.client.call<{ text: string }>(
                                "text",
                              )
                            ).text,
                    });
                  }
                  await browserRecovery.current.write(documents);
                } catch (e) {
                  restored.forEach((s) => s.client.dispose());
                  throw e;
                }
                remember();
                for (const s of restored) sessions.current.set(s.id, s);
                if (restored.length) activate(restored.at(-1)!);
                setTabVersion((v) => v + 1);
                const adopted = recoveredIds.current;
                recoveredIds.current = [];
                setRecovered(null);
                try {
                  await browserRecovery.current?.remove(adopted);
                } catch (error) {
                  setError(
                    "Drafts restored and checkpointed. Older recovery cleanup failed: " +
                      String(error),
                  );
                }
              })
            }
          >
            Restore draft
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await browserRecovery.current?.remove(recoveredIds.current);
                recoveredIds.current = [];
                setRecovered(null);
              })
            }
          >
            Discard recovered draft
          </button>
        </div>
      )}
      {openingFile && (
        <div className="file-opening-status" role="status">
          Opening JSON…
        </div>
      )}
      {!doc ? (
        <HomeScreen
          webClient
          busy={busy}
          onOpen={() => void open()}
          onNew={() =>
            void run(() => load({ name: "untitled.json", text: "{}\n" }))
          }
          onSample={() =>
            void run(() =>
              load({ name: "bookshop-workspace.json", text: sample }, [
                "books",
              ]),
            )
          }
          installPrompt={installPrompt}
          updateStatus={updateStatus}
          recoverySetting={recoverySetting}
        />
      ) : (
        <>
          <div className="document-tab">
            <div
              className={`browse-tab-slot ${outlineVisible ? "expanded" : ""}`}
              style={outlineVisible ? browsePaneStyle : undefined}
            >
              <button
                aria-pressed={outlineVisible}
                onClick={() => setOutlineVisible(!outlineVisible)}
              >
                <NavigationIcon name="browse" /> Browse
              </button>
            </div>
            <div className="document-tabs">
              {/* Explicit ownership keeps close controls outside the tablist. */}
              <div
                className="sr-only"
                role="tablist"
                aria-label="Open documents"
                aria-owns={[...sessions.current.keys()]
                  .map((id) => `document-tab-${id}`)
                  .join(" ")}
              />
              {[...sessions.current.values()].map((s) => (
                <div
                  className={`document-tab-item ${s.id === activeId ? "active" : ""}`}
                  key={s.id}
                >
                  <button
                    id={`document-tab-${s.id}`}
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
              disabled={
                busy ||
                (mode !== "review" &&
                  (sourceDirty || !!doc?.reviewUnavailable || !dirty))
              }
              aria-pressed={mode === "review"}
              onClick={() => void toggleReview()}
              title={
                mode === "review"
                  ? "Return to the previous view"
                  : doc?.reviewUnavailable
                    ? "Comparison unavailable: local recovery contains the draft but not the original file. A confirmed save establishes a new baseline."
                    : !dirty
                      ? "No changes to review yet"
                      : "Compare with the opened or saved version"
              }
            >
              {mode === "review" ? "Close review" : "Review changes"}
            </button>
            {mode === "table" && (
              <button
                aria-label="Details — toggle value inspector"
                aria-pressed={inspector}
                onClick={() => setInspector(!inspector)}
              >
                <NavigationIcon name="details" /> Details
              </button>
            )}
          </div>
          <main className="workspace">
            <aside
              className="outline"
              hidden={!outlineVisible}
              style={browsePaneStyle}
            >
              <div className="pane-label">Browse</div>
              <DocumentOutline
                key={activeId}
                current={query.path}
                revision={view?.revision ?? 0}
                rootKind={view?.rootKind ?? "object"}
                visible={outlineVisible}
                disabled={busy || sourceDirty}
                load={(path) => client.current!.call("outline", { path })}
                navigate={(path) => void navigate(path)}
              />
            </aside>
            {outlineVisible && (
              <PaneResizeHandle
                label="Browse"
                width={leftWidth}
                onChange={setLeftWidth}
                onReset={() => setLeftWidth(240)}
              />
            )}
            <section className="document">
              <div className="location">
                <div
                  className="location-history"
                  role="group"
                  aria-label="Table navigation"
                >
                  <button
                    aria-label="Back"
                    title="Back to previous table"
                    disabled={
                      busy ||
                      sourceDirty ||
                      !navigationHistory.current.get(activeId)?.index
                    }
                    onClick={() => travel(-1)}
                  >
                    <NavigationIcon name="back" />
                  </button>
                  <button
                    aria-label="Forward"
                    title="Forward to next table"
                    disabled={
                      busy ||
                      sourceDirty ||
                      !navigationHistory.current.get(activeId) ||
                      navigationHistory.current.get(activeId)!.index >=
                        navigationHistory.current.get(activeId)!.entries
                          .length -
                          1
                    }
                    onClick={() => travel(1)}
                  >
                    <NavigationIcon name="forward" />
                  </button>
                </div>
                <nav aria-label="JSON path">
                  <button
                    className="root-home"
                    aria-label="root"
                    title="Document root"
                    disabled={busy || sourceDirty}
                    onClick={() => void navigate([])}
                  >
                    <NavigationIcon name="home" />
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
                {mode === "source" &&
                  !sourceIsSelectedValue &&
                  hasSourceLocation && (
                    <button
                      className="source-cell-locator"
                      disabled={busy}
                      title={
                        activeCell && view?.rows[activeCell.row]
                          ? `Find ${columnLetter(activeCell.column)}${rowLabel(activeCell.row)} in source`
                          : "Find the selected cell in source"
                      }
                      onClick={() => sourceLocate.current?.()}
                    >
                      {activeCell && view?.rows[activeCell.row]
                        ? `Go to ${columnLetter(activeCell.column)}${rowLabel(activeCell.row)}`
                        : "Go to selected cell"}
                    </button>
                  )}
                {mode === "source" &&
                (view?.path.length || selectedSourceValue) ? (
                  <div
                    className="view-mode source-scope-switch"
                    title={
                      sourceDirty
                        ? "Apply or discard this draft before switching scope"
                        : "Source scope"
                    }
                    role="group"
                    aria-label="Source scope"
                  >
                    {!!view?.path.length && (
                      <button
                        aria-pressed={
                          !!sourceScope &&
                          pointer(sourceScope.path) ===
                            pointer(view?.path ?? [])
                        }
                        disabled={busy || sourceDirty}
                        onClick={() =>
                          void run(() => showSource(view.path).then(() => {}))
                        }
                      >
                        Current sheet
                      </button>
                    )}
                    {selectedSourceValue && (
                      <button
                        aria-pressed={
                          !!sourceScope &&
                          pointer(sourceScope.path) ===
                            pointer(selectedSourceValue.path)
                        }
                        disabled={busy || sourceDirty}
                        onClick={() =>
                          void run(() =>
                            showSource(selectedSourceValue.path).then(() => {}),
                          )
                        }
                      >
                        Selected value
                      </button>
                    )}
                    <button
                      aria-pressed={!sourceScope}
                      disabled={busy || sourceDirty}
                      onClick={() =>
                        void run(() => showSource([]).then(() => {}))
                      }
                    >
                      Whole document
                    </button>
                  </div>
                ) : null}
                {mode === "source" && formattingSource && (
                  <span className="source-format-status" role="status">
                    Formatting…
                  </span>
                )}
                {mode === "source" && (
                  <div
                    className="source-format-actions"
                    role="group"
                    aria-label="Source actions"
                  >
                    <button
                      aria-pressed={sourceWrapLines}
                      title="Wrap long source lines visually without changing the JSON"
                      onClick={() => setSourceWrapLines(!sourceWrapLines)}
                    >
                      Wrap lines
                    </button>
                    <div
                      className="source-format-options"
                      role="group"
                      aria-label="Format"
                    >
                      <div className="source-format-buttons">
                        {(
                          [
                            {
                              action: "pretty",
                              label: "Pretty-print",
                              description:
                                "Put properties and array items on separate lines.",
                            },
                            {
                              action: "compact",
                              label: "Compact",
                              description:
                                "Keep short objects and arrays inline.",
                            },
                            {
                              action: "minify",
                              label: "Minify",
                              description:
                                "Remove formatting whitespace outside strings.",
                            },
                          ] as const
                        ).map(({ action, label, description }) => (
                          <SourceFormatButton
                            key={action}
                            disabled={busy}
                            label={label}
                            description={description}
                            onClick={() =>
                              void run(async () => {
                                setFormattingSource(true);
                                try {
                                  await sourceFormatter.current?.(action);
                                } finally {
                                  setFormattingSource(false);
                                }
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="segmented">
                  {mode === "table" && query.sort && view && (
                    <div className="table-state-control active-sort">
                      <span
                        title={`Sorted by ${columnLabel(view, query.sort.column)} (${query.sort.direction === "ASC" ? "ascending" : "descending"})`}
                      >
                        Sort: {columnLabel(view, query.sort.column)}{" "}
                        {query.sort.direction === "ASC" ? "↑" : "↓"}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label="Clear sort"
                        title="Clear sort"
                        onClick={() =>
                          changeQuery({ ...query, sort: undefined, page: 0 })
                        }
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {mode === "table" && activeFilters.length > 0 && (
                    <ActiveFilters
                      filters={activeFilters}
                      disabled={busy}
                      onClear={clearColumnFilter}
                      onClearAll={() => clearColumnFilter()}
                    />
                  )}
                  <div
                    className="view-mode"
                    role="group"
                    aria-label="View mode"
                  >
                    <button
                      aria-pressed={mode === "table"}
                      disabled={
                        busy || sourceDirty || !!view?.diagnostics.length
                      }
                      onClick={() => {
                        const previous = activeCell;
                        setMode("table");
                        requestAnimationFrame(() => {
                          const scroll =
                            sourceTableScroll.current.get(activeId);
                          const element = grid.current?.element;
                          if (element && scroll) {
                            element.scrollTop = scroll.top;
                            element.scrollLeft = scroll.left;
                          }
                          if (
                            previous &&
                            view?.rows[previous.row]?.cells[previous.column]
                          )
                            focusCell(previous.row, previous.column);
                        });
                      }}
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
                      disabled={busy || mode === "source" || sourceDirty}
                      onClick={() => {
                        if (selectedSourceValue)
                          void run(async () => {
                            await showSource(selectedSourceValue.path);
                          });
                        else if (currentCell && currentCell.type !== "missing")
                          void showInSource(
                            currentCell.path,
                            !!selectedIdentifier,
                          );
                        else {
                          setSourceTarget(null);
                          void run(() => showSource().then(() => {}));
                        }
                      }}
                    >
                      Source
                    </button>
                  </div>
                </div>
              </div>
              {displayedDiagnostics.length > 0 && (
                <JsonProblem
                  text={mode === "source" ? source : sourceBase}
                  diagnostics={displayedDiagnostics}
                />
              )}
              {mode === "table" && view && (
                <>
                  {selection &&
                  activeCell &&
                  singleCellSelected &&
                  currentCell &&
                  pointer(selection.cell.path) === pointer(currentCell.path) ? (
                    <ValueBar
                      onCommitReady={(commit, hasChanges) => {
                        valueBarCommit.current = commit;
                        valueBarHasChanges.current =
                          hasChanges ?? (() => false);
                      }}
                      key={`${activeId}:${pointer(selection.cell.path)}`}
                      address={
                        activeCell &&
                        activeCell.row >= 0 &&
                        activeCell.column >= 0
                          ? `${columnLetter(activeCell.column)}${rowLabel(activeCell.row)}`
                          : ""
                      }
                      value={
                        selectedIdentifier
                          ? selectedIdentifier.display
                          : (selectedPresentation?.text ?? "")
                      }
                      placeholder={
                        !selectedIdentifier && selection.cell.type === "missing"
                          ? "Property absent. Type a value to add it."
                          : undefined
                      }
                      caption={
                        selectedIdentifier
                          ? selectedKey
                            ? "Key"
                            : "Index"
                          : undefined
                      }
                      previewOnly={
                        selectedIdentifier
                          ? false
                          : selectedPresentation?.previewOnly
                      }
                      onOpenTable={
                        !selectedIdentifier &&
                        (selection.cell.type === "object" ||
                          selection.cell.type === "array")
                          ? () => void navigate(selection.cell.path)
                          : undefined
                      }
                      editable={
                        !!selection &&
                        (selectedKey ||
                          (!!activeCell && valueColumn(activeCell.column))) &&
                        (selectedKey || !selectedPresentation?.previewOnly) &&
                        selection.cell.writable !== false
                      }
                      onCommit={async (value) => {
                        if (!selection) return;
                        const c = selection.cell;
                        if (selectedKey) {
                          await mutate(
                            { action: "rename", path: c.path, key: value },
                            selection.revision,
                          );
                          return;
                        }
                        const kind = cellInputKind(c);
                        const raw = valueBarRaw(kind, value);
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
                  ) : singleColumn !== null && view ? (
                    <ValueBarPlaceholder
                      address={columnLetter(singleColumn)}
                      value={columnLabel(view, singleColumn)}
                      caption="Column name"
                      hint="Right-click the column to rename it or copy its name."
                    />
                  ) : (
                    <ValueBarPlaceholder />
                  )}
                  <>
                    {headerMenu !== null && (
                      <ColumnMenu
                        key={`${pointer(query.path)}:${headerMenu}`}
                        anchor={filterAnchor}
                        name={columnLabel(view, headerMenu)}
                        selected={query.valueFilters?.[String(headerMenu)]}
                        load={async () => {
                          const p = await client.current!.call<Projection>(
                            "project",
                            {
                              ...query,
                              optionsColumn: headerMenu,
                              // Options are built from every row, so sorting and
                              // filtering them again here would only cost time.
                              sort: undefined,
                              filters: undefined,
                              valueFilters: undefined,
                              search: "",
                            },
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
                            // oxlint-disable-next-line jsx-a11y/no-autofocus -- dialog opens to type the column name
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
                    <SheetRange
                      isValueColumn={valueColumn}
                      showIndex={query.showIndex !== false}
                      onToggleIndex={() => void toggleIndex()}
                      onOpenRow={(path) => void navigate(path)}
                      view={view}
                      selection={sheetSelection}
                      onSelectionChange={setSheetSelection}
                      copy={(selected) =>
                        client.current!.call<string>("copy", {
                          query,
                          selection: selected,
                          revision: view.revision,
                        })
                      }
                      paste={(selected, text) =>
                        selectionMutation("paste", selected, text)
                      }
                      fill={(selected) => selectionMutation("fill", selected)}
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
                        key={tableHeightKey}
                        ref={grid}
                        className={`data-grid ${wrapText ? "wrap-text" : ""} ${sheetSelection ? "" : "without-selection"}`}
                        columns={columns}
                        rows={view.rows}
                        getRowKey={(r) => r.id}
                        rowHeight={rowHeight}
                        onColumnResize={(column, width) =>
                          setColumnWidths((previous) => ({
                            ...previous,
                            [`${tableHeightKey}:${column.key}`]: width,
                          }))
                        }
                        headerRowHeight={headerHeight}
                        renderers={frozenRenderers}
                        enableVirtualization={frozenLayout.enableVirtualization}
                        style={{
                          scrollPaddingTop:
                            headerHeight + frozenLayout.frozenHeight,
                        }}
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
                        onCellDoubleClick={({ row, rowIdx, column }) => {
                          if (
                            busy ||
                            Number(column.key) < 0 ||
                            view.columnKinds[Number(column.key)] === "index"
                          )
                            return;
                          const cell = row.cells[Number(column.key)];
                          if (
                            keyEditable(Number(column.key)) &&
                            (cell.container || cell.type === "array")
                          )
                            void navigate(cell.path);
                          else if (keyEditable(Number(column.key)))
                            startKey(cell, rowIdx);
                          else if (valueColumn(Number(column.key)))
                            void startInline(cell, rowIdx, Number(column.key));
                        }}
                        onCellKeyDown={(args, event) => {
                          if (busy) return;
                          if (
                            args.mode !== "ACTIVE" ||
                            !args.row ||
                            !args.column
                          )
                            return;
                          if (
                            Number(args.column.key) < 0 ||
                            view.columnKinds[Number(args.column.key)] ===
                              "index"
                          )
                            return;
                          const cell = args.row.cells[Number(args.column.key)];
                          if (
                            keyEditable(Number(args.column.key)) &&
                            (event.key === "F2" ||
                              (event.key === "Enter" &&
                                !cell.container &&
                                cell.type !== "array") ||
                              (event.key.length === 1 &&
                                !cell.container &&
                                cell.type !== "array" &&
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
                                focusCell(
                                  args.rowIdx,
                                  Number(args.column!.key),
                                );
                              });
                            return;
                          }
                          if (event.key === "Enter" || event.key === "F2") {
                            event.preventGridDefault();
                            event.preventDefault();
                            if (
                              (cell.type === "null" ||
                                cell.type === "missing") &&
                              valueColumn(Number(args.column.key))
                            )
                              void startInline(
                                cell,
                                args.rowIdx,
                                Number(args.column.key),
                              );
                            else if (
                              (cell.container ||
                                (keyEditable(Number(args.column.key)) &&
                                  cell.type === "array")) &&
                              event.key === "Enter"
                            )
                              void navigate(cell.path);
                            else if (cell.container)
                              void startInline(
                                cell,
                                args.rowIdx,
                                Number(args.column.key),
                              );
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
                          ? view.searchHeaderMatches?.length
                            ? "No cell contains this text. It matches a column name (highlighted). Clear the search to show all rows."
                            : "No matching rows. Clear the search to show all rows."
                          : "This container is empty. Add a property or item to begin."}
                      </div>
                    )}
                    <div className="pagination">
                      <div className="table-actions">
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
                              {view.kind === "object"
                                ? "Add property"
                                : "Add item"}
                            </button>
                          )
                        )}
                      </div>

                      <button
                        aria-pressed={wrapText}
                        onClick={() => setWrapText(!wrapText)}
                        title="Wrap long or multiline values. Short rows stay compact. Drag a row number’s bottom edge to adjust height."
                      >
                        Wrap text
                      </button>
                      <FreezeMenu
                        rows={frozen.rows}
                        columns={frozen.columns}
                        selection={activeCell}
                        rangeSelection={sheetSelection}
                        pageOffset={view.page * 500}
                        pageRowCount={view.rows.length}
                        disabled={busy || !view.rows.length}
                        paused={freezePaused}
                        onChange={changeFreeze}
                      />
                      <div className="spacer" />
                      {view.pages > 1 && (
                        <>
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
                        </>
                      )}
                      <FindBar
                        id="find"
                        value={findDraft}
                        onChange={setFindDraft}
                        disabled={busy}
                        count={view.searchMatchCount ?? 0}
                        headerCount={view.searchHeaderMatches?.length}
                        index={view.searchIndex}
                        caseSensitive={!!query.searchCaseSensitive}
                        wholeWord={!!query.searchWholeWord}
                        onCase={() =>
                          changeQuery({
                            ...query,
                            search: findDraft,
                            searchCaseSensitive: !query.searchCaseSensitive,
                            searchResult: undefined,
                            page: 0,
                          })
                        }
                        onWord={() =>
                          changeQuery({
                            ...query,
                            search: findDraft,
                            searchWholeWord: !query.searchWholeWord,
                            searchResult: undefined,
                            page: 0,
                          })
                        }
                        onNavigate={(direction) => {
                          const count = view.searchMatchCount ?? 0;
                          if (!count || busy || findDraft !== query.search)
                            return;
                          const index =
                            view.searchIndex === undefined
                              ? direction > 0
                                ? 0
                                : count - 1
                              : (view.searchIndex + direction + count) % count;
                          changeQuery({ ...query, searchResult: index });
                        }}
                      />
                    </div>
                  </>
                </>
              )}
              {mode === "source" && (
                <>
                  {sourceDirty && (
                    <div className="source-actions">
                      <span>
                        Unapplied draft. Apply or discard to switch scope or
                        return to Table.
                      </span>
                      <div className="spacer" />
                      <button
                        disabled={!sourceDirty || busy}
                        onClick={() =>
                          void run(() =>
                            showSource(sourceScope?.path ?? []).then(() => {}),
                          )
                        }
                      >
                        Discard draft
                      </button>
                      <button
                        className="primary"
                        disabled={!sourceDirty || busy}
                        onClick={() =>
                          void run(async () => {
                            const diagnostics =
                              await validateSourceDraft(source);
                            if (
                              latestSourceDraft.current.id !== activeId ||
                              latestSourceDraft.current.text !== source
                            )
                              return;
                            setSourceValidation({
                              id: activeId,
                              text: source,
                              diagnostics,
                            });
                            if (diagnostics.length) return;
                            const before = view;
                            const position = before
                              ? captureReloadPosition(before, sheetSelection)
                              : null;
                            const tableQuery = {
                              ...query,
                              searchResult: undefined,
                            };
                            const scopePath = sourceScope?.path ?? [];
                            if (sourceScope)
                              await client.current!.call("mutate", {
                                command: {
                                  action: "replace",
                                  path: scopePath,
                                  raw: scopedSourceText(
                                    source,
                                    sourceBase,
                                    sourceScope,
                                  ),
                                },
                                revision: sourceRevision,
                              });
                            else
                              await client.current!.call("source", {
                                text: source,
                                revision: sourceRevision,
                              });
                            setSelection(null);
                            ++selectionRequest.current;
                            pendingSelection.current = null;
                            navigationHistory.current.delete(activeId);
                            const projected =
                              await client.current!.call<Projection>(
                                "project",
                                tableQuery,
                              );
                            const nextQuery = before
                              ? remapReloadQuery(
                                  { ...tableQuery, path: projected.path },
                                  before,
                                  projected,
                                )
                              : { ...tableQuery, path: projected.path };
                            const sameTable =
                              JSON.stringify(nextQuery.path) ===
                              JSON.stringify(tableQuery.path);
                            const located =
                              position && sameTable
                                ? await client.current!.call<{
                                    row?: number;
                                    page: number;
                                  }>("locate-row", {
                                    query: nextQuery,
                                    path: position.rowPath,
                                  })
                                : null;
                            nextQuery.page =
                              located?.row === undefined
                                ? Math.min(tableQuery.page, projected.pages - 1)
                                : located.page;
                            setQuery(nextQuery);
                            const updated = await refresh(nextQuery);
                            const restored = updated
                              ? restoreReloadSelection(
                                  position,
                                  updated,
                                  located?.row,
                                )
                              : null;
                            setSheetSelection(restored);
                            if (position?.selected && !restored)
                              setNotice(
                                "The previously selected value is no longer visible. Selection cleared.",
                              );
                            await showSource(scopePath);
                          })
                        }
                      >
                        Apply source
                      </button>
                    </div>
                  )}
                  <SourceEditor
                    dark={dark}
                    wrapLines={sourceWrapLines}
                    onLocateReady={(locate) => {
                      sourceLocate.current = locate;
                    }}
                    onLocationChange={setHasSourceLocation}
                    onFormatReady={(format) => {
                      sourceFormatter.current = format;
                    }}
                    formatSource={(text, action) => {
                      if (!client.current)
                        return Promise.reject(
                          new Error("No document is open."),
                        );
                      const start = sourceScope?.from ?? 0;
                      const lineStart = start
                        ? sourceBase.lastIndexOf("\n", start - 1) + 1
                        : 0;
                      const baseIndent = sourceBase
                        .slice(lineStart, start)
                        .match(/^[ \t]*/)?.[0];
                      return client.current.call<string>("format-source", {
                        text,
                        action,
                        baseIndent,
                      });
                    }}
                    key={`${activeId}:${sourceScope ? JSON.stringify(sourceScope.path) : "whole"}`}
                    value={scopedSourceText(source, sourceBase, sourceScope)}
                    onChange={(draft) => {
                      setSourceValidation(null);
                      setSource(
                        applyScopedDraft(sourceBase, sourceScope, draft),
                      );
                    }}
                    target={sourceIsSelectedValue ? null : sourceTarget}
                  />
                </>
              )}
              {mode === "review" && review && (
                <ReviewDiff
                  dark={dark}
                  key={activeId}
                  before={review.before}
                  after={review.after}
                  initialDraft={source}
                  onChange={setSource}
                  busy={busy}
                  onApply={async (text) => {
                    if (!client.current || !view) return;
                    if (busyRef.current)
                      throw new Error(
                        "Wait for the current operation to finish.",
                      );
                    progress(true);
                    try {
                      await client.current.call("review-apply", {
                        text,
                        revision: sourceRevision,
                      });
                      const current = await client.current.call<{
                        text: string;
                        revision: number;
                      }>("text");
                      setSource(current.text);
                      setSourceBase(current.text);
                      setSourceRevision(current.revision);
                      setReview({ before: doc.text, after: current.text });
                      setSelection(null);
                      setSheetSelection(null);
                      await refresh();
                    } finally {
                      progress(false);
                    }
                  }}
                />
              )}
            </section>
            {inspector && mode === "table" && (
              <aside className="inspector" style={{ width: rightWidth }}>
                <PaneResizeHandle
                  label="Details"
                  width={rightWidth}
                  reverse
                  onChange={setRightWidth}
                  onReset={() => setRightWidth(360)}
                />
                <div className="pane-heading">
                  <h2>Details</h2>
                  <button
                    className="inspector-close"
                    aria-label="Close inspector"
                    onClick={() => setInspector(false)}
                  >
                    ×
                  </button>
                </div>
                {view?.recordsAvailable && (
                  <div className="inspector-layout">
                    <span>Table layout</span>
                    <div
                      className="view-mode"
                      role="group"
                      aria-label="Table layout"
                    >
                      {[false, true].map((records) => (
                        <button
                          key={String(records)}
                          aria-pressed={!!query.records === records}
                          title={
                            records
                              ? "Show one record per row, with fields as columns."
                              : "Show keys and values in two columns."
                          }
                          disabled={busy}
                          onClick={() => {
                            if (!!query.records !== records)
                              changeQuery({
                                ...query,
                                records,
                                page: 0,
                                sort: undefined,
                              });
                          }}
                        >
                          {records ? "Records" : "Properties"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selection && singleCellSelected ? (
                  <>
                    <div className="inspector-selection">
                      <dl className="inspector-metadata">
                        <dt>Path</dt>
                        <dd>
                          <code className="path">
                            {pointer(selection.cell.path) || "(root)"}
                          </code>
                        </dd>
                        <dt>JSON type</dt>
                        <dd>{selection.cell.type}</dd>
                        {view?.kind === "array" && activeCell && (
                          <>
                            <dt>Original index</dt>
                            <dd>
                              {String(view.rows[activeCell.row].path.at(-1))}
                            </dd>
                          </>
                        )}
                        {blankState(selection.cell) && (
                          <>
                            <dt>Value state</dt>
                            <dd>{blankState(selection.cell)}</dd>
                          </>
                        )}
                      </dl>
                      <div className="inspector-actions">
                        {selection.cell.container && (
                          <button
                            className="inspector-open-table"
                            disabled={busy}
                            onClick={() => void navigate(selection.cell.path)}
                          >
                            Open as table
                          </button>
                        )}
                        {selection.cell.type !== "missing" && (
                          <button
                            disabled={busy}
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
                        )}
                      </div>
                    </div>
                    <ValueDetails raw={selection.raw} />
                    {selection.cell.type !== "missing" && (
                      <details className="inspector-json">
                        <summary>
                          <ColumnMenuChevron />
                          {selectedJsonPreview?.truncated
                            ? "JSON preview"
                            : "Exact JSON"}
                        </summary>
                        <pre className="value-preview">
                          {selectedJsonPreview?.text}
                        </pre>
                        {selectedJsonPreview?.truncated && (
                          <p className="small">
                            Showing the first{" "}
                            {JSON_PREVIEW_LIMIT.toLocaleString()} characters.
                            Copy JSON copies the full value.
                          </p>
                        )}
                      </details>
                    )}
                    <div className="structural-actions">
                      {selection.cell.writable !== false && (
                        <button
                          disabled={busy}
                          onClick={() => void edit(selection.cell)}
                        >
                          Change type…
                        </button>
                      )}
                      {selection.cell.path.length > 0 &&
                        selection.cell.type !== "missing" && (
                          <>
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
                          </>
                        )}
                    </div>
                  </>
                ) : (
                  <div className="inspector-empty">
                    <span>{"{ }"}</span>
                    <p>
                      {sheetSelection && !singleCellSelected
                        ? `${selectedCellCount(sheetSelection, view?.matched ?? 0, view?.headers.length ?? 0).toLocaleString()} cells selected. Select one cell to inspect its value.`
                        : "Select a cell to see its path, type and exact value."}
                    </p>
                    <p className="small">
                      Type or F2 edits a value.
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
          <nav
            ref={sheetStrip}
            className="sheet-tabs"
            aria-label="Document sheets"
            data-overlay-scrollbar={overlayTabBar || undefined}
          >
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
                  pointer(sheet.path) === pointer(query.path)
                    ? "page"
                    : undefined
                }
                data-ancestor={
                  sheet.path.length < query.path.length &&
                  sheet.path.every((part, i) => query.path[i] === part)
                    ? true
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
              <InlineError
                anchor={inlineInput.current}
                onDiscard={cancelInline}
              >
                {inline.error}
              </InlineError>
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
            {view && mode === "table" && (
              <span className="selection-status">
                {view.matched.toLocaleString()} rows · {view.headers.length}{" "}
                columns
                {sheetSelection &&
                  ` · ${selectedCellCount(sheetSelection, view.matched, view.headers.length).toLocaleString()} ${selectedCellCount(sheetSelection, view.matched, view.headers.length) === 1 ? "cell" : "cells"} selected`}
              </span>
            )}
            <div className="spacer" />
            <span className="status-bytes">
              {view ? new Intl.NumberFormat().format(view.bytes) : 0} bytes
            </span>
            <span className="status-encoding">UTF-8</span>
            <span
              className="app-version"
              aria-label="Lattice version"
              title={`Lattice version, build ${__APP_BUILD__}`}
            >
              v{__APP_VERSION__}
            </span>
            <span className="status-client">Web client</span>
            <FileLocation
              key={activeId}
              name={doc.name}
              linked={!!doc.handle}
              onNotice={setNotice}
            />
            {updateStatus}
            {recoverySetting}
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
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- safe default: focus Keep editing in a discard prompt
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
  return (
    <FileDropZone
      blocked={busy || !!inline || !!editing || discardPrompt}
      onBlocked={() =>
        setNotice(
          "Finish the current edit or operation before opening dropped files.",
        )
      }
      onFiles={openDropped}
      onError={setError}
    >
      {workspaceView}
    </FileDropZone>
  );
}
