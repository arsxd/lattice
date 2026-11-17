# Lattice — JSON Workbench

Edit JSON like a spreadsheet. Work with cells, rows, and columns. Explore nested data and review your changes—without wrestling with JSON syntax.

[Open Lattice](https://arsxd.github.io/lattice/) · [Download offline HTML](https://github.com/arsxd/lattice/releases/download/v1.0.0-rc.3/Lattice-Offline.html) · [Releases](https://github.com/arsxd/lattice/releases)

**Release candidate:** v1.0.0-rc.3 is for validation before a stable release. See the [candidate checklist](docs/RELEASE-CANDIDATE.md).

## Use

Open Lattice in your browser, or download `Lattice-Offline.html` and open it directly. Choose **Open JSON file…**, **New document**, or **Explore sample workspace**. Save with supported browser file access, or Download an edited copy. The offline HTML requires no installation, Node or local server.

The hosted app can also be installed through a supported browser. Load it online once before using it offline. When an update is available, save your work and close all Lattice windows and tabs before reopening.

## Features

- Spreadsheet-style editing for JSON values, object keys and nested tables.
- Document tabs, sheet navigation, row and column operations.
- Range selection, TSV copy/paste and fill-down.
- Column sorting and combined value filters.
- Simple arrays inside cells and exact numeric tokens.
- Source editing and before/after review with per-change restore, validation and undo.
- Frozen rows and columns, resizable panes and multiline previews.
- Optional local draft recovery.

![The sample book catalogue in Lattice’s spreadsheet view](docs/images/table.png)

![Reviewing a price edit beside the saved JSON](docs/images/review.png)

## Files and browser support

Documents are processed locally; no document-upload endpoint or analytics integration is implemented. Browser Save requires API support and permission; Download is the fallback. Local recovery is off by default and, when enabled, stores unsaved drafts in this browser. It does not replace saving. External-file conflict detection and close/reload warnings have limits; keep a separate copy of important files.

Input limits are UTF-8, 64 MiB and 256 nesting levels. Tables use 500-row pages and support up to 200 record fields, 10,000-cell bulk operations and 2,000 distinct checklist values. Paste cannot grow a table. There is no formula evaluation or schema validation. See the [measured performance and limitations](docs/PERFORMANCE.md) and [user guide](docs/USER-GUIDE.md) for details and [browser checks](docs/WINDOWS.md) for verification steps.

## Examples

The bundled sample is a fictional bookshop with a keyed catalogue, orders, reading lists, nested details and precision-sensitive numbers. [Additional examples](examples/README.md) include store orders, application settings, JSON value shapes and a before/after review pair.

## Editable expanded rows (development)

The `experiment/grouped-sheets` branch adds **Expand nested rows** beside Table/Source. Shared parent cells span their children and can be edited directly. This development feature is not in the RC3 download or hosted app. Build it with `npm run grouped:build`, then open `output/Lattice-Expanded-Preview.html`. Expansion currently supports a selected table up to 2 MiB; see the [design and bounds](prototypes/grouped/DESIGN.md).

## Develop

Node 24+ is the documented development requirement.

```sh
npm ci
npm run web:dev
```

| Command                 | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `npm test`              | Unit and regression checks                   |
| `npm run test:browser`  | Chromium browser workflows                   |
| `npm run offline:build` | Self-contained `output/Lattice-Offline.html` |
| `npm run web:build`     | Static site in `dist/`                       |
| `npm run web:preview`   | Preview the built site                       |
| `npm run bench`         | Machine-specific engine benchmark            |

Read [CONTRIBUTING.md](CONTRIBUTING.md), [the web guide](docs/WEB.md), [keyboard checks](docs/ACCESSIBILITY.md) and [CHANGELOG.md](CHANGELOG.md). Report issues through the [bug report form](https://github.com/arsxd/lattice/issues/new?template=bug_report.md).

Lattice project code uses [0BSD](LICENSE): reuse does not require attribution or preservation of its license notice. Bundled dependencies retain their own licenses; [third-party notices](public/third-party-notices.txt) are included in the distribution and embedded in the standalone HTML.
