# Performance measurements

Measured 2026-11-13 on Apple M4, macOS arm64, Chromium 158.0.8127.18. Production build, 1440 × 900 viewport, no CPU throttling. Three runs per size; fresh page per run in a reused browser. Generic product records include strings, numbers, booleans, arrays and nested objects.

## Browser workflows

Wall-clock medians in milliseconds (minimum–maximum). Measurements include Playwright overhead and two animation frames. Open starts at the file-input action and ends when the grid is visible. Navigate opens the records table. Edit ends when the new value appears; Sort includes waiting for the preceding edit refresh to finish. These are workflow timings, not INP or isolated engine timings.

| Fixture |   Rows |          Open |      Navigate |        Select |          Edit |          Sort |
| ------- | -----: | ------------: | ------------: | ------------: | ------------: | ------------: |
| ~1 MiB  |  3,785 | 163 (162–164) |  100 (99–100) |   84 (82–100) | 100 (100–101) | 117 (116–133) |
| ~5 MiB  | 18,927 | 245 (244–262) | 150 (150–150) | 100 (100–100) | 101 (101–101) | 166 (117–182) |
| ~25 MiB | 94,636 | 862 (862–862) | 249 (249–265) | 167 (167–167) | 150 (150–150) | 483 (483–501) |

All nine runs completed without page errors. Each measured view rendered 216 data cells despite the larger collection sizes. No main-thread tasks over 50 ms were recorded by the observer during these runs; this does not measure worker CPU or guarantee smoothness on other hardware. Browser/process memory was not measured.

The file input uses an on-disk fixture path. Passing a large in-memory buffer through automation injected an artificial file-transfer long task; those preliminary timings were excluded.

## Findings

The larger fixture exposed a query race: sorting immediately after a nested-table edit could update the indicator while the final refresh was still busy, leaving rows unsorted. Query changes are now guarded and filter buttons disabled until the operation completes. A deterministic browser test delays the final refresh to retain this regression check. No speculative caching or parsing optimization was added.

## Reproduce

```sh
npm ci
npm run pwa:build
npm run web:preview -- --port 1424 --strictPort
```

In a second terminal:

```sh
npm run bench:browser
npm run bench
```

Browser results and synthetic fixtures are written under ignored `output/verification/`. Set `LATTICE_BENCH_MIB` (comma-separated sizes, 0.1–60), `LATTICE_BENCH_RUNS` (1–10), or `LATTICE_BENCH_URL` to vary the run. Use a production preview, not the development server. `npm run bench` separately measures the Node document engine and process RSS; it does not measure browser memory or total application latency.

## Limits of this evidence

This is one machine and one synthetic data shape. The 25 MiB result is not a maximum-size claim. Wide records, deeply nested values, many unique filter values, Source/Review on large documents, multiple open documents and lower-memory devices may behave differently. Input limits (including the four-million-token indexing budget) can reject documents below the byte limit. Full screen-reader, native browser zoom and target-device performance validation remain separate checks.
