# Performance and limits

**Historical measurements:** the first two tables below were recorded before rc.4. The [rc.8 measurements](#rc8-measurements) section re-measures the same workflows. They describe one synthetic shape on one machine, not a current-version benchmark or supported maximum.

Measured 2026-11-13 on Apple M4, macOS arm64, Chromium 158.0.8127.18. Production build, 1440 × 900 viewport, no CPU throttling. Three runs per size; fresh page per run in a reused browser. Generic product records include strings, numbers, booleans, arrays and nested objects.

## Current input and preview limits

| Area                     | Limit                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Input                    | UTF-8; 64 MiB file limit, 256 nesting levels and a four-million-token indexing budget |
| Table projection         | 500 rows per page; up to 200 record fields                                            |
| Bulk operations          | 10,000 cells; clipboard value-character limit of 16,777,216                           |
| Value checklist          | 2,000 distinct values                                                                 |
| Inline/value-bar preview | 4,096 characters; truncated value-bar previews cannot be committed                    |
| Details raw preview      | 8,192 characters                                                                      |
| Details contents table   | 20 rows, 10 columns, 100 cells, 32,768 source characters, 12 AST levels               |

Accepted size is not a guarantee of smooth interaction. Source/Review, wide or deeply nested data, multiple open files and device/browser memory can dominate cost. Use a separate copy when evaluating a large file.

## Historical browser workflows

Wall-clock medians in milliseconds (minimum–maximum). Measurements include Playwright overhead and two animation frames. Open starts at the file-input action and ends when the grid is visible. Navigate opens the records table. Edit ends when the new value appears; Sort includes waiting for the preceding edit refresh to finish. These are workflow timings, not INP or isolated engine timings.

| Fixture |   Rows |          Open |      Navigate |        Select |          Edit |          Sort |
| ------- | -----: | ------------: | ------------: | ------------: | ------------: | ------------: |
| ~1 MiB  |  3,785 | 163 (162–164) |  100 (99–100) |   84 (82–100) | 100 (100–101) | 117 (116–133) |
| ~5 MiB  | 18,927 | 245 (244–262) | 150 (150–150) | 100 (100–100) | 101 (101–101) | 166 (117–182) |
| ~25 MiB | 94,636 | 862 (862–862) | 249 (249–265) | 167 (167–167) | 150 (150–150) | 483 (483–501) |

All nine runs completed without page errors. Each measured view rendered 216 data cells despite the larger collection sizes. No main-thread tasks over 50 ms were recorded by the observer during these runs; this does not measure worker CPU or guarantee smoothness on other hardware. Browser/process memory was not measured.

The file input uses an on-disk fixture path. Passing a large in-memory buffer through automation injected an artificial file-transfer long task; those preliminary timings were excluded.

## rc.8 measurements

Re-measured 2026-11-23 on Apple M4, macOS arm64, Chromium 158.0.8127.18 (Playwright), production preview of the code released as rc.9, including the column-menu fix below. Same fixtures as above, three runs per size. The script was updated for the current grid (hidden Index column, lettered column buttons, JSON-form value bar). Slow steps now wait on a per-frame check instead of Playwright's assertion retries, which poll at 100 to 1,000 ms steps and inflated earlier sort figures by up to about 350 ms. Sort and Re-sort include opening the column menu, its short fade and loading its value list.

| Fixture |   Rows |          Open |      Navigate |        Select |          Edit |          Sort |       Re-sort |
| ------- | -----: | ------------: | ------------: | ------------: | ------------: | ------------: | ------------: |
| ~1 MiB  |  3,785 | 191 (173–277) |  149 (99–150) | 116 (100–117) | 117 (100–118) | 350 (349–350) | 350 (334–350) |
| ~5 MiB  | 18,927 | 288 (271–326) | 150 (150–150) | 117 (116–117) | 100 (100–120) | 383 (380–383) | 383 (383–383) |
| ~25 MiB | 94,636 | 874 (873–876) | 250 (249–250) | 166 (165–183) | 151 (150–168) | 800 (766–833) | 650 (633–667) |

All nine runs completed without page errors or recorded long tasks; each view rendered 175 data cells. The earlier table's sort timings came from a different menu and measurement method and are not directly comparable.

**Fix found while measuring:** opening a column menu asked the worker for a full sorted and filtered projection just to list filter values. Because the worker handles one request at a time, a following sort waited for it. The value-list request now skips sort, filters and search (the list is always built from every row). At 25 MiB re-sorting dropped from about 880 ms to about 650 ms on this machine.

Node engine only (`npm run bench`, same machine): 5,000 rows opened in 28 ms and projected in 16 ms; 100,000 rows opened in 448 ms and projected in 65 ms with about 678 MiB process RSS. Sorting 94,636 rows in the engine takes about 430 ms. This does not include browser memory.

## Findings

The larger fixture exposed a query race: sorting immediately after a nested-table edit could update the indicator while the final refresh was still busy, leaving rows unsorted. Query changes are now guarded and filter buttons disabled until the operation completes. A deterministic browser test delays the final refresh to retain this regression check. Those findings describe the measured build. Later rc.4 changes include worker-based Source formatting, bounded inline previews and removal of redundant projection work; the historical timings do not quantify those changes.

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
