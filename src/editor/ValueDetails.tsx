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
          <table aria-label="Selected value contents">
            <thead>
              <tr>
                {preview.headers.map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.cells.map((row, index) => (
                <tr key={index}>
                  {row.map((value, column) =>
                    column === 0 ? (
                      <th key={column} scope="row">
                        {value}
                      </th>
                    ) : (
                      <td key={column}>{value}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
