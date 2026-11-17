import { contentColumnWidths, createTextMeasurer } from "./columnSizing";
import { groupedHeaderRows } from "./groupedHeaders";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  compareNumbers,
  type AtomicMutation,
  type Cell,
  type Path,
  type Query,
} from "../document/engine";
import {
  expandedRows,
  nextExpandedCell,
  uniqueGroupEdits,
  type ExpandedDocument,
  type ExpandedSection,
  type ExpandedSort,
  type ExpandedCell,
} from "../document/editableGroups";
import {
  selectCell,
  selectHeader,
  selectWholeTable,
  selectionContains,
  type SheetSelection,
} from "../document/sheetSelection";
import { scalarText, cellInputKind } from "../editor/scalar";
import { compactJson } from "../document/compactJson";
import { blankState } from "./cellPresentation";
import { parseTSV, toTSV } from "./clipboard";
import { ColumnMenu } from "./ColumnMenu";
import { FreezeMenu } from "./FreezeMenu";
import type { DocumentClient } from "../worker/client";
type Props = {
  client: DocumentClient;
  path: Path;
  query: Query;
  revision: number;
  busy: boolean;
  onMutate: (commands: AtomicMutation[], revision: number) => Promise<void>;
  onSelect: (cell: Cell | null) => void;
  onEditing: (editing: boolean) => void;
  onNavigate: (path: Path) => void;
  onCommitReady: (commit: (() => Promise<boolean>) | null) => void;
  onSave: () => void;
};
type SavedTable = {
  search: string;
  sort?: ExpandedSort;
  filters: Record<string, string[]>;
  selection: SheetSelection | null;
  wrap: boolean;
  freeze: { rows: number; columns: number };
  widths: Record<number, number>;
  path: string | null;
};
const savedViews = new WeakMap<
  DocumentClient,
  Map<string, { active: string | null; tables: Map<string, SavedTable> }>
