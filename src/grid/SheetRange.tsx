import { placeAtPoint, type Placement } from "./popupPlacement";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import type { Projection, AtomicMutation, Path } from "../document/engine";
import {
  axisSelected,
  selectCell,
  selectWholeTable,
  selectHeader,
  selectedCellCount,
  selectionContains,
  type SheetPoint,
  type SheetSelection,
} from "../document/sheetSelection";
import { fieldColumnKey, columnLabel, nestedTablePath } from "./columnRoles";
import { MnemonicLabel, mnemonicLetter } from "./MnemonicLabel";
function MenuItem({
  label,
  mnemonic,
  requiresShift = false,
  shortcuts = "",
  children,
  onClick,
}: {
  label: string;
  mnemonic: string;
  requiresShift?: boolean;
  shortcuts?: string;
  children?: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-label={label}
      aria-keyshortcuts={[
        requiresShift ? `Shift+${mnemonic}` : mnemonic,
        shortcuts,
      ]
        .filter(Boolean)
        .join(" ")}
      data-mnemonic={mnemonic}
      data-requires-shift={requiresShift || undefined}
      onClick={onClick}
    >
      <MnemonicLabel label={label} letter={mnemonic} />
      {requiresShift ? <kbd>Shift+{mnemonic}</kbd> : children}
    </button>
  );
}

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
  showIndex,
  onToggleIndex,
  onOpenTable,
}: {
  showIndex?: boolean;
  onToggleIndex?: () => void;
  onOpenTable?: (path: Path) => void;
  view: Projection;
  children: ReactNode;
  selection: SheetSelection | null;
  onSelectionChange: (selection: SheetSelection | null) => void;
  copy: (selection: SheetSelection) => Promise<string>;
  paste: (selection: SheetSelection, text: string) => Promise<void>;
  fill: (selection: SheetSelection) => Promise<void>;
  apply: (ops: AtomicMutation[]) => Promise<void>;
  onAddRow?: () => void;
  onAddColumn?: () => void;
  isValueColumn: (column: number) => boolean;
}) {
  const [message, setMessage] = useState("");
  const [showMenuKeys, setShowMenuKeys] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    r: number;
    c: number;
    titleOnly?: boolean;
  } | null>(null);
  const [menuPosition, setMenuPosition] = useState<Placement>({
    left: 8,
    top: 8,
    maxHeight: 0,
  });
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
    // Measure at natural size, decide the side once, then stay put.
    const node = menuElement.current;
    node.style.maxHeight = "none";
    const { width, height } = node.getBoundingClientRect();
    node.style.maxHeight = "";
    setMenuPosition(
      placeAtPoint(
        { x: menu.x, y: menu.y },
        { width, height },
        { width: innerWidth, height: innerHeight },
      ),
    );
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
    const hideKeys = () => setShowMenuKeys(false);
    const releaseAlt = (event: KeyboardEvent) => {
      if (!event.altKey) hideKeys();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    window.addEventListener("keyup", releaseAlt);
    window.addEventListener("blur", hideKeys);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("keyup", releaseAlt);
      window.removeEventListener("blur", hideKeys);
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- key identifies the selection; copy is recreated every render
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
  async function copyName(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMenu(null);
    } catch {
      setMessage(
        "Clipboard access is unavailable. Select the name in the value bar and press " +
          shortcut +
          "C.",
      );
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
  const rowMenu = menu !== null && menu.r >= 0 && menu.c < 0;
  const columnMenu = menu !== null && menu.r < 0 && menu.c >= 0;
  const menuTablePath = menu
    ? nestedTablePath(
        view.rows[menu.r]?.cells[menu.c],
        view.columnKinds[menu.c],
      )
    : undefined;
  const showIndexAction = columnMenu && view.kind === "array" && onToggleIndex;
  const columnFieldAction = columnMenu && view.columnKinds[menu.c] === "field";

  const selectors: string[] = [];
  const edgeRules: string[] = [];
  const axisSelection =
    selection?.mode === "rows" || selection?.mode === "columns";
  const gridRow = ".range-sheet .data-grid [role=row]";
  const rowNumberCell = '[role=gridcell][aria-colindex="1"]';
  const columnCell = (c: number) => `[role=gridcell][aria-colindex="${c + 2}"]`;
  const rowAt = (r: number) => `${gridRow}[aria-rowindex="${r - offset + 2}"]`;
  const edge = (selector: string, side: "top" | "right" | "bottom" | "left") =>
    edgeRules.push(
      side === "bottom"
        ? `${selector}{--range-bottom-border:var(--accent)}`
        : `${selector}{--range-${side}:1px}`,
    );
  const columnHeader = (c: number) =>
    `.range-sheet .sheet-header-selected[aria-colindex="${c + 2}"]`;
  if (selection?.mode === "columns") {
    for (const [a, b] of selection.spans) {
      for (let c = a; c <= b; c++) {
        edge(columnHeader(c), "top");
        if (view.rows.length) {
          selectors.push(`${gridRow} ${columnCell(c)}`);
          edge(
            `${rowAt(offset + view.rows.length - 1)} ${columnCell(c)}`,
            "bottom",
          );
        } else {
          edge(columnHeader(c), "bottom");
        }
      }
      edge(`${columnHeader(a)},${gridRow} ${columnCell(a)}`, "left");
      edge(`${columnHeader(b)},${gridRow} ${columnCell(b)}`, "right");
    }
  } else if (selection?.mode === "rows" && view.headers.length) {
    for (const [a, b] of selection.spans) {
      const first = Math.max(a, offset);
      const last = Math.min(b, offset + view.rows.length - 1);
      if (first > last) continue;
      edge(`${rowAt(first)} [role=gridcell]`, "top");
      edge(`${rowAt(last)} [role=gridcell]`, "bottom");
      for (let r = first; r <= last; r++) {
        selectors.push(`${rowAt(r)} [role=gridcell]`);
        edge(`${rowAt(r)} ${rowNumberCell}`, "left");
        edge(`${rowAt(r)} ${columnCell(view.headers.length - 1)}`, "right");
      }
    }
  } else if (selection?.mode === "cells")
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
      data-axis-selection={axisSelection || undefined}
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
        if (
          (e.target as Element).closest(
            "input,textarea,[data-row-resizer],.cell-open-table",
          )
        )
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
          choose(selectWholeTable(view.matched, view.headers.length, offset));
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
        const titleOnly = !!target.closest("[data-column-title]");
        const c = header
          ? Number(header.getAttribute("aria-colindex")) - 2
          : (p?.c ?? -1);
        const r = p
          ? p.r - offset
          : Number(row?.getAttribute("aria-rowindex")) - 2;
        if ((!p && !header && !row) || (r < 0 && c < 0)) return;
        e.preventDefault();
        contextTarget.current =
          target.closest<HTMLElement>('[role="gridcell"]') ??
          (titleOnly
            ? target.closest<HTMLElement>("[data-column-title]")
            : header?.querySelector<HTMLElement>("button")) ??
          null;
        if (
          p &&
          !selectionContains(selection, p, view.matched, view.headers.length)
        )
          choose(selectCell(null, p));
        else if (
          header &&
          !titleOnly &&
          c >= 0 &&
          !axisSelected(selection, "columns", c)
        )
          choose(selectHeader(null, "columns", { r: offset, c }));
        else if (!p && !header && row) {
          if (r >= 0 && !axisSelected(selection, "rows", r + offset))
            choose(selectHeader(null, "rows", { r: r + offset, c: 0 }));
        }
        setShowMenuKeys(e.altKey);
        setMenu({
          x: e.clientX,
          y: e.clientY,
          r,
          c,
          titleOnly,
        });
      }}
    >
      {(selectors.length > 0 || edgeRules.length > 0) && (
        <style>
          {selectors.length > 0 &&
            selectors.join(",") +
              (axisSelection
                ? "{background-color:var(--selection);--range-divider:color-mix(in srgb,var(--rdg-border-color),var(--accent) 25%);}"
                : "{background-color:var(--selection);}")}
          {edgeRules.join("")}
        </style>
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
          data-show-mnemonics={showMenuKeys || undefined}
          role="menu"
          tabIndex={-1}
          style={{
            left: menuPosition.left,
            top: menuPosition.top ?? "auto",
            bottom: menuPosition.bottom,
            maxHeight: menuPosition.maxHeight || undefined,
          }}
          onKeyDown={(e) => {
            if (e.key === "Alt" && !e.ctrlKey && !e.metaKey) {
              e.stopPropagation();
              setShowMenuKeys(true);
              return;
            }
            if (
              !e.ctrlKey &&
              !e.metaKey &&
              !e.altKey &&
              !e.nativeEvent.isComposing
            ) {
              const letter = mnemonicLetter(e);
              if (letter) {
                const item = e.currentTarget.querySelector<HTMLButtonElement>(
                  `button[data-mnemonic="${letter}"]:not(:disabled)`,
                );
                if (
                  item &&
                  e.shiftKey === item.hasAttribute("data-requires-shift")
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!e.repeat) item.click();
                  return;
                }
              }
            }
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
          {menu.titleOnly && (
            <MenuItem
              label="Copy"
              mnemonic="C"
              shortcuts="Control+C Meta+C"
              onClick={() => void copyName(columnLabel(view, menu.c))}
            >
              <kbd>{shortcut}C</kbd>
            </MenuItem>
          )}
          {!menu.titleOnly && (menu.r >= 0 || menu.c >= 0) && selection && (
            <>
              <MenuItem
                label="Copy"
                mnemonic="C"
                shortcuts="Control+C Meta+C"
                onClick={() => void clipboardAction("copy")}
              >
                <kbd>{shortcut}C</kbd>
              </MenuItem>
              {isValueColumn(menu.c) && (
                <MenuItem
                  label="Paste"
                  mnemonic="P"
                  shortcuts="Control+V Meta+V"
                  onClick={() => void clipboardAction("paste")}
                >
                  <kbd>{shortcut}V</kbd>
                </MenuItem>
              )}
            </>
          )}
          {(rowMenu ||
            (columnMenu && !menu.titleOnly) ||
            columnFieldAction ||
            (columnMenu && onAddColumn) ||
            showIndexAction ||
            (menuTablePath && onOpenTable)) && <hr />}
          {showIndexAction && (
            <MenuItem
              label={showIndex ? "Hide original index" : "Show original index"}
              mnemonic="I"
              onClick={() => {
                showIndexAction();
                closeMenu();
              }}
            />
          )}
          {menuTablePath && onOpenTable && (
            <MenuItem
              label="Open as table"
              mnemonic="O"
              onClick={() => {
                onOpenTable(menuTablePath);
                closeMenu();
              }}
            />
          )}
          {rowMenu && view.recordsAvailable && onOpenTable && (
            <MenuItem
              label="Open row"
              mnemonic="O"
              onClick={() => {
                onOpenTable(view.rows[menu.r].path);
                closeMenu();
              }}
            />
          )}
          {rowMenu && (
            <>
              {onAddRow && (
                <MenuItem
                  label="Append row"
                  mnemonic="A"
                  onClick={() => {
                    closeMenu();
                    onAddRow();
                  }}
                />
              )}
              <MenuItem
                label="Insert row above"
                mnemonic="V"
                onClick={() => void relativeRow("before")}
              />
              <MenuItem
                label="Insert row below"
                mnemonic="B"
                onClick={() => void relativeRow("after")}
              />
              <MenuItem
                label="Duplicate row"
                mnemonic="D"
                onClick={() => void relativeRow("after", true)}
              />
            </>
          )}
          {selection &&
            selectedCellCount(selection, view.matched, view.headers.length) >
              view.headers.length && (
              <MenuItem
                label="Fill down"
                mnemonic="F"
                onClick={() => {
                  void perform("fill");
                  setMenu(null);
                }}
              />
            )}
          {rowMenu && (
            <MenuItem
              label="Delete row"
              mnemonic="E"
              requiresShift
              onClick={() => {
                void apply([
                  { action: "remove", path: view.rows[menu.r].path },
                ]).catch((e) => setMessage(String(e)));
                setMenu(null);
              }}
            />
          )}
          {rowMenu && view.kind === "object" && (
            <MenuItem
              label="Copy row name"
              mnemonic="M"
              onClick={() => void copyName(view.rows[menu.r].label)}
            />
          )}
          {columnMenu && !menu.titleOnly && (
            <MenuItem
              label="Copy column name"
              mnemonic="N"
              onClick={() => void copyName(columnLabel(view, menu.c))}
            />
          )}
          {columnMenu && onAddColumn && (
            <MenuItem
              label="Add column"
              mnemonic="A"
              onClick={() => {
                closeMenu();
                onAddColumn();
              }}
            />
          )}
          {columnFieldAction && (
            <>
              <MenuItem
                label="Rename column…"
                mnemonic="R"
                onClick={() => void columnAction(true)}
              />
              <MenuItem
                label="Delete column"
                mnemonic="E"
                requiresShift
                onClick={() => void columnAction(false)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
