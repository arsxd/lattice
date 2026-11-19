/** Shared header glyphs for the regular and merged-cell sheet renderers. */
export function ColumnMenuChevron({
  filtered = false,
}: {
  filtered?: boolean;
}) {
  if (filtered)
    return (
      <svg
        className="active-filter-icon"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 3h12L9 8v5l-2-1V8Z" />
      </svg>
    );
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}
