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
                <th>Key / index</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.key}</th>
                  <td>{row.value}</td>
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
