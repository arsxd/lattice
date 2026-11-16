import { readFile, writeFile, readdir } from "node:fs/promises";

// Include all installed production dependencies, even if bundling eliminates some.
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const sections = [
  "Third-party software notices\n\nLattice project code uses 0BSD. These dependencies retain their own licenses.",
];
let count = 0;
for (const [directory, metadata] of Object.entries(lock.packages).sort(
  ([a], [b]) => a.localeCompare(b, "en"),
)) {
  if (!directory || metadata.dev) continue;
  const pkg = JSON.parse(await readFile(`${directory}/package.json`, "utf8"));
  if (pkg.version !== metadata.version)
    throw Error(`Installed dependency differs from lockfile: ${directory}`);
  const names = (await readdir(directory))
    .filter((name) => /^(licen[cs]e|notice)([._-]|$)/i.test(name))
    .sort();
  if (!names.length) throw Error(`Missing license text: ${pkg.name}`);
  sections.push(
    `${pkg.name}@${pkg.version}\n${typeof pkg.repository === "string" ? pkg.repository : (pkg.repository?.url ?? "")}`,
  );
  for (const name of names)
    sections.push(
      `${name}\n\n${(await readFile(`${directory}/${name}`, "utf8")).replace(/\r\n?/g, "\n").trim()}`,
    );
  count++;
}
await writeFile(
  "public/third-party-notices.txt",
  sections.join("\n\n" + "=".repeat(72) + "\n\n") + "\n",
);
await writeFile("public/license.txt", await readFile("LICENSE"));
console.log(
  `Generated notices for ${count} production dependencies and copied the project license.`,
);
