# Lattice — JSON Workbench

Edit JSON with a spreadsheet-style interface: document tabs, nested tables, inline cells, row/column operations, sorting, filters and source comparison.

**Development build.** Basic use has been tested by the project owner. Windows desktop execution, broad browser coverage and several newer UI interactions remain unverified. See [the handoff](docs/HANDOFF.md) for evidence and limitations.

## Use the offline app

**No installation needed:** [download Lattice-Offline.html](https://github.com/arsxd/lattice/releases/download/v0.1.0/Lattice-Offline.html), then open the downloaded file in your browser. If no latest stable release exists, use the [Releases page](https://github.com/arsxd/lattice/releases) and select the offline HTML asset from the development preview. The optional ZIP contains the same HTML and brief instructions. Do not use GitHub’s source-code ZIP to run the app directly.

To build from source on a development machine:

```sh
npm ci
npm run offline:build
```

Open `output/Lattice-Offline.html` in a browser. End users copy only that HTML file; they do not need Node, Rust or a local server. Browser restrictions may affect direct-file operation. Save/Save as requires supported file-picker APIs and user permission; other browsers use Download. There is no exclusive file lock or browser recovery journal.

Generated apps are excluded from Git. Share them separately or attach reviewed artifacts to a release; do not commit company JSON files.

## Develop

Node 24+ is the documented development requirement. Install dependencies with `npm ci`.

| Command | Purpose |
|---|---|
| `npm run web:dev` | Local browser development, port 1420 |
| `npm run web:build` | Static site in `dist/` |
| `npm run web:preview` | Preview the static build |
| `npm run offline:build` | Single-file HTML in `output/` |
| `npm run desktop` | Native development; Rust and platform prerequisites required |
| `npm test` | Engine, clipboard, recovery and browser-save mock tests |
| `npm run bench` | Machine-specific engine benchmark |

Native prerequisites and Windows instructions: [Windows](docs/WINDOWS.md). Web deployment: [web guide](docs/WEB.md). There is no hosted deployment or verified Windows installer yet.

## Features and limits

- Separate documents and undo histories; top-level sheets and nested-table navigation.
- Type-to-replace, F2/double-click editing, Enter/Tab movement, click-to-commit and Escape cancellation.
- Range selection, rectangular TSV clipboard operations, fill-down and row/column menus.
- Exact numeric token preservation; view-only sorting and combined filters.
- Source jump and aligned text diff review.
- Native conflict checks/recovery; capability-based browser saving with external-change checks.

Limits include 500-row pages, 200 table fields, 10,000-cell bulk operations, and 2,000 distinct values in filter checklists. Paste cannot automatically extend the table or span pages. No formula evaluation, complete Excel compatibility, ARXML importer or AUTOSAR conformance validation is implemented.

## Current interaction details

- Column menus own filtering and sorting; header clicks do not move the active sort.
- Source opens at the active cell; no separate source-jump row is rendered.
- Reload source refreshes the active document, with an unsaved-edit prompt.
- Browser reload/close requests confirmation while a document is open; browser rules apply.

## Repository map

```text
src/                  React UI, grid, document engine, workers and platform adapter
src-tauri/            Rust desktop host, icons and native configuration
assets/               Editable source artwork
scripts/              Offline packaging and benchmark scripts
tests/                Automated behavioral checks
docs/                Current handoff, interaction and deployment documentation
docs/archive/        Original proposals, research and historical mockup
.github/workflows/    Build and verification jobs
```

Start with [docs/HANDOFF.md](docs/HANDOFF.md). [CONTRIBUTING.md](CONTRIBUTING.md) describes checks and submission workflow. [CHANGELOG.md](CHANGELOG.md) records the current feature history.

The owner selected Lattice as the product name, with JSON Workbench as its subtitle. The desktop identifier and local storage keys intentionally retain their legacy names for continuity. Naming availability and trademark clearance are unverified. No project license has been selected; publishing a repository does not itself grant an open-source license.
