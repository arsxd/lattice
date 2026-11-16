import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const name = "Lattice-Offline.html";
const hash = createHash("sha256")
  .update(await readFile(`output/${name}`))
  .digest("hex");
await writeFile("output/SHA256SUMS.txt", `${hash}  ${name}\n`);
console.log(`Created output/SHA256SUMS.txt for ${name}`);
