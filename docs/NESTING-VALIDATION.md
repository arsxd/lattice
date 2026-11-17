# Generated nesting audit — 2026-11-18

Tested version: **1.1.0-dev.11**, experimental branch. Seed: `539365656`. All files are synthetic and may be shared.

## Results

| Check | Result |
| --- | --- |
| Generated JSON fixtures | 76 |
| Regular projections inspected | 931 |
| Successful expanded projections | 818 |
| Explicit shape/size fallbacks during engine traversal | 113 |
| Edit, exact Undo and Redo checks | 73 |
| Projection/path/data-coverage failures | 0 |
| Sparse-layout heuristic warnings after fixes | 0 |
| Actual browser fixture opens | 76 |
| Browser script/geometry failures | 0 |
| Browser root views | 10 regular; 62 expanded; 3 fallback; 1 expected rejection |
| Largest generated fixture | 2,051,003 UTF-8 bytes |

Visual review also found that the nested status bar reported compact-table dimensions; dev.11 now reports the active nested table’s dimensions. The browser audit checks these counts.

The browser run also opened the small nested section inside the large-document fixture and confirmed it expanded. Headless Chromium was used on the local machine. Rendering was checked for every fixture; editing was checked separately through the engine audit and the release regression suite, not through every generated browser view.

## What testing found and changed

The initial 74-fixture dev.10 audit found no integrity failures, but flagged five sparse layouts: partially shared dictionary keys and deeper keys at varying nesting depths. Those were genuine view-quality gaps. Dev.11 uses bounded Key/Value rows for these cases. Repeating the audit with 76 fixtures found no remaining warnings under the defined heuristic.

The release regression checkpoint covers 197 unit tests and all 63 browser cases, including exact deep-path edits and Undo. Browser outcomes are local Chromium results, not Windows-native certification.

## Try the files

Download the release's HTML separately, then open any file in `fixtures/`. Enable Show nested data. Useful examples: `distinct-dictionaries.json`, `partial-overlap.json`, `deep-dictionaries.json`, `two-dictionaries.json`, `child-arrays.json`, `special-keys.json`, and `large-document-small-section.json`.

`bounded-depth.json` is intentionally beyond the supported 256-level depth. It should be rejected with an explanation. Other bounded fixtures should retain the regular view rather than force an oversized nested projection. `manifest.json` lists categories and focused nested paths; the machine-readable reports preserve detailed outcomes.

## Limits of the conclusion

These results support the tested structures; they do **not** prove the best view for every possible JSON document. The sparsity rule is a heuristic. Sibling record arrays/dictionaries use separate sections to avoid inventing combinations. Mixed arrays and over-limit nested shapes may need the regular table or navigation into a smaller table. Nested view is bounded to 2 MiB of selected source, 8 sections, 500 projected rows per section, 200 mapping columns, 10,000 rendered cells, and other documented parent/child limits. Regular editing accepts documents up to its separate 64 MiB/256-depth bounds.

This corpus is mostly small synthetic data, with two larger files. It is not a maximum-file-size benchmark, a Windows-native browser test, a screen-reader audit, or a universal performance guarantee. Light/dark, keyboard, clipboard, source/review, file safety and offline behavior also have dedicated regression tests.

## Reproduce

From the project folder: `npx tsx scripts/audit-nesting.ts`, build the standalone HTML, then `node scripts/audit-nesting-browser.mjs`. Rebuild the browser artifact after application changes; its SHA-256 is recorded in `browser-report.json`.
