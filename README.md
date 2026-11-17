# Lattice — JSON Workbench

Edit JSON like a spreadsheet. Work with cells, rows, and columns. Explore nested data and review your changes—without wrestling with JSON syntax.

**Current development build: v1.1.0-dev.13** — redesigned workspace and editable nested sheets.

[Download current HTML (dev.13)](https://github.com/arsxd/lattice/releases/download/v1.1.0-dev.13/Lattice-Offline.html) · [Open the local preview](output/Lattice-Expanded-Preview.html)

Download `Lattice-Offline.html` and open it directly in your browser. This is a development prerelease. The local-preview link is for a checkout built with `npm ci` followed by `npm run grouped:build`; generated HTML is not stored in the repository.

**Hosted app:** [Open Lattice](https://arsxd.github.io/lattice/) still runs the older v1.0.0-rc.3. [All releases](https://github.com/arsxd/lattice/releases).

RC3 does not include the development changes above. See the [candidate checklist](docs/RELEASE-CANDIDATE.md).

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

## Nesting validation

The experimental build has been checked with a reproducible synthetic nesting corpus. See [results and limits](docs/NESTING-VALIDATION.md), or [download the JSON fixtures](https://github.com/arsxd/lattice/releases/download/v1.1.0-dev.11/Lattice-Nesting-Fixtures.zip) to try them yourself. These checks do not establish an optimal view for every possible JSON shape.

## Examples

The bundled sample is a fictional bookshop with a keyed catalogue, orders, curated collections, reading lists, nested details and precision-sensitive numbers. [Additional examples](examples/README.md) include store orders, application settings, JSON value shapes and a before/after review pair.

## Editable expanded rows (development)

The `experiment/grouped-sheets` branch adds **Show nested data** beside Table/Source. Shared parent cells span their children and can be edited directly. This development feature is not in the RC3 download or hosted app. Build it with `npm run grouped:build`, then [open the generated HTML preview](output/Lattice-Expanded-Preview.html). Expansion currently supports a selected table up to 2 MiB; see the [design and bounds](prototypes/grouped/DESIGN.md).

To see merged rows and grouped column headers together in the development build, choose **Explore sample workspace → collections → Show nested data**.

![Shared collection cells and grouped details headers in one worksheet](docs/images/merged-worksheet.png)

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
| `npm run grouped:build` | Current development HTML in `output/Lattice-Expanded-Preview.html` |
| `npm run offline:build` | Self-contained `output/Lattice-Offline.html` |
| `npm run web:build`     | Static site in `dist/`                       |
| `npm run web:preview`   | Preview the built site                       |
| `npm run bench`         | Machine-specific engine benchmark            |

Read [CONTRIBUTING.md](CONTRIBUTING.md), [the web guide](docs/WEB.md), [keyboard checks](docs/ACCESSIBILITY.md) and [CHANGELOG.md](CHANGELOG.md). Report issues through the [bug report form](https://github.com/arsxd/lattice/issues/new?template=bug_report.md).

Lattice project code uses [0BSD](LICENSE): reuse does not require attribution or preservation of its license notice. Bundled dependencies retain their own licenses; [third-party notices](public/third-party-notices.txt) are included in the distribution and embedded in the standalone HTML.
