import { parseTree, type ParseError } from "jsonc-parser";
import type { Kind, Cell } from "../document/engine";
export function scalarText(kind: Kind, value: string): string {
  if (kind !== "string" && value.trim().startsWith('"')) {
    const errors: ParseError[] = [];
    const node = parseTree(value, errors, {
      disallowComments: true,
      allowTrailingComma: false,
    });
    if (!errors.length && node?.type === "string") return value;
  }
  if (kind === "array" || kind === "object") {
    const errors: ParseError[] = [];
    const node = parseTree(value, errors, {
      disallowComments: true,
      allowTrailingComma: false,
    });
    if (!errors.length && node?.type === kind) return value;
    throw new Error(
      `Enter a valid JSON ${kind}, or use Change type in Details.`,
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
    kind === "number"
      ? "Enter a number, or use Change type in Details."
      : kind === "boolean"
        ? "Enter true or false, or use Change type in Details."
        : "Enter null, or use Change type in Details.",
  );
}

export function cellInputKind(cell: Cell): Kind {
  if (cell.type !== "null" && cell.type !== "missing") return cell.type;
  return cell.inputKind ?? "string";
}

/** The value bar shows JSON, while grid string editors accept literal text. */
export function valueBarRaw(kind: Kind, value: string): string {
  if (kind === "string" && value.trim().startsWith('"')) {
    const errors: ParseError[] = [];
    const node = parseTree(value, errors, {
      disallowComments: true,
      allowTrailingComma: false,
    });
    if (!errors.length && node?.type === "string") return value;
    throw new Error('Enter a complete quoted string, for example "0".');
  }
  if (value === "" && kind !== "string") return "null";
  return scalarText(kind, value);
}

/** Explicit quoted JSON is supported only for direct entry, not clipboard text. */
export function cellEntryText(kind: Kind, value: string): string {
  if (value.trim().startsWith('"')) {
    const errors: ParseError[] = [];
    const node = parseTree(value, errors, {
      disallowComments: true,
      allowTrailingComma: false,
    });
    if (!errors.length && node?.type === "string") return value;
  }
  return scalarText(kind, value);
}

/** Protect existing strings that themselves look like quoted JSON notation. */
export function gridStringDraft(raw: string): string {
  const text = JSON.parse(raw) as string;
  if (text.trim().startsWith('"')) {
    const errors: ParseError[] = [];
    const node = parseTree(text, errors, {
      disallowComments: true,
      allowTrailingComma: false,
    });
    if (!errors.length && node?.type === "string") return raw;
  }
  return text;
}
