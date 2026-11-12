import { parseTree, type Node } from "jsonc-parser";
import { compactJson } from "../document/compactJson";
export type PreviewRow = { key: string; value: string };
// Hard limits apply before parsing and before creating any table cells.
export function objectPreview(
  raw: string,
): {
  rows: PreviewRow[];
  total: number;
  headers: string[];
  cells: string[][];
} | null {
  if (raw.length > 32 * 1024) return null;
  const root = parseTree(raw);
  if (!root || (root.type !== "object" && root.type !== "array")) return null;
  function withinDepth(node: Node, depth: number): boolean {
    return (
      depth <= 12 &&
      (node.children ?? []).every((child) => withinDepth(child, depth + 1))
    );
  }
  if (!withinDepth(root, 0)) return null;
  function display(node: Node): string {
    if (node.type === "object")
      return node.children?.length ? `{${node.children.length} fields}` : "{}";
    if (
      node.type === "array" &&
      node.children?.some(
        (child) => child.type === "object" || child.type === "array",
      )
    )
      return `[${node.children.length} items]`;
    const token = raw.slice(
      node.offset,
      node.offset + Math.min(node.length, 240),
    );
    return (
      (node.type === "array" ? compactJson(token) : token) +
      (node.length > 240 ? "…" : "")
    );
  }
  const entries = (root.children ?? []).map((node, index) =>
    root.type === "object"
      ? { key: String(node.children![0].value), node: node.children![1] }
      : { key: String(index), node },
  );
  let fields: string[] = [];
  if (
    entries.length &&
    entries.every((entry) => entry.node.type === "object")
  ) {
    const keys = new Set<string>();
    for (const entry of entries) {
      for (const prop of entry.node.children ?? []) {
        keys.add(String(prop.children![0].value));
        if (keys.size > 9) break;
      }
      if (keys.size > 9) break;
    }
    if (keys.size <= 9) fields = [...keys];
  }
  const headers = fields.length
    ? ["Key / index", ...fields]
    : ["Key / index", "Value"];
  const visible = entries.slice(
    0,
    Math.min(20, Math.floor(100 / headers.length)),
  );
  const rows = visible.map((entry) => ({
    key: entry.key,
    value: display(entry.node),
  }));
  const cells = visible.map((entry) => {
    if (!fields.length) return [entry.key, display(entry.node)];
    const props = new Map(
      (entry.node.children ?? []).map((prop) => [
        String(prop.children![0].value),
        prop.children![1],
      ]),
    );
    return [
      entry.key,
      ...fields.map((key) => (props.has(key) ? display(props.get(key)!) : "")),
    ];
  });
  return { total: entries.length, rows, headers, cells };
}
