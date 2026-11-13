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
  const [position, setPosition] = useState({ left: 8, top: 8 });
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const height = panel.current?.offsetHeight ?? 400;
      const width = panel.current?.offsetWidth ?? 300;
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top:
          rect.bottom + height + 8 <= window.innerHeight
            ? rect.bottom + 4
            : Math.max(8, rect.top - height - 4),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
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
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
    };
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
  }, []);
  const visible = options.filter((v) =>
    v.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <section
      ref={panel}
      style={{ left: position.left, top: position.top }}
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
