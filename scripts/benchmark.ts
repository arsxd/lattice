import { performance } from "node:perf_hooks";
import { cpus, platform, release, arch } from "node:os";
import { writeFileSync, mkdirSync } from "node:fs";
import { DocumentEngine } from "../src/document/engine";
const results = [];
for (const count of [5000, 100000]) {
  const row =
    '{"name":"SampleProduct","id":9007199254740993,"category":"stationery","price":10,"currency":"USD","description":"Generic synthetic benchmark record.","stock":0,"enabled":true}';
  const text = "[" + Array(count).fill(row).join(",\n") + "]";
  let start = performance.now();
  const d = new DocumentEngine(text);
  const open = performance.now() - start;
  start = performance.now();
  const p = d.project({ path: [], records: true, search: "", page: 0 });
  const projection = performance.now() - start;
  const edits = [];
  for (let i = 0; i < 5; i++) {
    start = performance.now();
    d.mutate(
      { action: "replace", path: [0, "price"], raw: String(20 + i) },
      d.revision,
    );
    edits.push(performance.now() - start);
  }
  results.push({
    rows: count,
    bytes: Buffer.byteLength(text),
    openMs: open,
    projectionMs: projection,
    editMs: edits,
    returnedRows: p.rows.length,
    rssBytes: process.memoryUsage().rss,
  });
}
const report = {
  date: new Date().toISOString(),
  environment: {
    os: platform(),
    release: release(),
    arch: arch(),
    cpu: cpus()[0].model,
    node: process.version,
  },
  note: "Synthetic Node engine benchmark, not native WebView or total application memory. Five commits per fixture; no production performance guarantee.",
  results,
};
mkdirSync("output/verification", { recursive: true });
writeFileSync(
  "output/verification/benchmark.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
