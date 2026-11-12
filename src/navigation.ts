import type { Query } from "./document/engine";
export type NavigationHistory = { entries: Query[]; index: number };
export function recordNavigation(
  history: NavigationHistory | undefined,
  current: Query,
  next: Query,
  target?: number,
): NavigationHistory {
  const entries = history ? [...history.entries] : [current];
  const index = history?.index ?? 0;
  entries[index] = current;
  if (target !== undefined) {
    if (target < 0 || target >= entries.length)
      throw new Error("Navigation entry is unavailable.");
    entries[target] = next;
    return { entries, index: target };
  }
  if (JSON.stringify(current.path) === JSON.stringify(next.path)) {
    entries[index] = next;
    return { entries, index };
  }
  const branch = [...entries.slice(0, index + 1), next].slice(-100);
  return { entries: branch, index: branch.length - 1 };
}
