import type { Node } from "jsonc-parser";
import type { Cell, Path } from "./engine";
import type { ExpandedCell, ExpandedDocument } from "./editableGroups";
export type MappingRecord = { node: Node; path: Path; labels: string[] };
const entries = (node: Node): [string, Node][] =>
  (node.children ?? []).map((p) => [
    String(p.children![0].value),
    p.children![1],
  ]);
/** Only infer dictionaries when at least two nonempty key sets are entirely disjoint. */
function disjoint(nodes: (Node | undefined)[]) {
  const nonempty = nodes.filter(
    (n): n is Node => n?.type === "object" && !!n.children?.length,
  );
  if (nonempty.length < 2) return false;
  const keys = new Set<string>();
  for (const node of nonempty)
    for (const [key] of entries(node)) {
      if (keys.has(key)) return false;
      keys.add(key);
    }
  return true;
}
/** Sparse object dictionaries become key/value rows, not a union of mostly empty columns. */
export function dictionaryProjection(
  text: string,
  records: MappingRecord[],
  path: Path,
  revision: number,
  cell: (node: Node, path: Path) => Cell,
): ExpandedDocument | undefined {
  if (records.length < 2) return;
  const fields = records.map((r) => new Map(entries(r.node)));
  const whole = disjoint(records.map((r) => r.node));
  const keys = [...new Set(fields.flatMap((f) => [...f.keys()]))];
  const candidates: (string | null)[] = whole
    ? [null]
    : keys.filter((key) => {
        const nodes = fields.map((f) => f.get(key));
        return (
          nodes.every((n) => !n || n.type === "object" || n.type === "null") &&
          disjoint(nodes)
        );
      });
  if (!candidates.length) return;
  if (candidates.length > 8)
    throw new Error(
      "Show up to 8 dictionary tables at once. Open a smaller table.",
    );
  let rendered = 0,
    bytes = 0;
  const encoder = new TextEncoder();
  const track = (value: string) => {
    bytes += encoder.encode(value).length;
    if (bytes > 2 * 1024 * 1024)
      throw new Error("Expanded dictionary values exceed the preview limit.");
    return value;
  };
  const label = (value: string, at: Path): ExpandedCell => ({
    identifier: at.length ? String(at.at(-1)) : undefined,
    cell: {
      path: at,
      type: "string",
      display: value,
      container: false,
      writable: false,
    },
    value: track(value),
  });
  const value = (node: Node | undefined, at: Path): ExpandedCell => {
    if (!node)
      return {
        cell: {
          path: at,
          type: "missing",
          display: "",
          container: false,
          writable: false,
        },
        value: "",
      };
    return {
      cell: cell(node, at),
      value: track(
        node.type === "string"
          ? String(node.value)
          : node.type === "array" || node.type === "object"
            ? cell(node, at).display
            : text.slice(node.offset, node.offset + node.length),
      ),
    };
  };
  return {
    revision,
    sections: candidates.map((dictionary) => {
      const parentKeys =
        dictionary === null ? [] : keys.filter((key) => key !== dictionary);
      const parentKinds = new Map(
        parentKeys.map((key) => {
          const types = new Set(
            fields
              .map((f) => f.get(key)?.type)
              .filter((type) => type && type !== "null"),
          );
          const only = types.size === 1 ? [...types][0] : undefined;
          return [
            key,
            only === "number" || only === "boolean" ? only : "string",
          ] as const;
        }),
      );
      const columns = 1 + parentKeys.length + 2;
      if (columns > 200)
        throw new Error(
          "This view supports up to 200 columns, including row labels. Open a smaller nested table.",
        );
      let rows = 0;
      const groups = records.map((record, index) => {
        const node =
          dictionary === null ? record.node : fields[index].get(dictionary);
        const pairs = node?.type === "object" ? entries(node) : [];
        rows += Math.max(1, pairs.length);
        if (rows > 500)
          throw new Error(
            "Expanded dictionaries support up to 500 rows per table. Open a smaller dictionary.",
          );
        rendered += Math.max(1, pairs.length) * columns;
        if (rendered > 10000)
          throw new Error(
            "Expanded dictionaries support up to 10,000 rendered cells.",
          );
        const parent = [
          label(record.labels.join(" / ") || "root", record.path),
          ...parentKeys.map((key) => {
            const projected = value(fields[index].get(key), [
              ...record.path,
              key,
            ]);
            if (
              projected.cell.type === "null" ||
              projected.cell.type === "missing"
            ) {
              projected.cell.inputKind = parentKinds.get(key);
              projected.cell.writable = true;
            }
            return projected;
          }),
        ];
        return {
          path: record.path,
          arrayPresent: false,
          parent,
          children: pairs.map(([key, node]) => {
            const at = [
              ...record.path,
              ...(dictionary === null ? [] : [dictionary]),
              key,
            ];
            return [label(key, at), value(node, at)];
          }),
        };
      });
      return {
        key: dictionary ?? String(path.at(-1) ?? "Data"),
        mapping: true,
        recordPaths: records.map((r) => r.path),
        parentHeaders: ["Key", ...parentKeys],
        childHeaders:
          dictionary === null
            ? ["Key", "Value"]
            : [`${dictionary} / Key`, `${dictionary} / Value`],
        columnPaths:
          dictionary === null
            ? [
                [String(path.at(-1) ?? "Properties"), "Key"],
                [String(path.at(-1) ?? "Properties"), "Value"],
              ]
            : [
                [dictionary, "Key"],
                [dictionary, "Value"],
              ],
        groups,
      };
    }),
  };
}
