import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  Projection,
  AtomicMutation,
  Path,
  Kind,
} from "../document/engine";
import { scalarText } from "../editor/scalar";
import { parseTSV, toTSV } from "./clipboard";
type Point = { r: number; c: number };
export function SheetRange({
  view,
  children,
  read,
  apply,
  onAddRow,
  onAddColumn,
  isValueColumn,
  recordMode,
}: {
  view: Projection;
  children: ReactNode;
  read: (p: Path) => Promise<string>;
  apply: (ops: AtomicMutation[]) => Promise<void>;
  onAddRow: () => void;
  onAddColumn: () => void;
  isValueColumn: (c: number) => boolean;
  recordMode: boolean;
}) {
  const [anchor, setAnchor] = useState<Point | null>(null),
    [end, setEnd] = useState<Point | null>(null),
    [message, setMessage] = useState(""),
    [menu, setMenu] = useState<{
      x: number;
      y: number;
      r: number;
      c: number;
    } | null>(null);
  const menuElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuElement.current?.contains(event.target)
      )
        setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  const dragging = useRef(false),
    clip = useRef(""),
    ready = useRef(false);
  const bounds =
    anchor && end
      ? {
          r1: Math.min(anchor.r, end.r),
          r2: Math.max(anchor.r, end.r),
          c1: Math.min(anchor.c, end.c),
          c2: Math.max(anchor.c, end.c),
        }
      : null;
  const key = JSON.stringify(bounds);
  useEffect(() => {
    setAnchor(null);
    setEnd(null);
    setMenu(null);
  }, [view.path.join("\0"), view.page, view.revision]);
  useEffect(() => {
    let cancelled = false;
    ready.current = false;
    if (
      bounds &&
      (bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1) > 10000
    ) {
      setMessage("Copy at most 10,000 cells.");
      return;
    }
    if (bounds)
      void (async () => {
        const result: string[][] = [];
        for (let r = bounds.r1; r <= bounds.r2; r++) {
          const row: string[] = [];
          for (let c = bounds.c1; c <= bounds.c2; c++) {
            const cell = view.rows[r]?.cells[c];
            if (!cell) continue;
            const raw = cell.type === "missing" ? "" : await read(cell.path);
            row.push(
              c === 0
                ? view.rows[r].label
                : cell.type === "string"
                  ? JSON.parse(raw)
                  : raw,
            );
          }
          result.push(row);
        }
        if (!cancelled) {
          clip.current = toTSV(result);
          ready.current = true;
        }
      })().catch((e) => setMessage(String(e)));
    return () => {
      cancelled = true;
    };
  }, [key, view.revision]);
  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  function point(target: EventTarget | null): Point | null {
    if (!(target instanceof Element)) return null;
    const cell = target.closest('[role="gridcell"]'),
      row = cell?.closest('[role="row"]');
    if (!cell || !row) return null;
    const p = {
      r: Number(row.getAttribute("aria-rowindex")) - 2,
      c: Number(cell.getAttribute("aria-colindex")) - 2,
    };
    return p.c >= 0 ? p : null;
  }
  async function paste(text: string) {
    if (!bounds) return;
    try {
      const values = parseTSV(text),
        ops: AtomicMutation[] = [];
      if (values.length * values[0].length > 10000)
        throw Error("Paste at most 10,000 cells.");
      for (let r = 0; r < values.length; r++)
        for (let c = 0; c < values[r].length; c++) {
          const ri = bounds.r1 + r,
            ci = bounds.c1 + c,
            cell = view.rows[ri]?.cells[ci];
          if (!cell)
            throw Error("Paste exceeds this page. Add rows or columns first.");
          if (!isValueColumn(ci) || cell.writable === false || cell.container)
            throw Error(
              `Cell ${ri + 1}, ${ci + 1} cannot accept pasted values.`,
            );
          const kind = (
            cell.type === "missing" || cell.type === "null"
              ? (cell.inputKind ?? "string")
              : cell.type
          ) as Kind;
          const value = values[r][c],
            raw = value === "" ? "null" : scalarText(kind, value);
          ops.push(
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
      await apply(ops);
      setMessage("Pasted. Undo restores the entire selection.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  async function columnAction(rename: boolean) {
    if (!menu) return;
    try {
      const old = view.headers[menu.c];
      const name = rename ? prompt("Column name", old) : null;
      if (rename && name === null) return;
      if (rename && !name?.trim()) throw Error("Enter a column name.");
      await apply([
        {
          action: "column-edit",
          path: view.path,
          key: old,
          ...(rename ? { name: name! } : {}),
        },
      ]);
      setMenu(null);
    } catch (e) {
      setMessage(String(e));
    }
  }
  async function fillDown() {
    if (!bounds || bounds.r1 === bounds.r2) return;
    try {
      const ops: AtomicMutation[] = [];
      for (let c = bounds.c1; c <= bounds.c2; c++) {
        const source = view.rows[bounds.r1].cells[c];
        if (!isValueColumn(c) || source.container || source.writable === false)
          throw Error("Select writable value cells for fill-down.");
        const raw =
          source.type === "missing" ? "null" : await read(source.path);
        for (let r = bounds.r1 + 1; r <= bounds.r2; r++) {
          const cell = view.rows[r].cells[c];
          if (cell.container || cell.writable === false)
            throw Error("Fill-down cannot replace nested tables.");
          const kind =
            cell.type === "missing" || cell.type === "null"
              ? cell.inputKind
              : cell.type;
          if (
            source.type !== "missing" &&
            source.type !== "null" &&
            kind &&
            kind !== source.type
          )
            throw Error("Selected cells have incompatible types.");
          ops.push(
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
      }
      await apply(ops);
      setMessage("Filled down. Undo restores the selection.");
    } catch (e) {
      setMessage(String(e));
    }
  }
  async function relativeRow(where: "before" | "after", duplicate = false) {
    if (!menu) return;
    try {
      await apply([
        {
          action: "relative-row",
          path: view.rows[menu.r].path,
          where,
          duplicate,
        },
      ]);
      setMenu(null);
    } catch (e) {
      setMessage(String(e));
    }
  }
  const selectors: string[] = [];
  if (bounds)
    for (let r = bounds.r1; r <= bounds.r2; r++)
      selectors.push(
        `.range-sheet [role=row][aria-rowindex="${r + 2}"] [role=gridcell]:nth-child(n+${bounds.c1 + 2}):nth-child(-n+${bounds.c2 + 2})`,
      );
  return (
    <div
      className="range-sheet"
      onPointerDownCapture={(e) => {
        if ((e.target as Element).closest("input,textarea,[data-row-resizer]"))
          return;
        const p = point(e.target);
        if (!p) return;
        setMenu(null);
        if (e.shiftKey && anchor) {
          setEnd(p);
          e.preventDefault();
        } else {
          setAnchor(p);
          setEnd(p);
        }
        dragging.current = true;
      }}
      onPointerMove={(e) => {
        if (dragging.current) {
          const p = point(e.target);
          if (p) setEnd(p);
        }
      }}
      onKeyDownCapture={(e) => {
        if ((e.target as Element).closest("input,textarea,[data-row-resizer]"))
          return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
          e.preventDefault();
          e.stopPropagation();
          void fillDown();
          return;
        }

        if (e.shiftKey && anchor && end && e.key.startsWith("Arrow")) {
          e.preventDefault();
          e.stopPropagation();
          setEnd({
            r: Math.max(
              0,
              Math.min(
                view.rows.length - 1,
                end.r +
                  (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
              ),
            ),
            c: Math.max(
              0,
              Math.min(
                view.headers.length - 1,
                end.c +
                  (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0),
              ),
            ),
          });
        }
      }}
      onCopyCapture={(e) => {
        if ((e.target as Element).closest("input,textarea,[data-row-resizer]"))
          return;
        if (bounds) {
          e.preventDefault();
          if (ready.current)
            e.clipboardData.setData("text/plain", clip.current);
          else setMessage("Preparing selection. Copy again in a moment.");
        }
      }}
      onPasteCapture={(e) => {
        if ((e.target as Element).closest("input,textarea,[data-row-resizer]"))
          return;
        e.preventDefault();
        void paste(e.clipboardData.getData("text/plain"));
      }}
      onContextMenu={(e) => {
        const target = e.target as Element;
        const p = point(target);
        const header = target.closest("[role=columnheader]");
        const row = target.closest("[role=row]");
        const c = header
          ? Number(header.getAttribute("aria-colindex")) - 2
          : (p?.c ?? -1);
        if (!p && !header && !row) return;
        e.preventDefault();
        setMenu({
          x: e.clientX,
          y: e.clientY,
          r: p?.r ?? Number(row?.getAttribute("aria-rowindex")) - 2,
          c,
        });
      }}
    >
      {selectors.length > 0 && (
        <style>{selectors.join(",") + "{background:var(--selection);}"}</style>
      )}
      {message && (
        <div role="status" className="range-message">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      {children}
      {menu && (
        <div
          ref={menuElement}
          className="sheet-menu"
          role="menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 220),
            top: Math.min(menu.y, window.innerHeight - 220),
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenu(null);
          }}
        >
          <button
            role="menuitem"
            onClick={() => {
              onAddRow();
              setMenu(null);
            }}
          >
            Add row
          </button>
          <button
            role="menuitem"
            onClick={() => {
              onAddColumn();
              setMenu(null);
            }}
          >
            Add column
          </button>
          {menu.r >= 0 && (
            <>
              <button
                role="menuitem"
                onClick={() => void relativeRow("before")}
              >
                Insert row above
              </button>
              <button role="menuitem" onClick={() => void relativeRow("after")}>
                Insert row below
              </button>
              <button
                role="menuitem"
                onClick={() => void relativeRow("after", true)}
              >
                Duplicate row
              </button>
            </>
          )}
          {bounds && bounds.r2 > bounds.r1 && (
            <button
              role="menuitem"
              onClick={() => {
                void fillDown();
                setMenu(null);
              }}
            >
              Fill down
            </button>
          )}
          {menu.r >= 0 && (
            <button
              role="menuitem"
              onClick={() => {
                void apply([
                  { action: "remove", path: view.rows[menu.r].path },
                ]).catch((e) => setMessage(String(e)));
                setMenu(null);
              }}
            >
              Delete row
            </button>
          )}
          {menu.c > 0 && recordMode && (
            <>
              <button role="menuitem" onClick={() => void columnAction(true)}>
                Rename column…
              </button>
              <button role="menuitem" onClick={() => void columnAction(false)}>
                Delete column
              </button>
            </>
          )}
          <button role="menuitem" onClick={() => setMenu(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
