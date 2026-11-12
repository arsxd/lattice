import {
  createScanner,
  SyntaxKind,
  parseTree,
  printParseErrorCode,
  type Node,
  type ParseError,
} from "jsonc-parser";

export type Path = (string | number)[];
export type Kind =
  "object" | "array" | "string" | "number" | "boolean" | "null";
export type Diagnostic = {
  message: string;
  offset: number;
  line: number;
  column: number;
};
export type Cell = {
  path: Path;
  type: Kind | "missing";
  display: string;
  container: boolean;
  empty?: boolean;
  writable?: boolean;
  inputKind?: Kind;
};
export type OutlineEntry = {
  label: string;
  path: Path;
  kind: Kind;
  expandable: boolean;
};
export type OutlineResult = { children: OutlineEntry[]; truncated: boolean };
export type Row = { id: string; label: string; path: Path; cells: Cell[] };
export type Query = {
  path: Path;
  records: boolean;
  search: string;
  filters?: Record<string, string>;
  valueFilters?: Record<string, string[]>;
  optionsColumn?: number;
  sort?: { column: number; direction: "ASC" | "DESC" };
  page: number;
};
export type Projection = {
  sheets?: { label: string; path: Path; kind: Kind }[];
  filterOptions?: { key: string; label: string }[];
  filterOptionsTruncated?: boolean;
  revision: number;
  dirty: boolean;
  undo: boolean;
  redo: boolean;
  diagnostics: Diagnostic[];
  path: Path;
  kind?: Kind;
  headers: string[];
  rows: Row[];
  total: number;
  matched: number;
  page: number;
  pages: number;
  children: { label: string; path: Path; kind: Kind }[];
  truncatedChildren: boolean;
  recordsAvailable: boolean;
  rootKind?: Kind;
  bytes: number;
};
export type AtomicMutation =
  | { action: "column-edit"; path: Path; key: string; name?: string }
  | {
      action: "relative-row";
      path: Path;
      where: "before" | "after";
      duplicate?: boolean;
    }
  | { action: "add-row"; path: Path }
  | { action: "add-column"; path: Path; key: string }
  | { action: "replace"; path: Path; raw: string }
  | { action: "remove"; path: Path }
  | { action: "rename"; path: Path; key: string }
  | { action: "insert"; path: Path; raw: string; key?: string };
export type Mutation =
  AtomicMutation | { action: "batch"; commands: AtomicMutation[] };
// The parser returns plain nodes; the engine owns this tree exclusively.
type MutableNode = { -readonly [K in keyof Node]: Node[K] };
type Patch = { offset: number; before: string; after: string };
const MAX_CHARS = 64 * 1024 * 1024;
const MAX_DEPTH = 256;
const TYPE_ORDER = [
  "missing",
  "null",
  "boolean",
  "number",
  "string",
  "array",
  "object",
];
export const PAGE_SIZE = 500;
export const pointer = (path: Path) =>
  path.length
    ? "/" +
      path
        .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
        .join("/")
    : "";
