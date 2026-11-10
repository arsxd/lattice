import { describe, expect, it } from "vitest";
import { scalarText } from "../src/editor/scalar";
import {
  packRecovery,
  unpackRecovery,
  WORKSPACE_NAME,
} from "../src/workspace/recovery";
import { DocumentEngine } from "../src/document/engine";

describe("spreadsheet scalar commits", () => {
  it("never converts numeric input through floating point", () => {
    for (const text of ["900719925474099312345", "-0", "1.2300", "1e400"]) {
      const engine = new DocumentEngine('{"value":0}');
      engine.mutate(
        { action: "replace", path: ["value"], raw: scalarText("number", text) },
        0,
      );
      expect(engine.text).toBe(`{"value":${text}}`);
      engine.undo();
      expect(engine.text).toBe('{"value":0}');
    }
  });
  it("preserves strings that resemble numbers, booleans, or formulas", () => {
    for (const text of ["0012", "true", "=SUM(A1:A3)", 'a"b\\c', ""])
      expect(JSON.parse(scalarText("string", text))).toBe(text);
  });
  it("rejects implicit type changes and non-JSON numbers", () => {
    for (const text of [
      "",
      " 2",
      "01",
      "NaN",
      "Infinity",
      "0x10",
      "1,000",
      "false",
    ])
      expect(() => scalarText("number", text)).toThrow();
    expect(() => scalarText("boolean", "1")).toThrow();
  });
});

describe("workspace recovery", () => {
  it("round trips multiple documents, same names, invalid drafts and exact numeric tokens", () => {
    const docs = [
      { name: "same.json", text: '{"n":1e400}' },
      { name: "same.json", text: '{"unfinished":' },
      { name: "other.json", text: "null" },
    ];
    expect(unpackRecovery(packRecovery(docs))).toEqual(docs);
  });
  it("accepts legacy checkpoints without interpreting their JSON", () => {
    const legacy = { name: "signals.json", text: '[{"name":"x","text":"y"}]' };
    expect(unpackRecovery(legacy)).toEqual([legacy]);
  });
  it("rejects damaged envelopes rather than silently dropping documents", () => {
    for (const text of ["{", "{}", '[{"name":"x"}]', "[null]"])
      expect(() => unpackRecovery({ name: WORKSPACE_NAME, text })).toThrow();
  });
});
