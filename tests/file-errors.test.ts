import { expect, it } from "vitest";
import { describeFileError } from "../src/platform/fileErrors";
const dom = (name: string, message = "raw browser text") =>
  new DOMException(message, name);
it("explains a missing file in terms of what happened and what to do", () => {
  const save = describeFileError(dom("NotFoundError"), "save");
  expect(save).toMatch(/renamed, moved or deleted/);
  expect(save).toMatch(/Save as/);
  expect(save).not.toMatch(/raw browser text/);
  const reload = describeFileError(dom("NotFoundError"), "reload");
  expect(reload).toMatch(/renamed, moved or deleted/);
  expect(reload).toMatch(/Open/);
  expect(reload).not.toBe(save);
});
it("explains blocked, locked and full-disk failures", () => {
  expect(describeFileError(dom("NotAllowedError"), "save")).toMatch(/blocked/);
  expect(describeFileError(dom("SecurityError"), "open")).toMatch(/blocked/);
  expect(describeFileError(dom("NoModificationAllowedError"), "save")).toMatch(
    /another program|read-only/i,
  );
  expect(describeFileError(dom("QuotaExceededError"), "save")).toMatch(
    /space/i,
  );
});
it("keeps readable messages from our own errors and stringifies anything else", () => {
  expect(
    describeFileError(new Error("The file changed in another editor."), "save"),
  ).toBe("The file changed in another editor.");
  expect(describeFileError("plain text", "open")).toBe("plain text");
  expect(describeFileError(dom("DataError", "Odd"), "save")).toBe("Odd");
});
