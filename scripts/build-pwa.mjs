import { readFile, writeFile, readdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = (await readdir("dist/assets")).map((x) => "./assets/" + x);
const files = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./third-party-notices.txt",
  "./icon-192.png",
  "./icon-512.png",
  ...assets,
];
for (const size of [192, 512])
  await copyFile(`assets/icon-${size}.png`, `dist/icon-${size}.png`);
await writeFile(
  "dist/manifest.webmanifest",
  JSON.stringify({
    id: "./",
    name: "Lattice",
    description:
      "JSON Workbench — edit local JSON as spreadsheet-style tables.",
    short_name: "Lattice",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#245fc5",
    icons: [192, 512].map((size) => ({
      src: `icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  }),
);
const hash = createHash("sha256");
for (const file of files.filter((x) => x !== "./"))
  hash.update(await readFile("dist/" + file.slice(2)));
const cache = "lattice-" + hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('lattice-')&&key!==CACHE).slice(0,-1).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request,{ignoreVary:true})||await caches.match(event.request,{ignoreVary:true});if(cached)return cached;try{return await fetch(event.request)}catch(error){if(event.request.mode==='navigate')return cache.match('./index.html');throw error}}))});`,
);
console.log("Created installable offline app:", cache);
