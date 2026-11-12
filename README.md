# Lattice — JSON Workbench

Edit JSON with a spreadsheet-style interface. Open a local file, work with cells and nested tables, and inspect the source changes.

[Open Lattice in your browser](https://arsxd.github.io/lattice/) — install it as an app in a supported browser, or use the offline download below.

## Download and run

1. [Download Lattice-Offline.html](https://github.com/arsxd/lattice/releases/download/v0.1.5/Lattice-Offline.html).
2. Open the downloaded file in your browser.
3. Choose **Open…** for your data, or **Explore sample workspace** to try the features.
4. Save using supported browser file access, or Download an edited copy.

No npm, installation or local server is needed to use the downloaded HTML. The repository's source ZIP is for development, not direct use.

[Releases](https://github.com/arsxd/lattice/releases) · [User guide](docs/USER-GUIDE.md) · [Report a bug](https://github.com/arsxd/lattice/issues/new?template=bug_report.md)

## Features

- Document tabs, sheet navigation and nested tables.
- Inline values and object-key editing; row and column operations.
- Range selection, TSV copy/paste and fill-down.
- Column sorting and combined value filters.
- Simple arrays inside cells, exact numeric tokens and source navigation.
- Read-only before/after source diff.

Documents are processed locally. No upload endpoint or analytics integration is implemented. Browser Save requires support and permission; Download is the fallback. The app detects some external-file conflicts but does not lock files or provide browser crash recovery. Browser close/reload warnings are best effort.

## Release scope

The public release line is `main` and distributes the browser/offline client only. The owner tested basic web workflows with real JSON on Windows at work. Broader coverage remains incomplete; keep backups of important files. Automated tests do not establish every browser permission, clipboard, focus or accessibility behavior.

Experimental features and the native desktop project are retained on `dev`. They are not part of the current release. Freeze panes was removed from the release line after reported problems.

Limits: 500-row pages, 200 record fields, 10,000-cell bulk operations, and 2,000 distinct checklist values. Paste can span pages but cannot grow the table. No formula evaluation, full Excel compatibility or schema validation.

## Sample workspace

[Downloadable examples and screenshot recipes](examples/README.md) cover a fictional bookshop, store orders, application settings, JSON value shapes and a before/after review pair.

The bundled fictional bookshop contains a keyed catalogue, orders, reading lists, simple arrays, blanks, nested details and precision-sensitive numbers. No work-specific schemas or datasets are used.

For a screenshot: open the sample, select the books sheet, choose a useful column filter or nested book details, and capture the actual UI. Use the orders sheet for an array-of-records example. Screenshots should reflect the released app; none are fabricated or included as unverified mockups.

## Develop

Node 24+ is the documented development requirement.

```sh
npm ci
npm run web:dev
```

| Command | Purpose |
|---|---|
| `npm test` | Behavioral checks |
| `npm run offline:build` | Self-contained `output/Lattice-Offline.html` |
| `npm run web:build` | Static site in `dist/` |
| `npm run web:preview` | Preview the built site |
| `npm run bench` | Machine-specific engine benchmark |

Read [CONTRIBUTING.md](CONTRIBUTING.md), [the web guide](docs/WEB.md) and [CHANGELOG.md](CHANGELOG.md). Generated output, private development notes and local fixtures are excluded from Git. No project license has been selected; public source availability alone does not grant an open-source license.

## Install the web app

Open [Lattice](https://arsxd.github.io/lattice/) in Chrome or Edge and use the browser’s address-bar install icon or install command in its menu. It opens in a separate app window. After the first successful load it can run offline. Installation may be restricted by corporate browser policy. Your JSON stays in your browser. The single-file offline download remains available.

The hosted welcome page includes dismissible installation guidance. It shows **Install Lattice** when the browser offers a direct prompt, and browser-menu instructions otherwise. It stays out of the editing workspace; **Not now** hides it for the browser session.
