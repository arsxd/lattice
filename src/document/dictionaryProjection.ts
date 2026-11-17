import { alignBands } from "./dictionaryBands";
import type { Node } from "jsonc-parser";
import type { Cell, Path } from "./engine";
import type { ExpandedCell, ExpandedDocument } from "./editableGroups";
export type MappingRecord = { node: Node; path: Path; labels: string[] };
const entries = (node: Node): [string, Node][] =>
  (node.children ?? []).map((p) => [
    String(p.children![0].value),
    p.children![1],
  ]);
type DictionaryEntry = { relative: string[]; node: Node };
const leafCache = new WeakMap<Node, DictionaryEntry[]>();
function dictionaryLeaves(node: Node): DictionaryEntry[] {
  const cached = leafCache.get(node);
  if (cached) return cached;
  const result: DictionaryEntry[] = [];
  let visited = 0;
  const visit = (object: Node, prefix: string[]) => {
    for (const [key, child] of entries(object)) {
      if (++visited > 20000)
        throw new Error(
          "This dictionary has too many nested values. Open a smaller table.",
        );
      const relative = [...prefix, key];
      if (child.type === "object" && child.children?.length)
        visit(child, relative);
      else result.push({ relative, node: child });
    }
  };
  visit(node, []);
  leafCache.set(node, result);
  return result;
}
/** Keep dense/shared schemas; pair disjoint keys or wide dictionaries with mostly absent fields. */
function preferPairs(nodes: (Node | undefined)[], flatten = false) {
  const nonempty = nodes.filter(
    (n): n is Node => n?.type === "object" && !!n.children?.length,
  );
  if (nonempty.length < 2)
    return (
      nonempty.length === 1 &&
      nodes.some((n) => n?.type === "object" && !n.children?.length)
    );
  const keys = new Set<string>();
  let filled = 0,
    overlapping = false;
  for (const node of nonempty) {
    const paths = flatten
      ? dictionaryLeaves(node).map((entry) => entry.relative)
      : entries(node).map(([key]) => [key]);
    for (const path of paths) {
      const key = JSON.stringify(path);
      if (keys.has(key)) overlapping = true;
      keys.add(key);
      filled++;
    }
  }
  return (
    !overlapping ||
    (keys.size >= 8 && filled < nonempty.length * keys.size * 0.5)
  );
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
  const whole = preferPairs(records.map((r) => r.node));
  const keys = [...new Set(fields.flatMap((f) => [...f.keys()]))];
  const candidates: (string | null)[] = whole
    ? [null]
    : keys.filter((key) => {
        const nodes = fields.map((f) => f.get(key));
        return (
          nodes.every((n) => !n || n.type === "object" || n.type === "null") &&
          preferPairs(nodes, true)
        );
      });
  if (!candidates.length) return;
  if (candidates.length > 8)
    throw new Error(
      "Show up to 8 dictionary tables at once. Open a smaller table.",
    );
  // Shared object ancestry belongs in the header, rather than every key cell.
  const prefixes = new Map<string, string[]>();
  for (const dictionary of candidates) {
    if (dictionary === null) continue;
    const paths = fields.flatMap((f) => {
      const n = f.get(dictionary);
      return n?.type === "object"
        ? dictionaryLeaves(n).map((entry) => entry.relative)
        : [];
    });
    const prefix = paths[0]?.slice(0, -1) ?? [];
    for (const relative of paths) {
      let shared = 0;
      while (
        shared < prefix.length &&
        shared < relative.length - 1 &&
        prefix[shared] === relative[shared]
      )
        shared++;
      prefix.length = shared;
    }
    prefixes.set(dictionary, prefix);
  }
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
  if (candidates.length > 1) {
    const dictionaries = candidates as string[];
    const parentKeys = keys.filter((key) => !dictionaries.includes(key));
    const columns = 1 + parentKeys.length + dictionaries.length * 2;
    if (columns > 200)
      throw new Error(
        "This nested table has too many columns. Open a smaller table.",
      );
    let rows = 0;
    const groups = records.map((record, index) => {
      const bands = dictionaries.map((key) => {
        const node = fields[index].get(key);
        return node?.type === "object"
          ? dictionaryLeaves(node).map(({ relative, node }) => {
              const at = [...record.path, key, ...relative];
              return [
                label(
                  relative
                    .slice(prefixes.get(key)?.length ?? 0)
                    .map((part) =>
                      part.replaceAll("~", "~0").replaceAll("/", "~1"),
                    )
                    .join(" / "),
                  at,
                ),
                value(node, at),
              ];
            })
          : [];
      });
      rows += Math.max(
        1,
        bands.reduce((sum, band) => sum + band.length, 0),
      );
      if (rows > 500 || rows * columns > 10000)
        throw new Error(
          "This nested table is too large to expand. Open a smaller table.",
        );
      const children = alignBands(bands, record.path);
      // Account for repeated merged values in the worker transfer as well.
      children.forEach((row) => row.forEach((item) => track(item.value)));
      return {
        path: record.path,
        arrayPresent: false,
        parent: [
          label(record.labels.join(" / ") || "root", record.path),
          ...parentKeys.map((key) =>
            value(fields[index].get(key), [...record.path, key]),
          ),
        ],
        children,
        bands,
      };
    });
    return {
      revision,
      sections: [
        {
          key: String(path.at(-1) ?? "Data"),
          mapping: true,
          recordPaths: records.map((r) => r.path),
          parentHeaders: ["Key", ...parentKeys],
          childHeaders: dictionaries.flatMap((key) => [
            key + " / Key",
            key + " / Value",
          ]),
          columnPaths: dictionaries.flatMap((key) => [
            [[key, ...(prefixes.get(key) ?? [])].join(" / "), "Key"],
            [[key, ...(prefixes.get(key) ?? [])].join(" / "), "Value"],
          ]),
          dictionaryBands: dictionaries.map((key, i) => ({
            key,
            start: i * 2,
          })),
          groups,
        },
      ],
    };
  }
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
        const pairs =
          node?.type === "object"
            ? dictionary === null
              ? entries(node).map(([key, node]) => ({ relative: [key], node }))
              : dictionaryLeaves(node)
            : [];
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
          children: pairs.map(({ relative, node }) => {
            const at = [
              ...record.path,
              ...(dictionary === null ? [] : [dictionary]),
              ...relative,
            ];
            const key = relative
              .slice(
                dictionary === null
                  ? 0
                  : (prefixes.get(dictionary)?.length ?? 0),
              )
              .map((part) => part.replaceAll("~", "~0").replaceAll("/", "~1"))
              .join(" / ");
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
                [
                  [dictionary, ...(prefixes.get(dictionary) ?? [])].join(" / "),
                  "Key",
                ],
                [
                  [dictionary, ...(prefixes.get(dictionary) ?? [])].join(" / "),
                  "Value",
                ],
              ],
        groups,
      };
    }),
  };
}
