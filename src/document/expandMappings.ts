import { orderFieldPaths } from "./columnPaths";
import type { Node } from "jsonc-parser";
import type { Cell, Path, Kind } from "./engine";
import type {
  ExpandedDocument,
  ExpandedCell,
  ExpandedGroup,
} from "./editableGroups";
const entries = (node: Node): [string, Node][] =>
  (node.children ?? []).map((n) => [
    String(n.children![0].value),
    n.children![1],
  ]);
/** Object-map keys become row labels; leaf properties retain their original paths. */
export function expandMappings(
  text: string,
  node: Node,
  path: Path,
  revision: number,
  cell: (node: Node, path: Path) => Cell,
): ExpandedDocument {
  const array = node.type === "array";
  if (node.type !== "object" && !array)
    throw new Error(
      "Open an object mapping or a record table to expand its nested values.",
    );
  const records: { node: Node; path: Path; labels: string[] }[] = [];
  let visited = 0;
  const walk = (n: Node, at: Path, labels: string[]) => {
    if (++visited > 20000)
      throw new Error(
        "This mapping has too many nested values to expand. Open a smaller table.",
      );
    const children = entries(n);
    if (
      children.length &&
      children.every(([, value]) => value.type === "object")
    )
      for (const [key, value] of children)
        walk(value, [...at, key], [...labels, key]);
    else records.push({ node: n, path: at, labels });
    if (records.length > 500)
      throw new Error(
        "Expanded mappings support up to 500 records. Open a smaller table.",
      );
  };
  if (array) {
    if ((node.children ?? []).some((n) => n.type !== "object"))
      throw new Error("Expand an array of records to show nested fields.");
    for (const [index, child] of (node.children ?? []).entries())
      records.push({ node: child, path: [...path, index], labels: [] });
    if (records.length > 500)
      throw new Error("Expanded tables support up to 500 records.");
  } else walk(node, path, []);
  const fields = new Map<string, string[]>();
  const values = records.map((record) => {
    const found = new Map<string, { node: Node; path: Path }>();
    const leaves = (n: Node, prefix: string[]) => {
      for (const [key, value] of entries(n)) {
        if (++visited > 20000)
          throw new Error("This mapping has too many fields to expand.");
        const relative = [...prefix, key];
        if (value.type === "object" && (value.children?.length ?? 0) > 0)
          leaves(value, relative);
        else {
          const id = JSON.stringify(relative);
          fields.set(id, relative);
          found.set(id, { node: value, path: [...record.path, ...relative] });
          if (fields.size > 18)
            throw new Error(
              "Expanded mappings support up to 18 value columns. Open a smaller table.",
            );
        }
      }
    };
    leaves(record.node, []);
    return found;
  });
  const grouped = records.some((r) => r.labels.length > 1);
  const headers = orderFieldPaths([...fields.values()]);
  if (records.length * (headers.length + (array ? 0 : grouped ? 2 : 1)) > 10000)
    throw new Error("Expanded mappings support up to 10,000 cells.");
  const inputKinds = new Map<string, Kind>();
  for (const [id] of fields) {
    const types = new Set(
      values
        .map((found) => found.get(id)?.node.type)
        .filter((type) => type && type !== "null"),
    );
    if (types.size === 1) {
      const type = [...types][0];
      inputKinds.set(
        id,
        type === "number" || type === "boolean" ? type : "string",
      );
    }
  }
  const groups: ExpandedGroup[] = [];
  const byGroup = new Map<string, ExpandedGroup>();
  let bytes = 0;
  const encoder = new TextEncoder();
  const label = (name: string, at: Path): ExpandedCell => ({
    cell: {
      path: at,
      type: "string",
      display: name,
      container: false,
      writable: false,
    },
    identifier: at.length ? String(at.at(-1)) : undefined,
    value: name,
  });
  records.forEach((record, index) => {
    const top = grouped ? (record.labels[0] ?? "root") : null;
    const groupPath = grouped && record.labels.length ? [...path, top!] : path;
    const identity = JSON.stringify(groupPath);
    let group = byGroup.get(identity);
    if (!group) {
      group = {
        path: groupPath,
        arrayPresent: false,
        parent: top === null ? [] : [label(top, groupPath)],
        children: [],
      };
      byGroup.set(identity, group);
      groups.push(group);
    }
    const row: ExpandedCell[] = [
      ...(!array
        ? [
            label(
              grouped
                ? record.labels.slice(1).join(" / ") ||
                    record.labels[0] ||
                    "root"
                : record.labels.at(-1) || "root",
              record.path,
            ),
          ]
        : []),
    ];
    for (const relative of headers) {
      const found = values[index].get(JSON.stringify(relative));
      if (!found) {
        row.push({
          cell: {
            path: [...record.path, ...relative],
            type: "missing",
            display: "",
            container: false,
            writable: relative.length === 1,
            inputKind: inputKinds.get(JSON.stringify(relative)) ?? "string",
          },
          value: "",
        });
        continue;
      }
      const n = found.node;
      const raw = text.slice(n.offset, n.offset + n.length),
        value =
          n.type === "string"
            ? String(n.value)
            : n.type === "object" || n.type === "array"
              ? cell(n, found.path).display
              : raw;
      bytes += encoder.encode(value).length;
      if (bytes > 2 * 1024 * 1024)
        throw new Error("Expanded mapping values exceed the preview limit.");
      const projected = cell(n, found.path);
      if (n.type === "null")
        projected.inputKind =
          inputKinds.get(JSON.stringify(relative)) ?? "string";
      row.push({ cell: projected, value });
    }
    group.children.push(row);
  });
  return {
    revision,
    sections: [
      {
        key: String(path.at(-1) ?? "Data"),
        mapping: true,
        recordPaths: records.map((r) => r.path),
        parentHeaders: grouped ? ["Group"] : [],
        columnPaths: [...(array ? [] : [["Key"]]), ...headers],
        childHeaders: [
          ...(array ? [] : ["Key"]),
          ...headers.map((p) =>
            p
              .map((s) => s.replaceAll("~", "~0").replaceAll("/", "~1"))
              .join(" / "),
          ),
        ],
        groups,
      },
    ],
  };
}
