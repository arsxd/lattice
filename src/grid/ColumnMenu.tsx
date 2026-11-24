import { useEffect, useState, useRef, useLayoutEffect } from "react";
export function ColumnMenu({
  name,
  anchor,
  load,
  selected,
  onApply,
  onSort,
  onClose,
}: {
  name: string;
  anchor: HTMLElement | null;
  load: () => Promise<{
    options: { key: string; label: string }[];
    truncated: boolean;
  }>;
  selected?: string[];
  onApply: (keys: string[] | undefined) => void;
  onSort: (direction: "ASC" | "DESC" | undefined) => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    maxHeight?: number;
  }>({ left: 8, top: 8 });
  useLayoutEffect(() => {
    // Choose below or above the arrow once. The list loads after opening and
    // changes the height, so deciding from the current height made the menu
    // jump over the header. Above, it is pinned by its bottom edge instead.
    let side: "below" | "above" | undefined;
    const place = (decide = false) => {
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = panel.current?.offsetWidth ?? 300;
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      if (!side || decide)
        side = below >= 440 || below >= above ? "below" : "above";
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - width - 8),
      );
      setPosition(
        side === "below"
          ? { left, top: rect.bottom + 4, maxHeight: Math.max(120, below) }
          : {
              left,
              bottom: window.innerHeight - rect.top + 4,
              maxHeight: Math.max(120, above),
            },
      );
    };
    place(true);
    const onResize = () => place(true);
    const onScroll = () => place();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    const outside = (e: PointerEvent) => {
      if (
        e.target instanceof Node &&
        !panel.current?.contains(e.target) &&
        !anchor?.contains(e.target)
      )
        onClose();
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", outside);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- onClose only closes the menu; listeners attach once per anchor
  }, [anchor]);
  const [options, setOptions] = useState<{ key: string; label: string }[]>([]),
    [chosen, setChosen] = useState(new Set(selected)),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [truncated, setTruncated] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    load()
      .then((result) => {
        if (!live) return;
        setOptions(result.options);
        setTruncated(result.truncated);
        if (selected === undefined)
          setChosen(new Set(result.options.map((v) => v.key)));
        setLoading(false);
      })
      .catch((e) => {
        if (live) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- load once per mount; the parent remounts the menu per column
  }, []);
  const visible = options.filter((v) =>
    v.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog handles Escape and Tab for its own controls
    <section
      ref={panel}
      style={{
        left: position.left,
        top: position.top ?? "auto",
        bottom: position.bottom,
        maxHeight: position.maxHeight,
      }}
      className="column-menu"
      role="dialog"
      aria-label={`Sort and filter ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
          anchor?.focus();
        }
      }}
    >
      <strong>{name}</strong>
      <button onClick={() => onSort("ASC")}>Sort ascending ↑</button>
      <button onClick={() => onSort("DESC")}>Sort descending ↓</button>
      <button onClick={() => onSort(undefined)}>Clear sort</button>
      <button onClick={() => onApply(undefined)}>Clear column filter</button>
      <input
        autoFocus
        aria-label="Search filter values"
        placeholder="Search values…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading ? (
        <span>Loading values…</span>
      ) : (
        <>
          <div className="filter-button-row">
            <button
              onClick={() =>
                setChosen(new Set([...chosen, ...visible.map((v) => v.key)]))
              }
            >
              Select shown
            </button>
            <button
              onClick={() =>
                setChosen(
                  new Set(
                    [...chosen].filter(
                      (k) => !visible.some((v) => v.key === k),
                    ),
                  ),
                )
              }
            >
              Deselect shown
            </button>
          </div>
          <div className="filter-values">
            {visible.map((v) => (
              <label key={v.key}>
                <input
                  type="checkbox"
                  checked={chosen.has(v.key)}
                  onChange={(e) => {
                    const next = new Set(chosen);
                    if (e.target.checked) next.add(v.key);
                    else next.delete(v.key);
                    setChosen(next);
                  }}
                />
                <span title={v.label}>{v.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
      {truncated && (
        <span>
          First 2,000 distinct values shown. Clear the filter to include all
          values.
        </span>
      )}
      {error && <span role="alert">{error}</span>}
      <div className="filter-button-row">
        <button
          disabled={loading || !!error}
          onClick={() =>
            onApply(
              !truncated && chosen.size === options.length
                ? undefined
                : [...chosen],
            )
          }
        >
          Apply filter
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </section>
  );
}
