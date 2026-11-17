import { DocumentEngine, type Path } from "../../src/document/engine";
import { groupedView, type GroupSort } from "../../src/document/groupedView";
import type { GroupedProjection } from "../../src/document/groupedProjection";
import { readJsonFile } from "../../src/platform/files";
import "./style.css";
const sample =
  '{"orders":[{"order":"SO-1042","customer":"Northwind","items":[{"product":"Keyboard","quantity":2,"price":89},{"product":"Monitor","quantity":1,"price":249}],"shipments":[{"carrier":"Parcel","status":"In transit"}]},{"order":"SO-1043","customer":"Cedar Studio","items":[{"product":"Mouse","quantity":3,"price":35},{"product":"USB hub","quantity":2,"price":49}],"shipments":[]},{"order":"SO-1044","customer":"Northwind","items":[],"shipments":[]}]}';
const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
const app = document.querySelector<HTMLDivElement>("#app")!;
const header = element("header");
header.append(
  element("strong", "Lattice"),
  element("span", "Grouped-row preview · read-only"),
);
const file = element("input");
file.type = "file";
file.accept = ".json,application/json";
file.hidden = true;
const open = element("button", "Open JSON…");
open.onclick = () => file.click();
header.append(open, file);
app.append(header);
const tools = element("section");
tools.className = "tools";
const paths = element("select");
paths.setAttribute("aria-label", "Parent collection");
const child = element("input");
child.value = "items";
child.setAttribute("aria-label", "Child array name");
const apply = element("button", "Show child array");
const search = element("input");
search.type = "search";
search.placeholder = "Filter values…";
search.setAttribute("aria-label", "Filter values");
for (const [label, control] of [
  ["Parent collection", paths],
  ["Child array", child],
] as const) {
  const field = element("label", label);
  field.append(control);
  tools.append(field);
}
tools.append(apply, search);
app.append(tools);
const notice = element("p");
notice.setAttribute("role", "status");
app.append(notice);
const scroller = element("div");
scroller.className = "sheet";
app.append(scroller);
const footer = element(
  "footer",
  "Parent headers sort whole groups; child headers sort within each group. Choose one child array at a time. This preview does not edit or save data.",
);
app.append(footer);
let engine: DocumentEngine;
let projection: GroupedProjection | undefined;
let sort: GroupSort | undefined;
const collections = new Map<string, Path>();
function load(text: string, name: string) {
  engine = new DocumentEngine(text);
  collections.clear();
  paths.replaceChildren();
  const walk = (at: Path, depth: number) => {
    if (collections.size >= 100 || depth > 4) return;
    const key = JSON.stringify(at);
    collections.set(key, at);
    const option = element("option", at.length ? "/" + at.join("/") : "root");
    option.value = key;
    paths.append(option);
    for (const entry of engine.outline(at).children)
      walk(entry.path, depth + 1);
  };
  try {
    if (engine.diagnostics.length)
      throw new Error(
        "This preview needs valid JSON. Use Lattice Source to repair the file.",
      );
    walk([], 0);
    const preferred = [...collections].find(([, at]) => at.at(-1) === "orders");
    if (preferred) paths.value = preferred[0];
    notice.textContent = name;
    show();
  } catch (error) {
    fail(error);
  }
}
function fail(error: unknown) {
  projection = undefined;
  scroller.replaceChildren();
  notice.textContent = error instanceof Error ? error.message : String(error);
}
function show() {
  try {
    projection = engine.grouped(
      collections.get(paths.value) ?? [],
      child.value,
    );
    sort = undefined;
    render();
  } catch (error) {
    fail(error);
  }
}
function render() {
  if (!projection) return;
  scroller.replaceChildren();
  const view = groupedView(projection, search.value, sort);
  const table = element("table");
  const head = element("thead");
  const bands = element("tr");
  for (const [title, count] of [
    ["Parent", view.parentHeaders.length],
    [child.value, view.childHeaders.length],
  ] as const) {
    if (!count) continue;
    const th = element("th", title);
    th.colSpan = count;
    th.scope = "colgroup";
    bands.append(th);
  }
  head.append(bands);
  const titles = element("tr");
  for (const [scope, headers] of [
    ["parent", view.parentHeaders],
    ["child", view.childHeaders],
  ] as const)
    headers.forEach((title, column) => {
      const th = element("th");
      th.scope = "col";
      const active = sort?.scope === scope && sort.column === column;
      th.setAttribute(
        "aria-sort",
        active ? (sort!.descending ? "descending" : "ascending") : "none",
      );
      const button = element(
        "button",
        title + (active ? (sort!.descending ? " ↓" : " ↑") : ""),
      );
      button.title =
        scope === "parent"
          ? "Sort parent groups"
          : "Sort children within each parent";
      button.onclick = () => {
        sort = {
          scope,
          column,
          descending: active ? !sort!.descending : false,
        };
        render();
      };
      th.append(button);
      titles.append(th);
    });
  head.append(titles);
  table.append(head);
  for (const group of view.groups) {
    const body = element("tbody");
    const rows = group.children.length ? group.children : [null];
    rows.forEach((cells, index) => {
      const tr = element("tr");
      if (index === 0)
        for (const cell of group.parent) {
          const td = element("td", cell.text.slice(0, 240));
          td.rowSpan = rows.length;
          td.className = "parent";
          td.title = "/" + cell.path.join("/");
          tr.append(td);
        }
      for (let column = 0; column < view.childHeaders.length; column++) {
        const cell = cells?.[column];
        const td = element("td", cell?.text.slice(0, 240) ?? "");
        td.title = cell ? "/" + cell.path.join("/") : "No child rows";
        tr.append(td);
      }
      body.append(tr);
    });
    table.append(body);
  }
  scroller.append(table);
  notice.textContent = `${view.groups.length} parent groups · ${view.groups.reduce((sum, group) => sum + group.children.length, 0)} child rows · preview values limited to 240 characters`;
}
apply.onclick = show;
paths.onchange = show;
search.oninput = render;
file.onchange = async () => {
  const selected = file.files?.[0];
  if (!selected) return;
  open.disabled = true;
  try {
    if (selected.size > 2 * 1024 * 1024)
      throw new Error("This preview supports files up to 2 MiB.");
    load(await readJsonFile(selected), selected.name);
  } catch (error) {
    fail(error);
  } finally {
    open.disabled = false;
    file.value = "";
  }
};
load(sample, "Sample orders");
