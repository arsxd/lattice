import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ValueBar } from "../src/editor/ValueBar";
const render = (value: string, previewOnly = false) =>
  renderToStaticMarkup(
    createElement(ValueBar, {
      address: "B2",
      value,
      editable: true,
      previewOnly,
      onCommit: async () => {},
    }),
  );
it("renders exact whitespace in a single-row accessible textarea", () => {
  const html = render("  leading\ntrailing  ");
  expect(html).toContain("<textarea");
  expect(html).toContain('aria-label="Selected cell value"');
  expect(html).toContain('rows="1"');
  expect(html).toContain(">  leading\ntrailing  </textarea>");
});
it("keeps previews read only even if editing was otherwise allowed", () => {
  expect(render("[1, 2, 3]", true)).toContain('readOnly=""');
  expect(render("editable")).not.toContain("readOnly");
});
