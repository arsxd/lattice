import { it, expect, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}));
import { saveFile } from "../src/platform/files";
function fixture(current: string) {
  const stream = {
    write: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  };
  const handle = {
    name: "test.json",
    getFile: vi.fn(
      async () =>
        ({
          size: current.length,
          arrayBuffer: async () => new TextEncoder().encode(current).buffer,
        }) as File,
    ),
    createWritable: vi.fn(async () => stream),
  };
  return { stream, handle };
}
it("confirms a browser save only after closing its writable stream", async () => {
  const { handle, stream } = fixture("{}");
  const saved = await saveFile(
    { name: "test.json", text: "{}", diskText: "{}", handle },
    '{"n":1e400}',
  );
  expect(stream.write).toHaveBeenCalledWith('{"n":1e400}');
  expect(stream.close).toHaveBeenCalled();
  expect(saved?.confirmed).toBe(true);
});
it("refuses externally modified files before creating a writer", async () => {
  const { handle } = fixture('{"external":true}');
  await expect(
    saveFile(
      { name: "test.json", text: "{}", diskText: "{}", handle },
      '{"mine":true}',
    ),
  ).rejects.toThrow("changed");
  expect(handle.createWritable).not.toHaveBeenCalled();
});
it("aborts a failed write and does not report successful saving", async () => {
  const { handle, stream } = fixture("{}");
  stream.write.mockRejectedValueOnce(new Error("disk full"));
  await expect(
    saveFile({ name: "test.json", text: "{}", diskText: "{}", handle }, "null"),
  ).rejects.toThrow("disk full");
  expect(stream.abort).toHaveBeenCalled();
  expect(stream.close).not.toHaveBeenCalled();
});
it("reloads latest browser file contents and refreshes its conflict baseline", async () => {
  const { reloadFile } = await import("../src/platform/files");
  const { handle } = fixture('{"external":2}');
  const loaded = await reloadFile({
    name: "test.json",
    text: "{}",
    diskText: "{}",
    handle,
  });
  expect(loaded?.text).toBe('{"external":2}');
  expect(loaded?.diskText).toBe(loaded?.text);
  expect(loaded?.handle).toBe(handle);
});

it("uses a stable Open picker ID so the browser can remember its directory", async () => {
  const { openFile } = await import("../src/platform/files");
  const { handle } = fixture("{}");
  const picker = vi.fn(async () => [handle]);
  vi.stubGlobal("showOpenFilePicker", picker);
  try {
    await openFile();
    await openFile();
    expect(picker).toHaveBeenCalledTimes(2);
    for (const [options] of picker.mock.calls as unknown as [
      Record<string, unknown>,
    ][])
      expect(options.id).toBe("lattice-open-json");
  } finally {
    vi.unstubAllGlobals();
  }
});
