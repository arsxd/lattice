import { useMemo, type ReactNode } from "react";
import { objectPreview } from "./objectPreview";
export function ValueDetails({
  raw,
  action,
}: {
  raw: string;
  action?: ReactNode;
}) {
  const preview = useMemo(() => objectPreview(raw), [raw]);
  if (!preview && !action) return null;
  return (
    <div className="details-preview">
      <div className="details-preview-heading">
        <h3>Contents</h3>
        {action}
      </div>
      {!preview ? (
        <p className="small">
          Preview unavailable. Open as table to browse this value.
        </p>
      ) : preview.total ? (
        <>
          <div
            className="details-table-scroll"
            role="region"
            aria-label="Contents preview"
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-focusable
            tabIndex={0}
          >
            <table
              aria-label="Selected value contents"
              style={{
                width: "100%",
                minWidth:
                  preview.headers.length > 2
                    ? 104 + (preview.headers.length - 1) * 160
                    : undefined,
              }}
            >
              <colgroup>
                {preview.headers.map((_, index) => (
                  <col
                    key={index}
                    style={{
                      width:
                        index === 0
                          ? preview.headers.length > 2
                            ? 104
                            : "34%"
                          : preview.headers.length > 2
                            ? 160
                            : undefined,
                    }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {preview.headers.map((header, index) => (
                    <th key={index} title={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.cells.map((row, index) => (
                  <tr key={index}>
                    {row.map((value, column) =>
                      column === 0 ? (
                        <th key={column} scope="row">
                          <span className="details-cell" title={value}>
                            {value}
                          </span>
                        </th>
                      ) : (
                        <td key={column}>
                          <span className="details-cell" title={value}>
                            {value}
                          </span>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total > preview.rows.length && (
            <p className="small">
              Showing {preview.rows.length} of {preview.total} entries. Open
              table to browse all.
            </p>
          )}
        </>
      ) : (
        <p className="muted">Empty collection</p>
      )}
    </div>
  );
}
