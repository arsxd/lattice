import type { Kind } from "../document/engine";
export function scalarText(kind: Kind, value: string): string {
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
