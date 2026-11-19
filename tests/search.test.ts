import { expect, it } from "vitest";
import { DocumentEngine } from "../src/document/engine";
import { textMatcher } from "../src/document/search";
it("search treats punctuation literally and respects case and Unicode word boundaries", () => {
  expect(textMatcher("a.b")("aXb")).toBe(false);
  expect(textMatcher("alpha", { caseSensitive: true })("Alpha")).toBe(false);
  const word = textMatcher("cat", { wholeWord: true });
  expect(word("cat!")).toBe(true);
  expect(word("cats")).toBe(false);
  expect(word("écat")).toBe(false);
});
it("search navigates matching cells across pages after filtering", () => {
  const engine = new DocumentEngine(
    JSON.stringify(
      Array.from({ length: 505 }, (_, id) => ({
        name: `item ${id}`,
        group: id % 2 ? "odd" : "even",
      })),
    ),
  );
  const result = engine.project({
    path: [],
    records: true,
    showIndex: false,
    search: "item",
    searchResult: 504,
    page: 0,
  });
  expect(result.searchMatchCount).toBe(505);
  expect(result.page).toBe(1);
  expect(result.searchSelection).toEqual({ row: 504, column: 0 });
  const filtered = engine.project({
    path: [],
    records: true,
    showIndex: false,
    search: "item",
    filters: { "1": "odd" },
    page: 0,
  });
  expect(filtered.searchMatchCount).toBe(252);
});
