import type { Node } from "jsonc-parser";

/** Render an already-validated tree using original tokens, never parsed values. */
export function compactPrettyJson(
  text: string,
  root: Node,
  eol: string,
  baseIndent = "",
  width = 120,
): string {
  const raw = (node: Node) =>
    text.slice(node.offset, node.offset + node.length);
  // A bounded candidate avoids constructing long inline copies of large subtrees.
  function inline(node: Node, budget: number): string | null {
    if (budget < 0) return null;
    if (node.type !== "object" && node.type !== "array")
      return node.length <= budget ? raw(node) : null;
    const children = node.children ?? [];
    const object = node.type === "object";
    if (!children.length) return budget >= 2 ? (object ? "{}" : "[]") : null;
    const open = object ? "{ " : "[";
    const close = object ? " }" : "]";
    let remaining = budget - open.length - close.length;
    const parts = [open];
    for (let i = 0; i < children.length; i++) {
      if (i) {
        parts.push(", ");
        remaining -= 2;
      }
      const child = children[i];
      if (object) {
        const key = child.children![0];
        remaining -= key.length + 2;
        if (remaining < 0) return null;
        parts.push(raw(key), ": ");
      }
      const value = inline(object ? child.children![1] : child, remaining);
      if (value === null) return null;
      parts.push(value);
      remaining -= value.length;
    }
    parts.push(close);
    return parts.join("");
  }
  const parts: string[] = [];
  function emit(node: Node, depth: number, column: number, outer = false) {
    const container = node.type === "object" || node.type === "array";
    const flat = outer && container ? null : inline(node, width - column);
    if (flat !== null) {
      parts.push(flat);
      return;
    }
    const children = node.children ?? [];
    if (!container || !children.length) {
      parts.push(raw(node));
      return;
    }
    const object = node.type === "object";
    parts.push(object ? "{" : "[");
    const indent = baseIndent + "  ".repeat(depth + 1);
    if (
      !object &&
      children.every(
        (child) => child.type !== "object" && child.type !== "array",
      )
    ) {
      parts.push(eol, indent);
      let used = indent.length;
      for (let i = 0; i < children.length; i++) {
        const token = raw(children[i]);
        if (i) {
          parts.push(",");
          used++;
          // Reserve the following comma so packed lines stay within the target.
          if (
            used + 1 + token.length + (i + 1 < children.length ? 1 : 0) >
            width
          ) {
            parts.push(eol, indent);
            used = indent.length;
          } else {
            parts.push(" ");
            used++;
          }
        }
        parts.push(token);
        used += token.length;
      }
      parts.push(eol, baseIndent + "  ".repeat(depth), "]");
      return;
    }
    for (let i = 0; i < children.length; i++) {
      if (i) parts.push(",");
      parts.push(eol, indent);
      const child = children[i];
      let column = indent.length;
      if (object) {
        const key = raw(child.children![0]);
        parts.push(key, ": ");
        column += key.length + 2;
      }
      emit(object ? child.children![1] : child, depth + 1, column);
    }
    parts.push(eol, baseIndent + "  ".repeat(depth), object ? "}" : "]");
  }
  emit(root, 0, baseIndent.length, true);
  return parts.join("");
}
