# Lattice — JSON Workbench

**Edit JSON using a spreadsheet-style interface.** Open a local file, work with cells and nested tables, and review the resulting source changes.

Lattice is built for people who are comfortable with spreadsheets and need to edit structured JSON. It runs as a self-contained HTML file in your browser—no npm, installation or local server is needed to use the downloaded app.

**Current release: v0.1.3, development preview.** Feedback and reproducible bug reports are welcome. This is an actively developed tool; keep a copy of important files.

## Download and run

1. [Download Lattice-Offline.html](https://github.com/arsxd/lattice/releases/download/v0.1.3/Lattice-Offline.html).
2. Open the downloaded file in a desktop browser. Start with Chrome or Edge; browser/platform coverage is incomplete.
3. Click **Open…** and choose a JSON file, or explore the included example.
4. Edit the table. Use **Save** when your browser supports direct file access, or **Download** to export a copy.

Prefer a ZIP? [Download and extract it](https://github.com/arsxd/lattice/releases/download/v0.1.3/Lattice-Offline.zip), then open the HTML inside. The GitHub **Code → Download ZIP** option contains source code, not the ready-to-run app.

[Release notes and checksums](https://github.com/arsxd/lattice/releases/tag/v0.1.3) · [User guide](docs/USER-GUIDE.md) · [Report a bug](https://github.com/arsxd/lattice/issues/new?template=bug_report.md)

## What it does

| Task | How Lattice handles it |
|---|---|
| Edit records | Inline cells, add/insert/duplicate/delete rows, editable object keys |
| Work with columns | Add, rename, delete, sort, filter and freeze leading columns |
| Copy spreadsheet data | Rectangular TSV copy/paste, range selection and fill-down |
| Explore nested JSON | Sheet tabs, nested tables, breadcrumbs and inline simple arrays |
| Work across files | Document tabs with separate edit histories |
| Inspect changes | Source navigation and aligned highlighted before/after diff |
| Preserve values | Exact numeric tokens, including large integers and exponents |

## Editing basics

- **Type** on a selected cell to replace it; **double-click/F2** to edit.
- **Enter / Shift+Enter:** commit and move down/up.
- **Tab / Shift+Tab:** commit and move right/left. **Escape:** cancel.
- Drag, Shift+click or Shift+arrows to select a range. **Ctrl+D / Cmd+D:** fill down.
- Right-click for row/column actions. Use the column-header dropdown to sort/filter.
- Select a cell and click **Source** to locate its JSON value. Source edits are staged until **Apply source**; **Discard draft** restores committed text.

See the [user guide](docs/USER-GUIDE.md) for saving, external edits and troubleshooting.

## Files, permissions and privacy

The application processes documents in browser memory. No document-upload endpoint or analytics integration is implemented. The downloaded HTML includes its application code, styles and document worker.

Direct **Save** requires supported browser file APIs and your permission. Otherwise **Download** exports a copy and leaves the app marked unsaved because it cannot confirm the download was saved. Save checks for detected external changes; it does not lock the file. Browser folder memory and permissions may be limited for local HTML, private browsing or managed computers.

**Reload source** reads the latest selected file and prompts before discarding edits. Browser reload/close requests a confirmation while documents are open, but the browser controls whether the warning appears. The browser version has no crash-recovery journal.

## Current limits and verification

- 500-row pages, 200 record fields, 10,000-cell bulk operations and up to 2,000 distinct checklist filter values.
- Paste stays inside the current page; add rows/columns before pasting beyond the table.
- Freeze rows applies to the current page, at most 10,000 projected cells. Sticky scrolling needs broader browser testing.
- Existing scalar types are preserved. Unknown blank fields default to text unless the column provides a consistent scalar type.
- No formula evaluation, complete Excel compatibility, ARXML importer or AUTOSAR validation.
- v0.1.3 builds and 75 automated tests pass. These include engine behavior and browser-file mocks, not comprehensive UI/permission testing.
- Basic use has been tested by the owner. Windows folder persistence, latest freeze-pane behavior, accessibility and IME coverage remain incomplete.
- GitHub Actions has successfully built web, macOS and Windows artifacts for earlier checkpoints. A successful installer build does not establish installation/runtime correctness.

## Build and contribute

Development requires Node 24+; native desktop builds additionally require Rust and [platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run web:dev
```

| Command | Output / purpose |
|---|---|
| `npm test` | Automated behavioral checks |
| `npm run offline:build` | `output/Lattice-Offline.html` |
| `npm run web:build` | Static site in `dist/` |
| `npm run web:preview` | Preview the static build |
| `npm run desktop` | Tauri desktop development |
| `npm run bench` | Machine-specific engine benchmark |

Generated output is excluded from Git and distributed through Releases. Never commit private JSON datasets, credentials or local recovery files.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

No project license has been selected. Public source availability alone does not grant an open-source license.
