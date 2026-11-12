import { fieldColumnKey } from "./columnRoles";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Projection,
  AtomicMutation,
  Path,
  Kind,
} from "../document/engine";
import { scalarText } from "../editor/scalar";
import { parseTSV, readRange } from "./clipboard";
type Point = { r: number; c: number };
export function SheetRange({
  view,
  children,
  read,
  apply,
  onAddRow,
  onAddColumn,
  isValueColumn,
}: {
  view: Projection;
  children: ReactNode;
  read: (p: Path) => Promise<string>;
  apply: (ops: AtomicMutation[]) => Promise<void>;
  onAddRow: () => void;
  onAddColumn: () => void;
  isValueColumn: (c: number) => boolean;
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
  const contextTarget = useRef<HTMLElement | null>(null);
  const restoringFocus = useRef(false);
  const contextOpening = useRef(false);
  const clipboardBusy = useRef(false);
  const [menuPosition, setMenuPosition] = useState({ left: 8, top: 8 });
  const shortcut = navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl+";
  function closeMenu(restore = false) {
    setMenu(null);
    if (restore) {
      restoringFocus.current = true;
      requestAnimationFrame(() => {
        const target = contextTarget.current;
        if (target?.isConnected) {
          target.tabIndex = -1;
          target.focus();
        }
        restoringFocus.current = false;
      });
    }
  }
  useLayoutEffect(() => {
    if (!menu || !menuElement.current) return;
    const rect = menuElement.current.getBoundingClientRect();
    setMenuPosition({
      left: Math.max(8, Math.min(menu.x, innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(menu.y, innerHeight - rect.height - 8)),
    });
    menuElement.current
      .querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
  }, [menu]);
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
      if (event.key === "Escape") closeMenu(true);
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
  }, [view]);
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
      void readRange(view, bounds, read)
        .then((text) => {
          if (!cancelled) {
            clip.current = text;
            ready.current = true;
          }
        })
        .catch((error) => {
          if (!cancelled) setMessage(String(error));
        });
    return () => {
      cancelled = true;
    };
  }, [key, view]);
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
  async function clipboardAction(action: "copy" | "paste") {
    if (clipboardBusy.current || !bounds) return;
    clipboardBusy.current = true;
    closeMenu(true);
    try {
      if (action === "copy") {
        const text = ready.current
          ? clip.current
          : await readRange(view, bounds, read);
        await navigator.clipboard.writeText(text);
        setMessage("");
      } else {
        const text = await navigator.clipboard.readText();
        await paste(text);
      }
    } catch {
      setMessage(
        `Clipboard access is unavailable. Select the cells and use ${shortcut}${action === "copy" ? "C" : "V"} instead.`,
      );
    } finally {
      clipboardBusy.current = false;
    }
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
      const old = fieldColumnKey(view, menu.c);
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
      onFocusCapture={(e) => {
        if (
          restoringFocus.current ||
          contextOpening.current ||
          dragging.current ||
          (e.target as Element).closest("input,textarea,[data-row-resizer]")
        )
          return;
        const p = point(e.target);
        if (p) {
          setAnchor(p);
          setEnd(p);
        }
      }}
      onPointerDownCapture={(e) => {
        contextOpening.current = e.button === 2;
        if (e.button !== 0) return;
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
        contextOpening.current = false;
        const target = e.target as Element;
        if (target.closest("input,textarea,[data-row-resizer]")) return;
        const p = point(target);
        const header = target.closest("[role=columnheader]");
        const row = target.closest("[role=row]");
        const c = header
          ? Number(header.getAttribute("aria-colindex")) - 2
          : (p?.c ?? -1);
        if (!p && !header && !row) return;
        e.preventDefault();
        contextTarget.current =
          target.closest<HTMLElement>('[role="gridcell"]');
        if (
          p &&
          (!bounds ||
            p.r < bounds.r1 ||
            p.r > bounds.r2 ||
            p.c < bounds.c1 ||
            p.c > bounds.c2)
        ) {
          setAnchor(p);
          setEnd(p);
        }
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
          style={menuPosition}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              closeMenu(true);
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const items = [
                ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ),
              ];
              const index = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? items.length - 1
                    : (index +
                        (e.key === "ArrowDown" ? 1 : -1) +
                        items.length) %
                      items.length;
              items[next]?.focus();
            }
            if (e.key === "Tab") closeMenu();
          }}
        >
          {menu.r >= 0 && menu.c >= 0 && (
            <>
              <button
                role="menuitem"
                tabIndex={-1}
                aria-keyshortcuts="Control+C Meta+C"
                onClick={() => void clipboardAction("copy")}
              >
                Copy <kbd>{shortcut}C</kbd>
              </button>
              <button
                role="menuitem"
                tabIndex={-1}
                aria-keyshortcuts="Control+V Meta+V"
                disabled={!isValueColumn(menu.c)}
                onClick={() => void clipboardAction("paste")}
              >
                Paste <kbd>{shortcut}V</kbd>
              </button>
              <hr />
            </>
          )}
          <button
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onAddRow();
              setMenu(null);
            }}
          >
            Add row
          </button>
          <button
            role="menuitem"
            tabIndex={-1}
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
                tabIndex={-1}
                onClick={() => void relativeRow("before")}
              >
                Insert row above
              </button>
              <button
                role="menuitem"
                tabIndex={-1}
                onClick={() => void relativeRow("after")}
              >
                Insert row below
              </button>
              <button
                role="menuitem"
                tabIndex={-1}
                onClick={() => void relativeRow("after", true)}
              >
                Duplicate row
              </button>
            </>
          )}
          {bounds && bounds.r2 > bounds.r1 && (
            <button
              role="menuitem"
              tabIndex={-1}
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
              tabIndex={-1}
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
          {view.columnKinds[menu.c] === "field" && (
            <>
              <button
                role="menuitem"
                tabIndex={-1}
                onClick={() => void columnAction(true)}
              >
                Rename column…
              </button>
              <button
                role="menuitem"
                tabIndex={-1}
                onClick={() => void columnAction(false)}
              >
                Delete column
              </button>
            </>
          )}
          <button role="menuitem" tabIndex={-1} onClick={() => closeMenu(true)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
