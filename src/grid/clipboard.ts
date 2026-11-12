export function parseTSV(text: string): string[][] {
  const rows: string[][] = [[]];
  let field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && (quoted || field === "")) {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "\t" || c === "\n" || c === "\r")) {
      rows.at(-1)!.push(field);
      field = "";
      if (c !== "\t") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        rows.push([]);
      }
    } else field += c;
  }
  if (quoted) throw Error("Clipboard contains an unfinished quoted cell.");
  rows.at(-1)!.push(field);
  if (rows.length > 1 && rows.at(-1)!.length === 1 && rows.at(-1)![0] === "")
    rows.pop();
  if (rows.some((r) => r.length !== rows[0].length))
    throw Error("Paste a rectangular selection.");
  return rows;
}
export function toTSV(rows: string[][]) {
  return rows
    .map((r) =>
      r
        .map((v) =>
          /[\t\r\n"]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v,
        )
        .join("\t"),
    )
    .join("\r\n");
}

export type CellRange = { r1: number; r2: number; c1: number; c2: number };
export async function readRange(
  view: Pick<import("../document/engine").Projection, "rows" | "headers">,
  bounds: CellRange,
  read: (path: import("../document/engine").Path) => Promise<string>,
): Promise<string> {
  if ((bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1) > 10000)
    throw new Error("Copy at most 10,000 cells.");
  const result: string[][] = [];
  for (let r = bounds.r1; r <= bounds.r2; r++) {
    const row: string[] = [];
    for (let c = bounds.c1; c <= bounds.c2; c++) {
      const cell = view.rows[r]?.cells[c];
      if (!cell)
        throw new Error(
          "The selection is no longer available. Select the cells again.",
        );
      if (c === 0 && view.headers.length > 1) {
        row.push(view.rows[r].label);
        continue;
      }
      const raw = cell.type === "missing" ? "" : await read(cell.path);
      row.push(cell.type === "string" ? JSON.parse(raw) : raw);
    }
    result.push(row);
  }
  return toTSV(result);
}
