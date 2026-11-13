import { useMemo } from "react";
import { objectPreview } from "./objectPreview";
export function ValueDetails({ raw }: { raw: string }) {
  const preview = useMemo(() => objectPreview(raw), [raw]);
  if (!preview) return null;
  return (
    <div className="details-preview">
      <label>Contents</label>
      {preview.total ? (
        <>
          <div
            className="details-table-scroll"
            role="region"
            aria-label="Contents preview"
            tabIndex={0}
          >
            <table
              aria-label="Selected value contents"
              style={{
                width: "100%",
                minWidth:
                  preview.headers.length > 2
                    ? 104 + (preview.headers.length - 1) * 160
                    : 300,
              }}
            >
              <colgroup>
                {preview.headers.map((_, index) => (
                  <col
                    key={index}
                    style={{
                      width:
                        index === 0
                          ? 104
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
