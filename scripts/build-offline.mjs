import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
let html = await readFile("dist/index.html", "utf8");
html = html.replace(/<link\b[^>]*rel="manifest"[^>]*>/g, "");
for (const match of [
  ...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g),
]) {
  const code = await readFile(resolve("dist", match[1]), "utf8");
  html = html.replace(
    match[0],
    () =>
      `<script type="module">${code.replace(/<\/script/gi, "<\\/script")}</script>`,
  );
}
for (const match of [
  ...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g),
]) {
  const css = await readFile(resolve("dist", match[1]), "utf8");
  html = html.replace(
    match[0],
    () => `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
  );
}

const notices = await readFile("public/third-party-notices.txt", "utf8");
html = html.replace(
  "</body>",
  () =>
    `<script type="text/plain" id="third-party-notices">${notices.replace(/<\/script/gi, "<\\/script")}</script></body>`,
);
await mkdir("output", { recursive: true });
await writeFile("output/Lattice-Offline.html", html);
console.log("Created output/Lattice-Offline.html");

// Refresh legacy filenames so old bookmarks/copies in this output folder are current.
for (const name of [
  "JSON-Workbench-Offline.html",
  "JSON-Ledger-Offline.html",
]) {
  await writeFile("output/" + name, html);
}