>();
function memoryFor(client: DocumentClient, path: Path) {
  let documents = savedViews.get(client);
  if (!documents) {
    documents = new Map();
    savedViews.set(client, documents);
  }
  const key = JSON.stringify(path);
  let state = documents.get(key);
  if (!state) {
    state = { active: null, tables: new Map() };
    documents.set(key, state);
  }
  return state;
}
export function ExpandedSheet(props: Props) {
  const memory = memoryFor(props.client, props.path);
  const [data, setData] = useState<ExpandedDocument>();
  const [selectedSection, setSelectedSection] = useState<string | null>(
    memory.active,
  );
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    props.client
      .call<ExpandedDocument>("expanded", {
        path: props.path,
        query: props.query,
      })
      .then((value) => {
        if (live) setData(value);
      })
      .catch((e) => {
        if (live) {
          setData(undefined);
          setError(e.message);
        }
      });
    return () => {
      live = false;
    };
  }, [
    props.client,
    JSON.stringify(props.path),
    JSON.stringify(props.query),
    props.revision,
  ]);
  return (
    <div className="expanded-sheets">
      {error && <p role="alert">{error}</p>}
      {!data && !error && (
        <span
          className="activity"
          role="status"
          aria-label="Loading expanded rows"
        />
      )}
      {data?.sections.map((section) => (
        <ExpandedTable
          key={section.key}
          {...props}
          section={section}
          saved={memory.tables.get(section.key)}
          onRemember={(value) => memory.tables.set(section.key, value)}
          active={selectedSection === section.key}
          onSelect={(cell) => {
            memory.active = section.key;
            setSelectedSection(section.key);
            props.onSelect(cell);
          }}
          busy={
            props.busy ||
            data.revision !== props.revision ||
            (editingSection !== null && editingSection !== section.key)
          }
          onEditing={(editing) => {
            setEditingSection(editing ? section.key : null);
            props.onEditing(editing);
          }}
          revision={data.revision}
        />
      ))}
    </div>
  );
}
function ExpandedTable({
  section,
  active,
  saved,
  onRemember,
  ...props
}: Props & {
  section: ExpandedSection;
  active: boolean;
  saved?: SavedTable;
  onRemember: (value: SavedTable) => void;
}) {
  const [search, setSearch] = useState(saved?.search ?? ""),
    [sort, setSort] = useState<ExpandedSort | undefined>(saved?.sort),
    [filters, setFilters] = useState<Record<string, string[]>>(
      saved?.filters ?? {},
    ),
    [selection, setSelection] = useState<SheetSelection | null>(
      saved?.selection ?? null,
    ),
    [wrap, setWrap] = useState(saved?.wrap ?? false),
    [freeze, setFreeze] = useState(saved?.freeze ?? { rows: 0, columns: 0 }),
    [message, setMessage] = useState(""),
    [working, setWorking] = useState(false);
  const [menu, setMenu] = useState<{
    column: number;
    anchor: HTMLElement;
  } | null>(null);
  const [columnName, setColumnName] = useState<string | null>(null);
  const [widths, setWidths] = useState<Record<number, number>>(
    saved?.widths ?? {},
  );
  const width = (c: number) => widths[c] ?? automaticWidths[c] ?? 100;
  const resize = useRef<{ column: number; x: number; width: number } | null>(
    null,
  );
  const [draft, setDraft] = useState<{
    item: ExpandedCell;
    selectAll: boolean;
    value: string;
    revision: number;
    r: number;
    c: number;
    error: string;
  } | null>(null);
  const pendingTarget = useRef<{ r: number; c: number } | null>(null);
  const current = useRef(draft);
  current.current = draft;
  const committing = useRef(false),
    root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const rows = useMemo(
    () => expandedRows(section, search, sort, filters, compareNumbers),
    [section, search, sort, filters],
  );
  const headers = [...section.parentHeaders, ...section.childHeaders],
    parents = section.parentHeaders.length;
  const mappingHeaders = groupedHeaderRows([
    ...section.parentHeaders.map((name) => [name]),
    ...(section.columnPaths ?? section.childHeaders.map((name) => [name])),
  ]);
  const headerHeight = (section.mapping ? mappingHeaders.length : 2) * 34;
  const [viewportWidth, setViewportWidth] = useState(900);
  const measureText = useMemo(createTextMeasurer, []);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      if (element.clientWidth > 0) setViewportWidth(element.clientWidth);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  const automaticWidths = useMemo(() => {
    const samples: { cells: Cell[] }[] = [];
    for (const group of section.groups) {
      for (const child of group.children.length ? group.children : [[]]) {
        samples.push({
          cells: [...group.parent, ...child].map((item) => item.cell),
        });
        if (samples.length === 50) break;
      }
      if (samples.length === 50) break;
    }
    const names = [
      ...section.parentHeaders,
      ...(section.columnPaths?.map((path) => path.at(-1) ?? "Value") ??
        section.childHeaders),
    ];
    return contentColumnWidths(
      { headers: names, columnKinds: names.map(() => "field"), rows: samples },
      viewportWidth,
      measureText,
    );
  }, [section, viewportWidth, measureText]);
  const busy = props.busy || working;
  const selected = selection?.anchor;
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const contextElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!contextMenu) return;
    const outside = (event: PointerEvent) => {
      if (!contextElement.current?.contains(event.target as Node))
        setContextMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    contextElement.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [contextMenu]);
  useEffect(() => {
    props.onEditing(!!draft);
    if (draft)
      props.onCommitReady(async () => {
        await finish();
        return current.current === null;
      });
    return () => {
      props.onEditing(false);
      if (draft) props.onCommitReady(null);
    };
  }, [!!draft]);
  useEffect(() => {
    if (draft) {
      input.current?.focus();
      if (draft.selectAll) input.current?.select();
      else
        input.current?.setSelectionRange(
          draft.value.length,
          draft.value.length,
        );
    }
  }, [!!draft]);
  const selectedPath = useRef<string | null>(saved?.path ?? null);
  useEffect(() => {
    onRemember({
      search,
      sort,
      filters,
      selection,
      wrap,
      freeze,
      widths,
      path: selectedPath.current,
    });
  }, [search, sort, filters, selection, wrap, freeze, widths]);
  useEffect(() => {
    if (!active) {
      selectedPath.current = null;
      setSelection(null);
    }
  }, [active]);
  useEffect(() => {
    if (!selectedPath.current) return;
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < headers.length; c++)
        if (
          JSON.stringify(rows[r].cells[c].cell.path) === selectedPath.current
        ) {
          setSelection(
            selectCell(null, { r: c < parents ? rows[r].first : r, c }),
          );
          props.onSelect(rows[r].cells[c].cell);
          return;
        }
    selectedPath.current = null;
    setSelection(null);
    props.onSelect(null);
  }, [rows]);
  const choose = (r: number, c: number, extend = false) => {
    selectedPath.current = extend
      ? null
      : JSON.stringify(rows[r]?.cells[c]?.cell.path);
    setSelection((previous) => selectCell(previous, { r, c }, extend));
    setMessage("");
    props.onSelect(rows[r]?.cells[c]?.cell ?? null);
  };
  const focus = (r: number, c: number) =>
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`)
        ?.focus(),
    );
  async function act(action: () => Promise<void>) {
    if (committing.current || busy) return;
    committing.current = true;
    setWorking(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      committing.current = false;
      setWorking(false);
    }
  }
  async function begin(r: number, c: number, initial?: string) {
    const item = rows[r]?.cells[c];
    if (
      !item ||
      busy ||
      draft ||
      (item.cell.writable === false && item.identifier === undefined)
    )
      return;
    if (item.cell.container) {
      props.onNavigate(item.cell.path);
      return;
    }
    if (initial !== undefined) {
      setDraft({
        item,
        selectAll: false,
        value: initial,
        revision: props.revision,
        r,
        c,
        error: "",
      });
      return;
    }
    await act(async () => {
      const raw =
        item.identifier !== undefined
          ? JSON.stringify(item.identifier)
          : item.cell.type === "missing" || item.cell.type === "null"
            ? ""
            : await props.client.call<string>("raw", { path: item.cell.path });
      if (raw.length > 8192)
        throw new Error("Use Source to edit this long value.");
      const kind =
        item.identifier !== undefined ? "string" : cellInputKind(item.cell);
      setDraft({
        item,
        selectAll: initial === undefined,
        value:
          initial ??
          (kind === "string" && raw
            ? JSON.parse(raw)
            : kind === "array"
              ? compactJson(raw)
              : raw),
        revision: props.revision,
        r,
        c,
        error: "",
      });
    });
  }
  async function finish(move?: "next" | "previous" | "down" | "up") {
    const edit = current.current;
    if (!edit || committing.current) return;
    committing.current = true;
    setWorking(true);
    try {
      const kind =
          edit.item.identifier !== undefined
            ? "string"
            : cellInputKind(edit.item.cell),
        raw =
          edit.value === "" && kind !== "string"
            ? "null"
            : scalarText(kind, edit.value);
      await props.onMutate(
        edit.item.identifier !== undefined
          ? [{ action: "rename", path: edit.item.cell.path, key: edit.value }]
          : uniqueGroupEdits([{ cell: edit.item.cell, raw }]),
        edit.revision,
      );
      current.current = null;
      setDraft(null);
      let r = edit.r,
        c = edit.c;
      if (move === "next" || move === "previous") {
        const next = nextExpandedCell(
          rows,
          headers.length,
          parents,
          r,
          c,
          move === "next" ? 1 : -1,
        );
        r = next.r;
        c = next.c;
      }
      if (move === "down")
        r = Math.min(rows.length - 1, c < parents ? rows[r].end : r + 1);
      if (move === "up") r = Math.max(0, r - 1);
      if (c < parents) r = rows[r]?.first ?? r;
      if (pendingTarget.current) {
        r = pendingTarget.current.r;
        c = pendingTarget.current.c;
        pendingTarget.current = null;
      }
      choose(r, c);
      focus(r, c);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setDraft({ ...edit, error });
      requestAnimationFrame(() => input.current?.focus());
    } finally {
      committing.current = false;
      setWorking(false);
    }
  }
  function rangeItems() {
    const result: ExpandedCell[][] = [];
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].cells.filter((_, c) =>
        selectionContains(selection, { r, c }, rows.length, headers.length),
      );
      if (cells.length) result.push(cells);
    }
    return result;
  }
  const copied = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    copied.current = null;
    if (props.busy) return;
    const values = rangeItems();
    if (values.length)
      props.client
        .call<string[][]>("expanded-values", {
          cells: values,
          revision: props.revision,
        })
        .then((value) => {
          if (live) copied.current = toTSV(value);
        })
        .catch((e) => {
          if (live) setMessage(e.message);
        });
    return () => {
      live = false;
    };
  }, [selection, rows, props.revision, props.busy]);
  useEffect(() => setMessage(""), [props.revision]);
  async function paste(text: string) {
    const values = parseTSV(text);
    if (!selected) throw new Error("Select a destination cell.");
    if (values.length * values[0].length > 10000)
      throw new Error("Paste at most 10,000 cells.");
    const edits: { cell: Cell; raw: string }[] = [];
    for (let r = 0; r < values.length; r++)
      for (let c = 0; c < values[r].length; c++) {
        const item = rows[selected.r + r]?.cells[selected.c + c];
        if (!item)
          throw new Error(
            "Paste exceeds this table. Add rows or columns first.",
          );
        const value = values[r][c],
          kind = cellInputKind(item.cell);
        edits.push({
          cell: item.cell,
          raw:
            value === "" && kind !== "string"
              ? "null"
              : scalarText(kind, value),
        });
      }
    await props.onMutate(uniqueGroupEdits(edits), props.revision);
  }
  const frozenRows =
    freeze.rows && rows[Math.min(freeze.rows, rows.length) - 1]
      ? rows[Math.min(freeze.rows, rows.length) - 1].end
      : 0;
  const rowHeight = wrap ? 72 : 34;
  const frozenAllowed =
    frozenRows * rowHeight <= (root.current?.clientHeight ?? 500) * 0.4;
  function sticky(r: number, c: number): CSSProperties {
    const rowFrozen = frozenAllowed && r < frozenRows,
      colFrozen = c < freeze.columns;
    return {
      position: rowFrozen || colFrozen ? "sticky" : undefined,
      top: rowFrozen ? headerHeight + r * rowHeight : undefined,
      left: colFrozen
        ? 40 +
          Array.from({ length: c }, (_, i) => width(i)).reduce(
            (a, b) => a + b,
            0,
          )
        : undefined,
      zIndex:
        rowFrozen && colFrozen ? 5 : rowFrozen || colFrozen ? 3 : undefined,
    };
  }
  function changeView(action: () => void) {
    if (draft || busy) return;
    action();
    selectedPath.current = null;
    setSelection(null);
    props.onSelect(null);
  }
  const renderHeader = (
    header: string,
    c: number,
    label = header,
    rowSpan = 1,
  ) => (
    <th
      key={c}
      rowSpan={rowSpan}
      scope="col"
      aria-selected={
        selection?.mode === "columns" &&
        selection.spans.some(([a, b]) => c >= a && c <= b)
      }
    >
      <div className="sheet-column-heading">
        <button
          className="column-select"
          disabled={busy || !!draft}
          onClick={(e) => {
            setSelection((previous) =>
              selectHeader(
                previous,
                "columns",
                { r: 0, c },
                { extend: e.shiftKey },
              ),
            );
            props.onSelect(null);
          }}
        >
          {label}
          {sort?.column === c ? (sort.direction === "ASC" ? " ↑" : " ↓") : ""}
        </button>
        <button
          className="header-filter"
          disabled={busy || !!draft}
          aria-label={`Sort and filter ${section.key} ${header}`}
          onClick={(e) => setMenu({ column: c, anchor: e.currentTarget })}
        >
          ⌄{filters[String(c)] && <span className="filter-dot" />}
        </button>
      </div>
      <span
        className="expanded-column-resize"
        role="separator"
        aria-label={`Resize ${section.key} ${header}`}
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={(e) => {
          resize.current = {
            column: c,
            x: e.clientX,
            width: width(c),
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (resize.current)
            setWidths((previous) => ({
              ...previous,
              [c]: Math.max(
                80,
                Math.min(
                  600,
                  resize.current!.width + e.clientX - resize.current!.x,
                ),
              ),
            }));
        }}
        onPointerUp={() => {
          resize.current = null;
        }}
        onPointerCancel={() => {
          resize.current = null;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            setWidths((previous) => ({
              ...previous,
              [c]: Math.max(
                80,
                Math.min(600, width(c) + (e.key === "ArrowRight" ? 12 : -12)),
              ),
            }));
          }
        }}
      />
    </th>
  );
  const corner = (
    <th rowSpan={section.mapping ? mappingHeaders.length : 2}>
      <button
        className="select-all-cells"
        aria-label={`Select all ${section.key}`}
        onClick={() => {
          setSelection(selectWholeTable(rows.length, headers.length));
          props.onSelect(null);
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 10 10 2v8Z" fill="currentColor" />
        </svg>
      </button>
    </th>
  );
  return (
    <section
      className="expanded-section"
      aria-label={`${section.key} expanded table`}
    >
      {!section.mapping && <h3>{section.key}</h3>}
      {menu && (
        <ColumnMenu
          key={menu.column}
          name={headers[menu.column]}
          anchor={menu.anchor}
          selected={filters[String(menu.column)]}
          load={async () => {
            const all = section.groups.flatMap((group) =>
              menu.column < parents
                ? [group.parent[menu.column]]
                : group.children.map((row) => row[menu.column - parents]),
            );
            return {
              options: [
                ...new Map(
                  all.map((item) => [
                    item.cell.type + ":" + item.value,
                    {
                      key: item.cell.type + ":" + item.value,
                      label: item.value || "(blank)",
                    },
                  ]),
                ).values(),
              ],
              truncated: false,
            };
          }}
          onClose={() => setMenu(null)}
          onSort={(direction) =>
            changeView(() => {
              setSort(
                direction ? { column: menu.column, direction } : undefined,
              );
              setMenu(null);
            })
          }
          onApply={(keys) =>
            changeView(() => {
              setFilters((previous) => {
                const next = { ...previous };
                if (keys === undefined) delete next[String(menu.column)];
                else next[String(menu.column)] = keys;
                return next;
              });
              setMenu(null);
            })
          }
        />
      )}
      {contextMenu && (
        <div
          ref={contextElement}
          className="expanded-context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            role="menuitem"
            onClick={() =>
              void act(async () => {
                if (copied.current === null)
                  throw new Error("Selection is being prepared. Copy again.");
                await navigator.clipboard.writeText(copied.current);
                setContextMenu(null);
              })
            }
          >
            Copy <kbd>Ctrl/⌘ C</kbd>
          </button>
          <button
            role="menuitem"
            onClick={() =>
              void act(async () => {
                await paste(await navigator.clipboard.readText());
                setContextMenu(null);
              })
            }
          >
            Paste <kbd>Ctrl/⌘ V</kbd>
          </button>
        </div>
      )}
      <div
        ref={root}
        onPointerDownCapture={(event) => {
          if (
            current.current &&
            event.target instanceof Element &&
            !event.target.closest("textarea")
          ) {
            const cell =
              event.target.closest<HTMLElement>("td[data-r][data-c]");
            if (cell)
              pendingTarget.current = {
                r: Number(cell.dataset.r),
                c: Number(cell.dataset.c),
              };
          }
        }}
        className={`expanded-grid ${wrap ? "expanded-wrap" : ""}`}
        onCopy={(e) => {
          if (draft) return;
          if (copied.current !== null) {
            e.preventDefault();
            e.clipboardData.setData("text/plain", copied.current);
          } else {
            e.preventDefault();
            setMessage("Selection is being prepared. Copy again in a moment.");
          }
        }}
        onPaste={(e) => {
          if (draft) return;
          e.preventDefault();
          void act(() => paste(e.clipboardData.getData("text/plain")));
        }}
      >
        <table
          aria-label={`${section.key} data`}
          style={{
            width: 40 + headers.reduce((sum, _, c) => sum + width(c), 0),
          }}
        >
          <colgroup>
            <col style={{ width: 40 }} />
            {headers.map((_, c) => (
              <col key={c} style={{ width: width(c) }} />
            ))}
          </colgroup>
          <thead>
            {section.mapping ? (
              mappingHeaders.map((row, depth) => (
                <tr key={depth}>
                  {depth === 0 && corner}
                  {row.map((cell) =>
                    cell.leaf ? (
                      renderHeader(
                        headers[cell.column],
                        cell.column,
                        cell.label,
                        cell.rowSpan,
                      )
                    ) : (
                      <th
                        key={cell.column}
                        colSpan={cell.colSpan}
                        scope="colgroup"
                        aria-selected={
                          selection?.mode === "columns" &&
                          Array.from(
                            { length: cell.colSpan },
                            (_, i) => i + cell.column,
                          ).every((column) =>
                            selection.spans.some(
                              ([a, b]) => column >= a && column <= b,
                            ),
                          )
                        }
                      >
                        <button
                          className="expanded-group-label"
                          disabled={busy || !!draft}
                          aria-label={`Select ${cell.label} columns`}
                          onClick={() => {
                            const first = selectHeader(null, "columns", {
                              r: 0,
                              c: cell.column,
                            });
                            setSelection(
                              selectHeader(
                                first,
                                "columns",
                                { r: 0, c: cell.column + cell.colSpan - 1 },
                                { extend: true },
                              ),
                            );
                            selectedPath.current = null;
                            props.onSelect(null);
                          }}
                        >
                          {cell.label}
                        </button>
                      </th>
                    ),
                  )}
                </tr>
              ))
            ) : (
              <>
                {!section.mapping && (
                  <tr>
                    {corner}
                    {parents > 0 && (
                      <th colSpan={parents} scope="colgroup">
                        Parent
                      </th>
                    )}
                    <th colSpan={section.childHeaders.length} scope="colgroup">
                      {section.key}
                    </th>
                  </tr>
                )}
                <tr>{headers.map((header, c) => renderHeader(header, c))}</tr>
              </>
            )}
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr
                key={JSON.stringify(row.groupPath) + ":" + r}
                style={{ height: rowHeight }}
              >
                <th className="expanded-row-number" scope="row">
                  <button
                    disabled={busy || !!draft}
                    aria-label={`Select row ${r + 1} in ${section.key}`}
                    onClick={(e) => {
                      setSelection((previous) =>
                        selectHeader(
                          previous,
                          "rows",
                          { r, c: 0 },
                          { extend: e.shiftKey },
                        ),
                      );
                      props.onSelect(null);
                    }}
                  >
                    {r + 1}
                  </button>
                </th>
                {row.cells.map((item, c) => {
                  if (c < parents && row.index > 0) return null;
                  const editing = draft?.r === r && draft.c === c;
                  const highlighted = Array.from(
                    { length: c < parents ? row.count : 1 },
                    (_, i) => r + i,
                  ).some((index) =>
                    selectionContains(
                      selection,
                      { r: index, c },
                      rows.length,
                      headers.length,
                    ),
                  );
                  return (
                    <td
                      key={c}
                      data-r={r}
                      data-c={c}
                      tabIndex={0}
                      rowSpan={c < parents ? row.count : 1}
                      className={`${highlighted ? "expanded-selected" : ""} ${item.cell.container ? "container-value" : ""}`}
                      style={sticky(r, c)}
                      title={JSON.stringify(item.cell.path)}
                      onClick={(e) => {
                        if (!draft && !busy) choose(r, c, e.shiftKey);
                      }}
                      onDoubleClick={() => void begin(r, c)}
                      onContextMenu={(event) => {
                        if (draft || busy) return;
                        event.preventDefault();
                        choose(r, c);
                        setContextMenu({
                          x: Math.min(event.clientX, innerWidth - 200),
                          y: Math.min(event.clientY, innerHeight - 100),
                        });
                      }}
                      onKeyDown={(e) => {
                        if (editing) return;
                        if (e.key === "Enter" || e.key === "F2") {
                          e.preventDefault();
                          void begin(r, c);
                        } else if (
                          e.key === "Tab" ||
                          e.key.startsWith("Arrow")
                        ) {
                          e.preventDefault();
                          let nr = r,
                            nc = c;
                          if (e.key === "ArrowDown")
                            nr = c < parents ? row.end : r + 1;
                          if (e.key === "ArrowUp") nr = r - 1;
                          if (e.key === "ArrowLeft") nc = c - 1;
                          if (e.key === "ArrowRight") nc = c + 1;
                          if (e.key === "Tab") {
                            const next = nextExpandedCell(
                              rows,
                              headers.length,
                              parents,
                              r,
                              c,
                              e.shiftKey ? -1 : 1,
                            );
                            nr = next.r;
                            nc = next.c;
                          }
                          nr = Math.max(0, Math.min(rows.length - 1, nr));
                          nc = Math.max(0, Math.min(headers.length - 1, nc));
                          if (nc < parents) nr = rows[nr].first;
                          choose(nr, nc, e.shiftKey && e.key !== "Tab");
                          focus(nr, nc);
                        } else if (
                          e.key.length === 1 &&
                          !e.ctrlKey &&
                          !e.metaKey &&
                          !e.altKey
                        ) {
                          e.preventDefault();
                          void begin(r, c, e.key);
                        } else if (
                          e.key === "Delete" ||
                          e.key === "Backspace"
                        ) {
                          e.preventDefault();
                          void act(() =>
                            props.onMutate(
                              uniqueGroupEdits(
                                rangeItems()
                                  .flat()
                                  .map((item) => ({
                                    cell: item.cell,
                                    raw:
                                      cellInputKind(item.cell) === "string"
                                        ? '""'
                                        : "null",
                                  })),
                              ),
                              props.revision,
                            ),
                          );
                        }
                      }}
                    >
                      {editing ? (
                        <textarea
                          ref={input}
                          className="inline-cell"
                          aria-label={`Edit ${section.key} ${headers[c]}`}
                          aria-invalid={!!draft.error}
                          value={draft.value}
                          onChange={(e) =>
                            setDraft({ ...draft, value: e.target.value })
                          }
                          onBlur={() => {
                            if (current.current && !committing.current)
                              void finish();
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Escape") {
                              e.preventDefault();
                              current.current = null;
                              setDraft(null);
                              focus(r, c);
                            }
                            if (
                              (e.key === "Enter" && !e.altKey) ||
                              e.key === "Tab"
                            ) {
                              e.preventDefault();
                              void finish(
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
                      ) : (
                        <span className="expanded-cell-value">
                          {blankState(item.cell) ? "" : item.cell.display}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(draft?.error || message) && (
        <p className="edit-error" role="alert">
          {draft?.error || message}
        </p>
      )}
      <div className="pagination">
        <button
          disabled={busy || !!draft || !selected}
          onClick={() => {
            const row = selected && rows[selected.r];
            if (section.mapping) {
              const candidate = row?.cells[parents]?.cell.path;
              const record = section.recordPaths?.find(
                (path) =>
                  candidate &&
                  path.every((part, index) => part === candidate[index]),
              );
              if (record?.length)
                void act(() =>
                  props.onMutate(
                    [{ action: "add-row", path: record.slice(0, -1) }],
                    props.revision,
                  ),
                );
              return;
            }
            const group =
              row &&
              section.groups.find(
                (group) =>
                  JSON.stringify(group.path) === JSON.stringify(row.groupPath),
              );
            if (group)
              void act(() =>
                props.onMutate(
                  group.arrayPresent
                    ? [
                        {
                          action: "insert",
                          path: [...group.path, section.key],
                          raw: JSON.stringify(
                            Object.fromEntries(
                              section.childHeaders.map((key) => [key, null]),
                            ),
                          ),
                        },
                      ]
                    : [
                        {
                          action: "insert",
                          path: group.path,
                          key: section.key,
                          raw: JSON.stringify([
                            Object.fromEntries(
                              section.childHeaders.map((key) => [key, null]),
                            ),
                          ]),
                        },
                      ],
                  props.revision,
                ),
              );
          }}
        >
          Add row
        </button>
        <button
          disabled={busy || !!draft || columnName !== null}
          onClick={() => setColumnName("")}
        >
          Add column
        </button>
        {columnName !== null && (
          <form
            className="expanded-column-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!columnName) {
                setMessage("Enter a column name.");
                return;
              }
              void act(async () => {
                if (section.mapping) {
                  await props.onMutate(
                    (section.recordPaths ?? []).map((path) => ({
                      action: "insert",
                      path,
                      key: columnName,
                      raw: "null",
                    })),
                    props.revision,
                  );
                  setColumnName(null);
                  return;
                }
                const commands: AtomicMutation[] = section.groups
                  .filter((group) => group.arrayPresent)
                  .map((group) => ({
                    action: "add-column",
                    path: [...group.path, section.key],
                    key: columnName,
                  }));
                await props.onMutate(commands, props.revision);
                setColumnName(null);
              });
            }}
          >
            <input
              aria-label={`New ${section.key} column`}
              autoFocus
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setColumnName(null);
              }}
            />
            <button type="submit" disabled={busy}>
              Add
            </button>
            <button type="button" onClick={() => setColumnName(null)}>
              Cancel
            </button>
          </form>
        )}
        <button
          aria-pressed={wrap}
          disabled={busy || !!draft}
          onClick={() => setWrap(!wrap)}
        >
          Wrap text
        </button>
        <FreezeMenu
          rows={frozenRows}
          columns={freeze.columns}
          selection={selected ? { row: selected.r, column: selected.c } : null}
          rangeSelection={selection}
          pageRowCount={rows.length}
          disabled={busy || !!draft}
          paused={
            frozenRows && !frozenAllowed
              ? "Merged parent groups must fit within 40% of the table height."
              : undefined
          }
          onChange={(value) => {
            if (
              Array.from({ length: value.columns }, (_, i) => width(i)).reduce(
                (a, b) => a + b,
                0,
              ) >
              (root.current?.clientWidth ?? 800) * 0.6
            ) {
              setMessage("Freeze fewer columns to leave room for scrolling.");
              return;
            }
            const count =
              value.rows && rows[Math.min(value.rows, rows.length) - 1]
                ? rows[Math.min(value.rows, rows.length) - 1].end
                : 0;
            setFreeze({ ...value, rows: count });
            setMessage("");
          }}
        />
        {(sort || Object.keys(filters).length > 0) && (
          <button
            disabled={busy || !!draft}
            onClick={() =>
              changeView(() => {
                setSort(undefined);
                setFilters({});
              })
            }
          >
            Clear sort and filters
          </button>
        )}
        <div className="spacer" />
        <input
          aria-label={`Find in ${section.key}`}
          type="search"
          placeholder="Find in this table…"
          disabled={!!draft}
          value={search}
          onChange={(e) => changeView(() => setSearch(e.target.value))}
        />
      </div>
    </section>
  );
}
