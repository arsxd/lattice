import { copyFile } from "node:fs/promises";
await copyFile(
  "output/Lattice-Offline.html",
  "output/Lattice-Expanded-Preview.html",
);
console.log(
  "Created output/Lattice-Expanded-Preview.html — editable development build.",
);

await copyFile(
  "output/Lattice-Offline.html",
  "output/Lattice-Grouped-Preview.html",
);
