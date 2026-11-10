import { parseTree, type ParseError } from "jsonc-parser";
import type { Kind, Cell } from "../document/engine";
export function scalarText(kind: Kind, value: string): string {
  if (kind === "array") {
    const errors: ParseError[] = [];
    const node = parseTree(value, errors, {
      disallowComments: true,
      allowTrailingComma: false,
    });
    if (
      !errors.length &&
      node?.type === "array" &&
      (node.children ?? []).every(
        (c) => c.type !== "object" && c.type !== "array",
      )
    )
      return value;
    throw new Error(
      "Enter a simple JSON array, for example [1, 2, 3]. Nested data uses the expanded editor.",
    );
  }
  if (kind === "string") return JSON.stringify(value);
  if (
    kind === "number" &&
    /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)
  )
    return value;
  if (kind === "boolean" && (value === "true" || value === "false"))
    return value;
  if (kind === "null" && value === "null") return value;
  throw new Error(
    `Enter a valid JSON ${kind}. Use the inspector to change its type.`,
  );
}

export function cellInputKind(cell: Cell): Kind {
  if (cell.type !== "null" && cell.type !== "missing") return cell.type;
  return cell.inputKind === "number" ||
    cell.inputKind === "boolean" ||
    cell.inputKind === "string"
    ? cell.inputKind
    : "string";
}
