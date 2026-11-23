import { useEffect, useRef } from "react";
import type { Projection, Query } from "../document/engine";
import { columnLabel } from "./columnRoles";
export type ColumnFilterSummary = { column: number; label: string; description: string };
export function columnFilterSummaries(query: Query, view: Projection | null): ColumnFilterSummary[] {
  if (!view) return [];
  const keys = new Set([...Object.keys(query.filters ?? {}), ...Object.keys(query.valueFilters ?? {})]);
  const describe = (key: string) => {
    try {
      const value: unknown = JSON.parse(key);
      if (Array.isArray(value) && typeof value[0] === "string" && typeof value[1] === "string") {
        if (value[0] === "missing") return "Not set";
        if (value[0] === "null") return "Null";
        return value[1] === "" ? "Empty text" : value[1].slice(0, 80) + (value[1].length > 80 ? "…" : "");
      }
    } catch { /* Legacy filter text is still readable. */ }
    return key.slice(0, 80);
  };
  return [...keys].map(Number).filter(column => Number.isInteger(column) && column >= 0 && column < view.headers.length)
    .sort((a, b) => a - b).flatMap(column => {
      const text = query.filters?.[String(column)];
      const values = query.valueFilters?.[String(column)];
      if (!text && values === undefined) return [];
      const selected = values === undefined ? "" : values.length
        ? values.slice(0, 3).map(describe).join(", ") + (values.length > 3 ? `, +${values.length - 3} more` : "")
        : "No values selected";
      return [{ column, label: columnLabel(view, column), description: [text ? `Contains “${text.slice(0, 80)}”` : "", selected].filter(Boolean).join(" · ") }];
    });
}
export function ActiveFilters({ filters, disabled, onClear, onClearAll }: {
  filters: ColumnFilterSummary[]; disabled: boolean;
  onClear: (column: number) => void; onClearAll: () => void;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && root.current) root.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && root.current?.open) {
        root.current.open = false;
        root.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  if (!filters.length) return null;
  return <div className="table-state-control"><details className="active-filters" ref={root}>
    <summary aria-label={`${filters.length} active column ${filters.length === 1 ? "filter" : "filters"}`} title="Inspect or clear active column filters">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h12L9 8v5l-2-1V8Z"/></svg>
      Filters · {filters.length}
    </summary>
    <section className="active-filters-panel" aria-label="Active column filters">
      <div className="active-filters-heading">Active filters</div>
      <div className="active-filters-list">{filters.map(filter => <div className="active-filter-row" key={filter.column}>
        <div><strong>{filter.label}</strong><p>{filter.description}</p></div>
        <button type="button" disabled={disabled} aria-label={`Clear filter for ${filter.label}`} onClick={() => onClear(filter.column)}>Clear</button>
      </div>)}</div>
      <div className="active-filters-footer"><button type="button" disabled={disabled} onClick={onClearAll}>Clear all filters</button></div>
    </section>
  </details><button type="button" disabled={disabled} onClick={onClearAll} aria-label="Clear all filters" title="Clear all filters">×</button></div>;
}