function normal(text: string) {
  return text.charCodeAt(0) === 0xfeff ? " " + text.slice(1) : text;
}
function preflight(text: string) {
  if (text.length > MAX_CHARS)
    throw new Error(
      "This build supports at most 64 Mi UTF-16 characters per document. The original file has not been changed.",
    );
  const scanner = createScanner(normal(text), true);
  let depth = 0,
    tokens = 0;
  for (
    let token = scanner.scan();
    token !== SyntaxKind.EOF;
    token = scanner.scan()
  ) {
    if (++tokens > 4_000_000)
      throw new Error(
        "This document exceeds the four-million-token indexing budget. The original file is unchanged.",
      );
    if (
      token === SyntaxKind.OpenBraceToken ||
      token === SyntaxKind.OpenBracketToken
    ) {
      if (++depth > MAX_DEPTH)
        throw new Error("Maximum nesting depth is 256 in this build.");
    }
    if (
      token === SyntaxKind.CloseBraceToken ||
      token === SyntaxKind.CloseBracketToken
    )
      depth--;
  }
}
function parse(text: string): {
  root?: Node;
  issues: { message: string; offset: number }[];
} {
  preflight(text);
  const errors: ParseError[] = [];
  const root = parseTree(normal(text), errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });
  const issues: { message: string; offset: number }[] = errors.map((e) => ({
    message: printParseErrorCode(e.error),
    offset: e.offset,
  }));
  if (root) {
    const pending = [root];
    while (pending.length) {
      const n = pending.pop()!;
      if (n.type === "object") {
        const keys = new Set<string>();
        for (const prop of n.children ?? []) {
          const key = String(prop.children![0].value);
          if (keys.has(key))
            issues.push({
              message: `Duplicate key ${JSON.stringify(key)}. Repair in Source before table editing.`,
              offset: prop.offset,
            });
          keys.add(key);
        }
      }
      for (const c of n.children ?? []) pending.push(c);
    }
  }
  return { root, issues };
}
function child(n: Node, segment: string | number): Node | undefined {
  if (n.type === "object" && typeof segment === "string")
    return n.children?.find((p) => p.children?.[0].value === segment)
      ?.children?.[1];
  if (n.type === "array" && typeof segment === "number")
    return n.children?.[segment];
}
function entries(n: Node): [string | number, Node][] {
  return n.type === "object"
    ? (n.children ?? []).map((p) => [
        String(p.children![0].value),
        p.children![1],
      ])
    : n.type === "array"
      ? (n.children ?? []).map((v, i) => [i, v])
      : [];
}
function numberParts(raw: string) {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw)!;
  const fraction = m[3] ?? "";
  const digits = (m[2] + fraction).replace(/^0+/, "");
  return {
    negative: !!m[1] && !!digits,
    digits,
    scale: BigInt(m[4] ?? 0) - BigInt(fraction.length) + BigInt(digits.length),
  };
}
export function compareNumbers(a: string, b: string) {
  const x = numberParts(a),
    y = numberParts(b);
  if (!x.digits && !y.digits) return 0;
  if (x.negative !== y.negative) return x.negative ? -1 : 1;
  let cmp = 0;
  if (!x.digits) cmp = -1;
  else if (!y.digits) cmp = 1;
  else if (x.scale !== y.scale) cmp = x.scale < y.scale ? -1 : 1;
  else {
    const length = Math.max(x.digits.length, y.digits.length);
    const xx = x.digits.padEnd(length, "0"),
      yy = y.digits.padEnd(length, "0");
    cmp = xx < yy ? -1 : xx > yy ? 1 : 0;
  }
  return x.negative ? -cmp : cmp;
}

