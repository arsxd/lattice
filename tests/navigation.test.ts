import { expect, it } from "vitest";
import { recordNavigation } from "../src/navigation";
import { DocumentEngine, type Query } from "../src/document/engine";
const q = (path: Query["path"]): Query => ({
  path,
  records: true,
  search: "",
  page: 0,
});
it("restores locations and their latest filters when moving back and forward", () => {
  const root = q([]),
    books = q(["books"]),
    orders = q(["orders"]);
  const first = recordNavigation(undefined, root, books);
  const filtered = {
    ...books,
    search: "Atlas",
    sort: { column: 1, direction: "ASC" as const },
  };
  const second = recordNavigation(first, filtered, orders);
  expect(second.entries[1]).toEqual(filtered);
  const back = recordNavigation(second, orders, second.entries[1], 1);
  expect(back.index).toBe(1);
  expect(back.entries[back.index]).toEqual(filtered);
  expect(back.entries[2]).toEqual(orders);
  expect(first.entries[1]).toEqual(books);
});
it("drops forward entries only when visiting a new location and bounds history", () => {
  let history = recordNavigation(undefined, q([]), q(["a"]));
  history = recordNavigation(history, q(["a"]), q(["b"]));
  history = recordNavigation(history, q(["b"]), q(["a"]), 1);
  history = recordNavigation(history, q(["a"]), q(["c"]));
  expect(history.entries.map((x) => x.path)).toEqual([[], ["a"], ["c"]]);
  for (let i = 0; i < 110; i++)
    history = recordNavigation(history, history.entries[history.index], q([i]));
  expect(history.entries).toHaveLength(100);
  expect(history.index).toBe(99);
});
it("does not add duplicate locations when reopening the same table", () => {
  const history = recordNavigation(undefined, q(["a"]), {
    ...q(["a"]),
    search: "new",
  });
  expect(history.entries).toHaveLength(1);
  expect(history.entries[0].search).toBe("new");
});
it("outlines nested containers without scalar rows and preserves exact path components", () => {
  const engine = new DocumentEngine(
    '{"a/b":{"~key":[{"x":1}]},"flat":{"value":1},"scalar":7}',
  );
  const root = engine.outline([]);
  expect(root.children.map((x) => [x.path, x.expandable])).toEqual([
    [["a/b"], true],
    [["flat"], false],
  ]);
  expect(engine.outline(["a/b"]).children[0].path).toEqual(["a/b", "~key"]);
  expect(engine.outline(["a/b", "~key"]).children[0].path).toEqual([
    "a/b",
    "~key",
    0,
  ]);
  expect(engine.outline(["scalar"]).children).toEqual([]);
});
it("bounds each outline branch while keeping every entry accessible through the engine", () => {
  const text = JSON.stringify(
    Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`item${i}`, {}])),
  );
  const engine = new DocumentEngine(text);
  expect(engine.outline([])).toMatchObject({ truncated: true });
  expect(engine.outline([]).children).toHaveLength(200);
  expect(engine.raw(["item200"])).toBe("{}");
});
