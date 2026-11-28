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

export function TableIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 12h16M12 4v16" />
    </svg>
  );
}