export class DocumentEngine {
  private columnOrder = new Map<string, string[]>();
  text: string;
  revision = 0;
  private saved: string;
  private root?: Node;
  diagnostics: Diagnostic[] = [];
  private past: Patch[] = [];
  private future: Patch[] = [];
  private historyChars = 0;
  constructor(text: string) {
    this.text = text;
    this.saved = text;
    this.reparse();
  }
  private reparse(parsed?: ReturnType<typeof parse>) {
    const { root, issues } = parsed ?? parse(this.text);
    this.root = root;
    const starts = [0];
    for (let i = 0; i < this.text.length; i++)
      if (this.text[i] === "\n") starts.push(i + 1);
    this.diagnostics = issues.slice(0, 100).map((e) => {
      let lo = 0,
        hi = starts.length;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid] <= e.offset) lo = mid;
        else hi = mid;
      }
      return { ...e, line: lo + 1, column: e.offset - starts[lo] + 1 };
    });
  }
  private node(path: Path) {
    let n = this.root;
    for (const s of path) n = n && child(n, s);
    if (!n)
      throw new Error("This value no longer exists. Refresh the selection.");
    return n;
  }
  outline(path: Path): OutlineResult {
    const node = this.node(path);
    const result: OutlineEntry[] = [];
    for (const [index, item] of (node.children ?? []).entries()) {
      const value = node.type === "object" ? item.children?.[1] : item;
      if (!value || (value.type !== "object" && value.type !== "array"))
        continue;
      if (result.length === 200) return { children: result, truncated: true };
      const key =
        node.type === "object" ? String(item.children![0].value) : index;
      result.push({
        label: String(key),
        path: [...path, key],
        kind: value.type as Kind,
        expandable: (value.children ?? []).some((child) => {
          const nested = value.type === "object" ? child.children?.[1] : child;
          return nested?.type === "object" || nested?.type === "array";
        }),
      });
    }
    return { children: result, truncated: false };
  }
  locate(path: Path, property = false) {
    let n = this.node(path);
    if (property && n.parent?.type === "property") n = n.parent;
    return { from: n.offset, to: n.offset + n.length, revision: this.revision };
  }
  raw(path: Path) {
    const n = this.node(path);
    return this.text.slice(n.offset, n.offset + n.length);
  }
  private guard(revision: number) {
    if (revision !== this.revision)
      throw new Error(
        "The document changed. Select the value again before editing.",
      );
  }
  private commit(next: string, strict: boolean) {
    if (next === this.text) return;
    const result = parse(next);
    if (strict && result.issues.length)
      throw new Error(result.issues[0].message);
    let start = 0;
    while (
      start < next.length &&
      start < this.text.length &&
      next[start] === this.text[start]
    )
      start++;
    let endOld = this.text.length,
      endNew = next.length;
    while (
      endOld > start &&
      endNew > start &&
      this.text[endOld - 1] === next[endNew - 1]
    ) {
      endOld--;
      endNew--;
    }
    const patch = {
      offset: start,
      before: this.text.slice(start, endOld),
      after: next.slice(start, endNew),
    };
    this.past.push(patch);
    this.historyChars += patch.before.length + patch.after.length;
    this.future = [];
    while (
      this.past.length > 1 &&
      (this.past.length > 1000 || this.historyChars > 32 * 1024 * 1024)
    ) {
      const p = this.past.shift()!;
      this.historyChars -= p.before.length + p.after.length;
    }
    this.text = next;
    this.revision++;
    this.reparse(result);
  }
  source(text: string, revision: number) {
    this.guard(revision);
    this.commit(text, false);
  }
  markSaved(text: string) {
    this.saved = text;
  }
  undo() {
    const p = this.past.pop();
    if (!p) return;
    this.text =
      this.text.slice(0, p.offset) +
      p.before +
      this.text.slice(p.offset + p.after.length);
    this.future.push(p);
    this.revision++;
    this.reparse();
  }
  redo() {
    const p = this.future.pop();
    if (!p) return;
    this.text =
      this.text.slice(0, p.offset) +
      p.after +
      this.text.slice(p.offset + p.before.length);
    this.past.push(p);
    this.revision++;
    this.reparse();
  }
  mutate(command: Mutation, revision: number) {
    this.guard(revision);
    if (this.diagnostics.length)
      throw new Error(
        "Repair source errors and duplicate keys before table editing.",
      );
    if (command.action === "batch") {
      if (command.commands.length > 10000)
        throw new Error("Select at most 10,000 cells per operation.");
      const draft = new DocumentEngine(this.text);
      draft.columnOrder = new Map(
        [...this.columnOrder].map(([key, values]) => [key, [...values]]),
      );
      for (const operation of command.commands)
        draft.mutate(operation, draft.revision);
      this.commit(draft.text, true);
      this.columnOrder = draft.columnOrder;
      return;
    }
    const n = this.node(command.path);
    const splice = (offset: number, length: number, value: string) =>
      this.commit(
        this.text.slice(0, offset) + value + this.text.slice(offset + length),
        true,
      );
    if (command.action === "column-edit") {
      const draft = new DocumentEngine(this.text);
      const rows = entries(n).filter(([, v]) => v.type === "object");
      if (command.name !== undefined && !command.name.trim())
        throw new Error("Enter a column name.");
      for (const [key, row] of rows) {
        if (!child(row, command.key)) continue;
        const path = [...command.path, key, command.key];
        draft.mutate(
          command.name !== undefined
            ? { action: "rename", path, key: command.name }
            : { action: "remove", path },
          draft.revision,
        );
      }
      this.commit(draft.text, true);
      if (command.name !== undefined) {
        const id = pointer(command.path),
          order = this.columnOrder.get(id);
        if (order)
          this.columnOrder.set(id, [
            ...new Set(
              order.flatMap((key) =>
                key === command.key ? [command.name!, key] : [key],
              ),
            ),
          ]);
      }
      return;
    }
    if (command.action === "relative-row") {
      if (!command.path.length) throw new Error("Select a row inside a table.");
      const parentPath = command.path.slice(0, -1),
        parent = this.node(parentPath);
      if (parent.type !== "object" && parent.type !== "array")
        throw new Error("Select a table row.");
      const draft = new DocumentEngine(this.text);
      draft.mutate({ action: "add-row", path: parentPath }, draft.revision);
      const added = entries(draft.node(parentPath)).at(-1)!;
      const raw = command.duplicate
        ? this.raw(command.path)
        : draft.raw([...parentPath, added[0]]);
      const content =
        parent.type === "object" ? JSON.stringify(added[0]) + ": " + raw : raw;
      const item = n.parent?.type === "property" ? n.parent : n;
      if (command.where === "before") splice(item.offset, 0, content + ", ");
      else splice(item.offset + item.length, 0, ", " + content);
      return;
    }
    if (command.action === "add-row" || command.action === "add-column") {
      if (n.type !== "object" && n.type !== "array")
        throw new Error("Select a table first.");
      const rows = entries(n);
      const objects = rows.filter(([, value]) => value.type === "object");
      const fields = new Set<string>();
      for (const [, value] of objects) {
        for (const [key] of entries(value)) fields.add(String(key));
        if (fields.size > 200)
          throw new Error("This table exceeds the 200-column editing limit.");
      }
      const keys = [...fields];
      if (command.action === "add-row") {
        let key: string | undefined;
        if (n.type === "object") {
          const existing = new Set(rows.map(([key]) => String(key)));
          if ([...existing].every((key) => /^(0|[1-9]\d*)$/.test(key))) {
            let max = 0n;
            for (const key of existing)
              if (BigInt(key) > max) max = BigInt(key);
            key = String(max + 1n);
          } else {
            let i = 1;
            while (existing.has(`row_${i}`)) i++;
            key = `row_${i}`;
          }
        }
        const raw =
          "{" +
          keys.map((key) => JSON.stringify(key) + ": null").join(", ") +
          "}";
        this.mutate(
          { action: "insert", path: command.path, key, raw },
          revision,
        );
      } else {
        if (!command.key.trim()) throw new Error("Enter a column name.");
        if (keys.includes(command.key))
          throw new Error("A column with this name already exists.");
        if (keys.length === 200)
          throw new Error("This build supports at most 200 table columns.");
        if (!objects.length)
          throw new Error("Add a row before adding a column.");
        // Append from right to left using original offsets; preserve every existing token.
        // Commit once so a column addition is one undoable transaction.
        const chunks: string[] = [];
        let end = this.text.length,
          size = this.text.length;
        for (let i = objects.length - 1; i >= 0; i--) {
          const row = objects[i][1];
          const last = row.children?.at(-1);
          const offset = last ? last.offset + last.length : row.offset + 1;
          const content =
            (last ? ", " : "") + JSON.stringify(command.key) + ": null";
          size += content.length;
          if (size > MAX_CHARS)
            throw new Error("Document exceeds this build’s size limit.");
          chunks.push(this.text.slice(offset, end), content);
          end = offset;
        }
        chunks.push(this.text.slice(0, end));
        this.commit(chunks.reverse().join(""), true);
      }
      return;
    }
    if (command.action === "replace" || command.action === "insert") {
      const p = parse(command.raw);
      if (p.issues.length || !p.root)
        throw new Error("Enter exactly one valid JSON value.");
    }
    if (command.action === "replace") {
      const replacement = parse(command.raw).root!;
      if (
        !["object", "array"].includes(n.type) &&
        !["object", "array"].includes(replacement.type)
      ) {
        // A validated scalar replacement cannot alter the surrounding syntax structure.
        // Update spans in place instead of allocating a second complete syntax tree.
        const offset = n.offset,
          oldLength = n.length,
          delta = command.raw.length - oldLength;
        if (this.text.length + delta > MAX_CHARS)
          throw new Error("Document exceeds this build’s size limit.");
        const before = this.text.slice(offset, offset + oldLength);
        if (before === command.raw) return;
        const ancestors = new Set<Node>();
        for (let p = n.parent; p; p = p.parent) ancestors.add(p);
        const pending = this.root ? [this.root] : [];
        while (pending.length) {
          const current = pending.pop()! as MutableNode;
          if (current !== n) {
            if (current.offset >= offset + oldLength) current.offset += delta;
            if (
              current.colonOffset !== undefined &&
              current.colonOffset >= offset + oldLength
            )
              current.colonOffset += delta;
            if (ancestors.has(current)) current.length += delta;
          }
          for (const c of current.children ?? []) pending.push(c);
        }
        const target = n as MutableNode;
        target.offset = offset + replacement.offset;
        target.length = replacement.length;
        target.type = replacement.type;
        target.value = replacement.value;
        this.text =
          this.text.slice(0, offset) +
          command.raw +
          this.text.slice(offset + oldLength);
        this.past.push({ offset, before, after: command.raw });
        this.historyChars += before.length + command.raw.length;
        this.future = [];
        while (
          this.past.length > 1 &&
          (this.past.length > 1000 || this.historyChars > 32 * 1024 * 1024)
        ) {
          const p = this.past.shift()!;
          this.historyChars -= p.before.length + p.after.length;
        }
        this.revision++;
      } else splice(n.offset, n.length, command.raw);
      return;
    }
    if (command.action === "rename") {
      if (n.parent?.type !== "property")
        throw new Error("Only object properties can be renamed.");
      const parent = n.parent.parent!;
      const keyNode = n.parent.children![0];
      if (
        parent.children?.some(
          (p) => p !== n.parent && p.children![0].value === command.key,
        )
      )
        throw new Error("A property with that key already exists.");
      splice(keyNode.offset, keyNode.length, JSON.stringify(command.key));
      return;
    }
    if (command.action === "remove") {
      if (command.path.length === 0)
        throw new Error(
          "The root cannot be removed. Replace its value instead.",
        );
      const item = n.parent?.type === "property" ? n.parent : n;
      const siblings = item.parent!.children!;
      const index = siblings.indexOf(item);
      if (siblings.length === 1) splice(item.offset, item.length, "");
      else if (index < siblings.length - 1)
        splice(item.offset, siblings[index + 1].offset - item.offset, "");
      else {
        const previous = siblings[index - 1];
        const start = previous.offset + previous.length;
        splice(start, item.offset + item.length - start, "");
      }
      return;
    }
    if (n.type !== "object" && n.type !== "array")
      throw new Error("Select an object or array to add an item.");
    if (
      n.type === "object" &&
      (command.key === undefined || entries(n).some(([k]) => k === command.key))
    )
      throw new Error("Choose a new, unique property key.");
    const content =
      n.type === "object"
        ? JSON.stringify(command.key) + ": " + command.raw
        : command.raw;
    const children = n.children ?? [];
    const multiline = this.text
      .slice(n.offset, n.offset + n.length)
      .includes("\n");
    const eol = this.text.includes("\r\n") ? "\r\n" : "\n";
    const lineStart = this.text.lastIndexOf("\n", n.offset) + 1;
    const indent = /^[\t ]*/.exec(this.text.slice(lineStart, n.offset))![0];
    const itemIndent = children.length
      ? /^[\t ]*/.exec(
          this.text.slice(
            this.text.lastIndexOf("\n", children[0].offset) + 1,
            children[0].offset,
          ),
        )![0]
      : indent + "  ";
    if (children.length) {
      const last = children.at(-1)!;
      splice(
        last.offset + last.length,
        0,
        "," + (multiline ? eol + itemIndent : " ") + content,
      );
    } else
      splice(
        n.offset + 1,
        0,
        multiline ? eol + indent + "  " + content : content,
      );
  }
  private cell(n: Node | undefined, path: Path): Cell {
    if (!n)
      return { path, type: "missing", display: "missing", container: false };
    const primitiveArray =
      n.type === "array" &&
      (n.children ?? []).every(
        (c) => c.type !== "object" && c.type !== "array",
      );
    const container =
      n.type === "object" || (n.type === "array" && !primitiveArray);
    const empty =
      (n.type === "string" && n.value === "") ||
      ((n.type === "object" || n.type === "array") && !n.children?.length);
    const describe = (value: Node): string => {
      if (value.type === "object")
        return `{${value.children?.length ?? 0} fields}`;
      if (value.type === "array")
        return `[${value.children?.length ?? 0} items]`;
      const raw = this.text.slice(
        value.offset,
        value.offset + Math.min(value.length, 40),
      );
      return raw + (value.length > 40 ? "…" : "");
    };
    const objectPreview =
      n.type === "object" && n.children?.length
        ? n.children
            .slice(0, 3)
            .map(
              (property) =>
                `${property.children![0].value}: ${describe(property.children![1])}`,
            )
            .join(", ") + (n.children.length > 3 ? ", …" : "")
        : "{}";
    let display =
      n.type === "object"
        ? objectPreview
        : primitiveArray
          ? this.text.slice(n.offset, n.offset + n.length)
          : container
            ? `Array · ${n.children?.length ?? 0}`
            : n.type === "string"
              ? n.value === ""
                ? '""'
                : String(n.value)
              : this.text.slice(n.offset, n.offset + n.length);
    if (display.length > 240) display = display.slice(0, 237) + "…";
    return { path, type: n.type as Kind, display, container, empty };
  }
  project(query: Query): Projection {
    let path = query.path;
    let n: Node | undefined;
    try {
      n = this.node(path);
    } catch {
      path = [];
      n = this.root;
    }
    let sheetRoot = this.root,
      sheetPath: Path = [];
    while (sheetRoot?.type === "object") {
      const values = entries(sheetRoot);
      if (values.length !== 1 || values[0][1].type !== "object") break;
      sheetPath = [...sheetPath, values[0][0]];
      sheetRoot = values[0][1];
    }
    const sheets = sheetRoot
      ? entries(sheetRoot)
          .filter(([, v]) => v.type === "object" || v.type === "array")
          .slice(0, 200)
          .map(([key, v]) => ({
            label: String(key),
            path: [...sheetPath, key],
            kind: v.type as Kind,
          }))
      : [];
    const common = {
      sheets,
      revision: this.revision,
      dirty: this.text !== this.saved,
      undo: !!this.past.length,
      redo: !!this.future.length,
      diagnostics: this.diagnostics,
      path,
      kind: n?.type as Kind | undefined,
      rootKind: this.root?.type as Kind | undefined,
      bytes: new TextEncoder().encode(this.text).length,
    };
    if (!n || this.diagnostics.length)
      return {
        ...common,
        headers: [],
        rows: [],
        children: [],
        truncatedChildren: false,
        recordsAvailable: false,
        total: 0,
        matched: 0,
        page: 0,
        pages: 1,
      };
    const items = entries(n);
    let recordsAvailable =
      items.length > 0 && items.some(([, v]) => v.type === "object");
    let records = recordsAvailable && query.records;
    let headers: string[] = [],
      keys: string[] = [];
    const mixed = items.some(([, v]) => v.type !== "object");
    const inputKinds = new Map<string, Kind>();
    if (records) {
      const discovered = new Set<string>();
      const kinds = new Map<string, Set<Kind>>();
      for (const [, value] of items) {
        if (value.type !== "object") continue;
        for (const [key, cell] of entries(value)) {
          discovered.add(String(key));
          if (cell.type !== "null") {
            const set = kinds.get(String(key)) ?? new Set<Kind>();
            set.add(cell.type as Kind);
            kinds.set(String(key), set);
          }
        }
      }
      for (const [key, set] of kinds)
        if (set.size === 1) inputKinds.set(key, [...set][0]);
      const tableId = pointer(path);
      const established = this.columnOrder.get(tableId) ?? [];
      keys = [
        ...established.filter((k) => discovered.has(k)),
        ...[...discovered].filter((k) => !established.includes(k)),
      ];
      this.columnOrder.set(tableId, [...new Set([...established, ...keys])]);
      if (keys.length > 200) {
        records = false;
        recordsAvailable = false;
      }
      headers = [
        n.type === "array" ? "Index" : "Key",
        ...keys,
        ...(mixed ? ["Single value"] : []),
      ];
    }
    if (!records)
      headers =
        n.type === "object"
          ? ["Key", "Value"]
          : n.type === "array"
            ? ["Index", "Value"]
            : ["Value"];
    // Keep only node references for the complete collection; construct cells for one page.
    const all = items.length
      ? items
      : n.type === "object" || n.type === "array"
        ? []
        : [["", n] as [string, Node]];
    const pathOf = (key: string | number): Path =>
      n!.type === "object" || n!.type === "array" ? [...path, key] : path;
    const getCell = (item: [string | number, Node], column: number): Cell => {
      const [key, value] = item,
        p = pathOf(key),
        c = this.cell(value, p);
      if (records) {
        if (column === 0) return { ...c, display: String(key) };
        if (column > keys.length)
          return value.type !== "object"
            ? c
            : {
                path: p,
                type: "missing",
                display: "",
                container: false,
                writable: false,
              };
        if (value.type !== "object")
          return {
            path: p,
            type: "missing",
            display: "",
            container: false,
            writable: false,
          };
        const field = keys[column - 1];
        const result = this.cell(child(value, field), [...p, field]);
        if (result.type === "missing" || result.type === "null") {
          result.inputKind = inputKinds.get(field) ?? "string";
        }
        return result;
      }
      return column === headers.length - 1 ? c : { ...c, display: String(key) };
    };
    const total = all.length;
    const valueKey = (item: [string | number, Node], index: number) => {
      const c = getCell(item, index);
      const metadata = records ? index === 0 : index < headers.length - 1;
      const full = metadata
        ? c.display
        : c.type === "missing"
          ? ""
          : c.type === "string"
            ? String(this.node(c.path).value)
            : this.raw(c.path);
      return {
        key: JSON.stringify([metadata ? "label" : c.type, full]),
        label:
          c.type === "missing"
            ? "(Not set)"
            : c.type === "null"
              ? "(Blank / null)"
              : full === ""
                ? "(Empty text)"
                : full,
      };
    };
    let filterOptions: { key: string; label: string }[] | undefined,
      filterOptionsTruncated = false;
    if (
      query.optionsColumn !== undefined &&
      query.optionsColumn >= 0 &&
      query.optionsColumn < headers.length
    ) {
      const choices = new Map<string, string>();
      for (const item of all) {
        const v = valueKey(item, query.optionsColumn);
        if (choices.has(v.key)) continue;
        if (choices.size >= 2000) {
          filterOptionsTruncated = true;
          break;
        }
        choices.set(v.key, v.label);
      }
      filterOptions = [...choices].map(([key, label]) => ({ key, label }));
    }
    let filtered = all;
    const search = query.search.toLocaleLowerCase();
    if (search)
      filtered = all.filter((item) =>
        headers.some((_, i) => {
          const c = getCell(item, i);
          if (c.display.toLocaleLowerCase().includes(search)) return true;
          if (c.type === "string") {
            const node = this.node(c.path);
            return String(node.value).toLocaleLowerCase().includes(search);
          }
          return false;
        }),
      );
    for (const [column, term] of Object.entries(query.filters ?? {})) {
      const index = Number(column);
      if (
        !term ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= headers.length
      )
        continue;
      filtered = filtered.filter((item) => {
        const cell = getCell(item, index);
        const text =
          cell.type === "string"
            ? String(this.node(cell.path).value)
            : cell.display;
        return text.toLocaleLowerCase().includes(term.toLocaleLowerCase());
      });
    }
    for (const [column, selected] of Object.entries(query.valueFilters ?? {})) {
      const index = Number(column);
      if (index < 0 || index >= headers.length) continue;
      const allowed = new Set(selected);
      filtered = filtered.filter((item) =>
        allowed.has(valueKey(item, index).key),
      );
    }
    if (
      query.sort &&
      Number.isInteger(query.sort.column) &&
      query.sort.column >= 0 &&
      query.sort.column < headers.length
    ) {
      const { column, direction } = query.sort,
        sign = direction === "ASC" ? 1 : -1;
      // Cache sort values once; never compare truncated display text for numeric cells.
      const valueColumn =
        (records && column > 0) || (!records && column === headers.length - 1);
      const indexed = filtered.map((item) => {
        const c = getCell(item, column);
        const node = c.type === "missing" ? undefined : this.node(c.path);
        const full =
          valueColumn && node
            ? node.type === "string"
              ? String(node.value)
              : this.raw(c.path)
            : c.display;
        return { item, cell: c, full };
      });
      indexed.sort((a, b) => {
        let cmp = 0;
        if (valueColumn && a.cell.type !== b.cell.type)
          cmp =
            TYPE_ORDER.indexOf(a.cell.type) - TYPE_ORDER.indexOf(b.cell.type);
        else if (valueColumn && a.cell.type === "number")
          cmp = compareNumbers(a.full, b.full);
        else cmp = a.full < b.full ? -1 : a.full > b.full ? 1 : 0;
        return sign * cmp;
      });
      filtered = indexed.map((x) => x.item);
    }
    const matched = filtered.length,
      pages = Math.max(1, Math.ceil(matched / PAGE_SIZE)),
      page = Math.max(0, Math.min(query.page, pages - 1));
    const rows = filtered
      .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      .map((item) => {
        const p = pathOf(item[0]);
        return {
          id: pointer(p),
          label: String(item[0]),
          path: p,
          cells: headers.map((_, i) => getCell(item, i)),
        };
      });
    const containers = items.filter(
      ([, v]) => v.type === "object" || v.type === "array",
    );
    return {
      ...common,
      headers,
      filterOptions,
      filterOptionsTruncated,
      rows,
      total,
      matched,
      page,
      pages,
      recordsAvailable,
      children: containers.slice(0, 200).map(([key, v]) => ({
        label: String(key),
        path: [...path, key],
        kind: v.type as Kind,
      })),
      truncatedChildren: containers.length > 200,
    };
  }
}
