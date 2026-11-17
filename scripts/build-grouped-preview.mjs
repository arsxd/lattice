import { build } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
await build({
  configFile: false,
  root: resolve("prototypes/grouped"),
  base: "./",
  build: {
    outDir: resolve("output/grouped-dist"),
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 10000000,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
let html = await readFile("output/grouped-dist/index.html", "utf8");
for (const match of [
  ...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g),
]) {
  const code = await readFile(resolve("output/grouped-dist", match[1]), "utf8");
  html = html.replace(
    match[0],
    () =>
      `<script type="module">${code.replace(/<\/script/gi, "<\\/script")}</script>`,
  );
}
for (const match of [
  ...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g),
]) {
  const css = await readFile(resolve("output/grouped-dist", match[1]), "utf8");
  html = html.replace(
    match[0],
    () => `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
  );
}
for (const file of ["LICENSE", "public/third-party-notices.txt"]) {
  const notice = await readFile(file, "utf8");
  html = html.replace(
    "</body>",
    () =>
      `<script type="text/plain">${notice.replace(/<\/script/gi, "<\\/script")}</script></body>`,
  );
}
await mkdir("output", { recursive: true });
await writeFile("output/Lattice-Grouped-Preview.html", html);
console.log("Created output/Lattice-Grouped-Preview.html");
