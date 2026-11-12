import { describe, it, expect } from "vitest";
import { DocumentEngine, type Query } from "../src/document/engine";
const q: Query = { path: [], records: true, search: "", page: 0 };
const input =
  '{"1":{"conn_pin":"pin 0","pin_name":"first","id":9007199254740993},"2":{"conn_pin":"pin 1","pin_name":"second","id":1e400}}';
describe("spreadsheet row and column operations", () => {
  it("adds key 3 as a blank record without collapsing the table", () => {
    const d = new DocumentEngine(input),
      before = d.project(q).headers;
    d.mutate({ action: "add-row", path: [] }, 0);
    const p = d.project(q);
    expect(p.headers).toEqual(before);
    expect(p.rows).toHaveLength(3);
    expect(d.raw(["3"])).toBe(
      '{"conn_pin": null, "pin_name": null, "id": null}',
    );
    expect(p.rows[2].cells[1]).toMatchObject({
      display: "null",
      type: "null",
      inputKind: "string",
    });
    expect(p.rows[2].cells[3]).toMatchObject({
      display: "null",
      inputKind: "number",
    });
    d.undo();
    expect(d.text).toBe(input);
    d.redo();
    expect(d.project(q).rows).toHaveLength(3);
  });
  it("adds a column to every record in one undo step without touching numeric tokens", () => {
    const d = new DocumentEngine(input);
    d.mutate({ action: "add-column", path: [], key: 'new "column"' }, 0);
    expect(d.project(q).headers.at(-1)).toBe('new "column"');
    expect(d.raw(["1", "id"])).toBe("9007199254740993");
    expect(d.raw(["2", "id"])).toBe("1e400");
    expect(d.raw(["1", 'new "column"'])).toBe("null");
    expect(d.raw(["2", 'new "column"'])).toBe("null");
    d.undo();
    expect(d.text).toBe(input);
    expect(d.project(q).undo).toBe(false);
    d.redo();
    expect(d.raw(["2", 'new "column"'])).toBe("null");
  });
  it("keeps a preexisting stray text entry visible without replacing it", () => {
    const d = new DocumentEngine(input.slice(0, -1) + ',"3":""}');
    const original = d.text;
    const p = d.project(q);
    expect(p.headers).toContain("conn_pin");
    expect(p.headers.at(-1)).toBe("Single value");
    expect(p.rows[2].cells[1].writable).toBe(false);
    expect(p.rows[2].cells.at(-1)?.type).toBe("string");
    d.mutate({ action: "add-column", path: [], key: "notes" }, 0);
    expect(d.raw(["3"])).toBe('""');
    d.undo();
    expect(d.text).toBe(original);
    d.mutate({ action: "add-row", path: [] }, d.revision);
    expect(d.raw(["4", "conn_pin"])).toBe("null");
  });
  it("appends array rows and uses union fields, not just the first record", () => {
    const d = new DocumentEngine('[{"a":true},{"b":2}]');
    d.mutate({ action: "add-row", path: [] }, 0);
    expect(d.raw([2])).toBe('{"a": null, "b": null}');
    const p = d.project(q);
    expect(p.rows[2].cells[1].inputKind).toBe("boolean");
    expect(p.rows[2].cells[2].inputKind).toBe("number");
  });
  it("rejects duplicate columns, stale commands and over-wide additions atomically", () => {
    const d = new DocumentEngine(input);
    expect(() =>
      d.mutate({ action: "add-column", path: [], key: "id" }, 0),
    ).toThrow();
    expect(d.text).toBe(input);
    expect(() => d.mutate({ action: "add-row", path: [] }, 9)).toThrow();
    expect(d.text).toBe(input);
    const wide = new DocumentEngine(
      JSON.stringify([
        Object.fromEntries(Array.from({ length: 200 }, (_, i) => ["k" + i, i])),
      ]),
    );
    const before = wide.text;
    expect(() =>
      wide.mutate({ action: "add-column", path: [], key: "extra" }, 0),
    ).toThrow();
    expect(wide.text).toBe(before);
  });
  it("supports empty records, escaped keys, numeric keys beyond safe integer and named records", () => {
    const d = new DocumentEngine('{"9007199254740993":{}}');
    d.mutate({ action: "add-row", path: [] }, 0);
    expect(d.raw(["9007199254740994"])).toBe("{}");
    d.mutate({ action: "add-column", path: [], key: "__proto__" }, d.revision);
    expect(d.raw(["9007199254740994", "__proto__"])).toBe("null");
    const named = new DocumentEngine('{"row_1":{},"Signal":{}}');
    named.mutate({ action: "add-row", path: [] }, 0);
    expect(named.raw(["row_2"])).toBe("{}");
  });
});
