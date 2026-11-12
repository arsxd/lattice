import type { Key } from "react";
import { Row, type RenderRowProps } from "react-data-grid";

export const MAX_FROZEN_RENDERED_CELLS = 10_000;
export type FrozenRowGeometry = {
  rowHeights: readonly number[];
  /** Includes generated columns and the row-selection gutter. */
  columnCount: number;
  frozenCount: number;
  headerHeight: number;
  viewportHeight: number;
};
export type FrozenRowLayout = {
  allowed: boolean;
  reason?: string;
  offsets: number[];
  frozenHeight: number;
  enableVirtualization: boolean;
};
/** RDG does not retain frozen rows during virtualization; this bounded mode uses its public Row renderer. */
export function frozenRowLayout(geometry: FrozenRowGeometry): FrozenRowLayout {
  const { rowHeights, columnCount, frozenCount, headerHeight, viewportHeight } =
    geometry;
  const reject = (reason: string): FrozenRowLayout => ({
    allowed: false,
    reason,
    offsets: [],
    frozenHeight: 0,
    enableVirtualization: true,
  });
  if (frozenCount === 0)
    return {
      allowed: true,
      offsets: [],
      frozenHeight: 0,
      enableVirtualization: true,
    };
  if (
    !Number.isInteger(frozenCount) ||
    frozenCount < 0 ||
    frozenCount > rowHeights.length ||
    !Number.isInteger(columnCount) ||
    columnCount < 1 ||
    !Number.isFinite(headerHeight) ||
    headerHeight < 0 ||
    !Number.isFinite(viewportHeight) ||
    viewportHeight <= 0 ||
    rowHeights.some((height) => !Number.isFinite(height) || height <= 0)
  )
    return reject(
      "Row freezing is unavailable until the grid has valid measured dimensions.",
    );
  if (rowHeights.length * columnCount > MAX_FROZEN_RENDERED_CELLS)
    return reject(
      "Row freezing supports up to 10,000 rendered cells per page, including the row gutter. Column freezing remains available.",
    );
  const offsets: number[] = [];
  let frozenHeight = 0;
  for (const height of rowHeights.slice(0, frozenCount)) {
    offsets.push(headerHeight + frozenHeight);
    frozenHeight += height;
  }
  if (frozenHeight > viewportHeight * 0.4)
    return reject(
      "Frozen rows must occupy at most 40% of the grid height. Column freezing remains available.",
    );
  return { allowed: true, offsets, frozenHeight, enableVirtualization: false };
}
export function frozenRowRenderers<R, SR = unknown>(layout: FrozenRowLayout) {
  return {
    renderRow(key: Key, props: RenderRowProps<R, SR>) {
      const top = layout.offsets[props.rowIdx];
      return (
        <Row
          key={key}
          {...props}
          style={
            top === undefined
              ? undefined
              : {
                  position: "sticky",
                  top,
                  zIndex: 2,
                  backgroundColor: "var(--rdg-background-color)",
                }
          }
        />
      );
    },
  };
}
