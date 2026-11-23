import { it, expect, vi } from "vitest";
import { readJsonFile } from "../src/platform/files";
it("preserves BOM, CRLF and precise numeric spelling when reading a file", async () => {
  const text = '\ufeff{\r\n"n":9007199254740993\r\n}';
  expect(await readJsonFile(new File([text], "precise.json"))).toBe(text);
});
it("reports an actionable filename and encoding error without decoding invalid bytes", async () => {
  await expect(
    readJsonFile(new File([new Uint8Array([255, 254, 0])], "bad.json")),
  ).rejects.toThrow('"bad.json" could not be read as UTF-8');
});
it("rejects an oversized file before reading its contents", async () => {
  const arrayBuffer = vi.fn();
  await expect(
    readJsonFile({
      name: "large.json",
      size: 65 * 1024 * 1024,
      arrayBuffer,
    } as unknown as File),
  ).rejects.toThrow("too large");
  expect(arrayBuffer).not.toHaveBeenCalled();
});
