import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Projection, AtomicMutation } from "../document/engine";
import {
  axisSelected,
  selectCell,
  selectHeader,
  selectedCellCount,
  selectionContains,
  type SheetPoint,
  type SheetSelection,
} from "../document/sheetSelection";
import { fieldColumnKey } from "./columnRoles";
export function SheetRange({
  view,
  children,
  selection,
  onSelectionChange,
  copy,
  paste,
  fill,
  apply,
  onAddRow,
  onAddColumn,
  isValueColumn,
}: {
  view: Projection;
  children: ReactNode;
  selection: SheetSelection | null;
  onSelectionChange: (selection: SheetSelection | null) => void;
  copy: (selection: SheetSelection) => Promise<string>;
  paste: (selection: SheetSelection, text: string) => Promise<void>;
  fill: (selection: SheetSelection) => Promise<void>;
  apply: (ops: AtomicMutation[]) => Promise<void>;
  onAddRow: () => void;
  onAddColumn: () => void;
  isValueColumn: (column: number) => boolean;
}) {
  const [message, setMessage] = useState("");
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    r: number;
    c: number;
  } | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 8, top: 8 });
  const menuElement = useRef<HTMLDivElement>(null),
    contextTarget = useRef<HTMLElement | null>(null);
  const restoringFocus = useRef(false),
    contextOpening = useRef(false),
    dragging = useRef(false),
    clipboardBusy = useRef(false);
  const clip = useRef(""),
    ready = useRef(false),
    copyError = useRef("");
  const shortcut = navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl+";
  const offset = view.page * 500;
  const key = JSON.stringify(selection);
  function choose(next: SheetSelection | null) {
    ready.current = false;
    clip.current = "";
    copyError.current = "";
    setMessage("");
    onSelectionChange(next);
  }
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
  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  useEffect(() => {
    setMenu(null);
    setMessage("");
  }, [view]);
  useEffect(() => {
    let cancelled = false;
    ready.current = false;
    clip.current = "";
    copyError.current = "";
    setMessage("");
    if (
      selection &&
      selectedCellCount(selection, view.matched, view.headers.length) <= 10000
    )
      void copy(selection)
        .then((text) => {
          if (!cancelled) {
            clip.current = text;
            ready.current = true;
            setMessage((previous) =>
              previous.startsWith("Preparing selection") ? "" : previous,
            );
          }
        })
        .catch((error) => {
          if (!cancelled)
            copyError.current =
              error instanceof Error ? error.message : String(error);
        });
    return () => {
      cancelled = true;
    };
  }, [key, view]);
  function point(target: EventTarget | null): SheetPoint | null {
    if (!(target instanceof Element)) return null;
    const cell = target.closest('[role="gridcell"]'),
      row = cell?.closest('[role="row"]');
    if (!cell || !row) return null;
    const c = Number(cell.getAttribute("aria-colindex")) - 2,
      r = Number(row.getAttribute("aria-rowindex")) - 2;
    return c >= 0 && r >= 0 ? { r: r + offset, c } : null;
  }
  async function perform(action: "paste" | "fill", text = "") {
    if (!selection) return;
    try {
      if (action === "paste") await paste(selection, text);
      else await fill(selection);
      setMessage(
        action === "paste"
          ? "Pasted. Undo restores the entire selection."
          : "Filled down. Undo restores the selection.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }
  async function clipboardAction(action: "copy" | "paste") {
    if (!selection || clipboardBusy.current) return;
    clipboardBusy.current = true;
    closeMenu(true);
    try {
      if (action === "copy") {
        const text = ready.current ? clip.current : await copy(selection);
        try {
          await navigator.clipboard.writeText(text);
          setMessage("");
        } catch {
          setMessage(
            `Clipboard access is unavailable. Use ${shortcut}C instead.`,
          );
        }
      } else {
        let text: string;
        try {
          text = await navigator.clipboard.readText();
        } catch {
          setMessage(
            `Clipboard access is unavailable. Use ${shortcut}V instead.`,
          );
          return;
        }
        await perform("paste", text);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      clipboardBusy.current = false;
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
  if (selection?.mode === "columns")
    for (const [a, b] of selection.spans)
      selectors.push(
        `.range-sheet [role=row] [role=gridcell]:nth-child(n+${a + 2}):nth-child(-n+${b + 2})`,
      );
  else if (selection)
    for (let r = 0; r < view.rows.length; r++) {
      const columns = Array.from(
        { length: view.headers.length },
        (_, c) => c,
      ).filter((c) =>
        selectionContains(
          selection,
          { r: r + offset, c },
          view.matched,
          view.headers.length,
        ),
      );
      if (columns.length)
        selectors.push(
          `.range-sheet [role=row][aria-rowindex="${r + 2}"] [role=gridcell]:nth-child(n+${columns[0] + 2}):nth-child(-n+${columns.at(-1)! + 2})`,
        );
    }
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
        if (
          p &&
          (!selection ||
            p.r !== selection.anchor.r ||
            p.c !== selection.anchor.c)
        )
          choose(selectCell(null, p));
      }}
      onPointerDownCapture={(e) => {
        contextOpening.current = e.button === 2;
        if (e.button !== 0) return;
        if ((e.target as Element).closest("input,textarea,[data-row-resizer]"))
          return;
        const p = point(e.target);
        if (!p) return;
        setMenu(null);
        choose(selectCell(selection, p, e.shiftKey));
        dragging.current = true;
        if (e.shiftKey) e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (dragging.current) {
          const p = point(e.target);
          if (p) choose(selectCell(selection, p, true));
        }
      }}
      onKeyDownCapture={(e) => {
        if ((e.target as Element).closest("input,textarea,[data-row-resizer]"))
          return;
        const active = selection?.anchor ?? point(e.target);
        if (!active) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          e.stopPropagation();
          choose(
            selectCell(
              selectCell(null, { r: 0, c: 0 }),
              { r: Math.max(0, view.matched - 1), c: view.headers.length - 1 },
              true,
            ),
          );
          return;
        }
        if (e.key === " " && (e.ctrlKey || e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          choose(
            selectHeader(selection, e.ctrlKey ? "columns" : "rows", active),
          );
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
          e.preventDefault();
          e.stopPropagation();
          void perform("fill");
          return;
        }
        if (e.shiftKey && selection && e.key.startsWith("Arrow")) {
          e.preventDefault();
          e.stopPropagation();
          const end = {
            r: Math.max(
              0,
              Math.min(
                view.matched - 1,
                selection.end.r +
                  (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
              ),
            ),
            c: Math.max(
              0,
              Math.min(
                view.headers.length - 1,
                selection.end.c +
                  (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0),
              ),
            ),
          };
          choose(
            selection.mode === "cells"
              ? selectCell(selection, end, true)
              : selectHeader(selection, selection.mode, end, { extend: true }),
          );
        }
      }}
      onCopyCapture={(e) => {
        if ((e.target as Element).closest("input,textarea,[data-row-resizer]"))
          return;
        if (!selection) return;
        e.preventDefault();
        if (ready.current) e.clipboardData.setData("text/plain", clip.current);
        else
          setMessage(
            copyError.current ||
              (selectedCellCount(selection, view.matched, view.headers.length) >
              10000
                ? "Select at most 10,000 cells for clipboard operations."
                : "Preparing selection. Copy again in a moment."),
          );
      }}
      onPasteCapture={(e) => {
        if ((e.target as Element).closest("input,textarea,[data-row-resizer]"))
          return;
        e.preventDefault();
        void perform("paste", e.clipboardData.getData("text/plain"));
      }}
      onContextMenu={(e) => {
        contextOpening.current = false;
        const target = e.target as Element;
        if (target.closest("input,textarea,[data-row-resizer]")) return;
        const p = point(target),
          header = target.closest("[role=columnheader]"),
          row = target.closest("[role=row]");
        const c = header
          ? Number(header.getAttribute("aria-colindex")) - 2
          : (p?.c ?? -1);
        if (!p && !header && !row) return;
        e.preventDefault();
        contextTarget.current =
          target.closest<HTMLElement>('[role="gridcell"]') ??
          header?.querySelector<HTMLElement>("button") ??
          null;
        if (
          p &&
          !selectionContains(selection, p, view.matched, view.headers.length)
        )
          choose(selectCell(null, p));
        else if (header && c >= 0 && !axisSelected(selection, "columns", c))
          choose(selectHeader(null, "columns", { r: offset, c }));
        else if (!p && !header && row) {
          const r = Number(row.getAttribute("aria-rowindex")) - 2;
          if (r >= 0 && !axisSelected(selection, "rows", r + offset))
            choose(selectHeader(null, "rows", { r: r + offset, c: 0 }));
        }
        setMenu({
          x: e.clientX,
          y: e.clientY,
          r: p ? p.r - offset : Number(row?.getAttribute("aria-rowindex")) - 2,
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
          {(menu.r >= 0 || menu.c >= 0) && selection && (
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
          {selection &&
            selectedCellCount(selection, view.matched, view.headers.length) >
              view.headers.length && (
              <button
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  void perform("fill");
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
