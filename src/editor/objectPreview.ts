import { parseTree, type Node } from "jsonc-parser";

export type PreviewRow = { key: string; value: string };
// Keep large selections in the exact-JSON view; previewing must stay bounded.
export function objectPreview(
  raw: string,
): { rows: PreviewRow[]; total: number } | null {
  if (raw.length > 128 * 1024) return null;
  const root = parseTree(raw);
  if (!root || (root.type !== "object" && root.type !== "array")) return null;
  function display(node: Node): string {
    if (node.type === "object")
      return node.children?.length ? `${node.children.length} fields` : "{}";
    if (node.type === "array")
      return node.children?.length ? `${node.children.length} items` : "[]";
    const token = raw.slice(
      node.offset,
      node.offset + Math.min(node.length, 240),
    );
    return token + (node.length > 240 ? "…" : "");
  }
  const children = root.children ?? [];
  return {
    total: children.length,
    rows: children
      .slice(0, 30)
      .map((node, index) =>
        root.type === "object"
          ? {
              key: String(node.children![0].value),
              value: display(node.children![1]),
            }
          : { key: String(index), value: display(node) },
      ),
  };
}
