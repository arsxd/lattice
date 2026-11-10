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
