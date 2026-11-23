import { expect, it } from "vitest";
import { createScanner, parseTree, SyntaxKind } from "jsonc-parser";
import { compactPrettyJson } from "../src/document/compactPrettyJson";

const compact = (text: string, eol = "\n") =>
  compactPrettyJson(text, parseTree(text)!, eol);
function tokens(text: string) {
  const scanner = createScanner(text, true);
  const result: string[] = [];
  while (scanner.scan() !== SyntaxKind.EOF)
    result.push(
      text.slice(
        scanner.getTokenOffset(),
        scanner.getTokenOffset() + scanner.getTokenLength(),
      ),
    );
  return result;
}
it("keeps short nested records and arrays inline under a multiline outer object", () => {
  const text =
    '{"project":"Gateway","signals":{"Speed":{"unit":"km/h","initial":0},"Enabled":{"initial":false}},"channels":["primary","secondary"]}';
  const result = compact(text);
  expect(result).toContain('\n  "channels": ["primary", "secondary"]');
  expect(result).toContain('{ "unit": "km/h", "initial": 0 }');
  expect(tokens(result)).toEqual(tokens(text));
});
it("expands long containers and accounts for the property name and indentation", () => {
  const text = JSON.stringify({
    long_property_name: Array.from({ length: 20 }, (_, n) => `value-${n}`),
  });
  const result = compact(text);
  expect(result).toContain('"long_property_name": [\n');
  expect(result.split("\n").every((line) => line.length <= 120)).toBe(true);
  expect(compact(result)).toBe(result);
});
it("preserves exact number and string tokens and uses the requested line endings", () => {
  const text =
    '{"large":9007199254740993,"exponent":1e400,"zero":-0,"decimal":0.123456789012345678901,"escaped":"\\u0061","empty":"","missing":null,"quoted":"a \\\" b"}';
  const result = compact(text, "\r\n");
  expect(tokens(result)).toEqual(tokens(text));
  expect(result.replaceAll("\r\n", "")).not.toContain("\n");
});
it("handles empty containers, primitive roots and overlong strings without splitting tokens", () => {
  for (const text of [
    "{}",
    "[]",
    "9007199254740993",
    '"hello"',
    '{"long":"' + "x".repeat(200) + '"}',
  ]) {
    expect(tokens(compact(text))).toEqual(tokens(text));
  }
});

it("packs long primitive arrays across bounded lines without changing exact tokens", () => {
  const text =
    '{"324846099":[337184268,337184288,337184284,337184263,337184298,337184269,337184280,337184297,337184281,337184296,337184279]}';
  for (const eol of ["\n", "\r\n"]) {
    const result = compact(text, eol);
    expect(result).toContain("337184268, 337184288, 337184284");
    expect(result.split(eol).filter((line) => /337184/.test(line)).length).toBe(
      2,
    );
    expect(result.split(eol).every((line) => line.length <= 120)).toBe(true);
    expect(tokens(result)).toEqual(tokens(text));
    expect(compact(result, eol)).toBe(result);
  }
});
it("keeps mixed primitive tokens intact and separates object records", () => {
  const primitives =
    '{"values":[' +
    Array(12).fill('9007199254740993,1e400,-0,true,null,"\\u0061"').join(",") +
    "]}";
  expect(tokens(compact(primitives))).toEqual(tokens(primitives));
  const records = JSON.stringify({
    records: Array.from({ length: 8 }, (_, id) => ({ id, name: "record" })),
  });
  const result = compact(records);
  expect(
    result.split("\n").filter((line) => line.includes('{ "id"')).length,
  ).toBe(8);
});
