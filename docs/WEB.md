# Lattice web and offline clients

Current application: **Lattice — JSON Workbench**. Updated 2026-11-13.

## Offline use

Build on a developer machine with `npm ci` then `npm run offline:build`. Transfer `output/Lattice-Offline.html` to the end-user computer and open it in a browser. Node, Rust and a local server are not required there. The HTML embeds application code, styles, favicon and document worker. The packager also refreshes the old JSON-Workbench/JSON-Ledger filenames locally; Lattice is the canonical filename.

The project owner reported basic browser use works. That does not verify all Windows, corporate-policy, permission, clipboard or focus scenarios. Browsers may restrict file URLs and downloads; never bypass managed security controls. The hosted app is at https://arsxd.github.io/lattice/. No document-upload endpoint is implemented.

## Development and static hosting

```sh
npm ci
npm run web:dev
```

For a static server build:

```sh
npm run web:build
npm run web:preview
```

Host `dist/` over HTTP(S). The multi-file dist entry point is not the offline deliverable; use the packaged HTML for direct-file use. For installation/offline caching, build with `npm run pwa:build`; the generated service worker caches application assets only.

## Open, Save and external changes

Supported browser picker APIs retain a file handle. Save writes back after checking current decoded contents against the baseline; Save as selects a destination. Success is reported only after writable-stream closure. External-change detection is not a file lock and cannot eliminate races. Unsupported browsers use a file input and Download, which exports a copy and retains dirty state because successful saving cannot be confirmed. Real permission/revocation and file:// Save flows remain incompletely verified.

Reload source reads the retained handle, or asks the user to choose the file again. It prompts before discarding edits and resets history, sorting, filters and navigation for that document. It does not watch the source continuously.

## Selection, source and filters

Header menus are the column-filter/sort entry point. Global Find and Clear filters remain; the duplicate toolbar column-filter input is removed. Sorting changes only through the menu, with a persistent arrow and summary. Source navigates to the active selected cell; there is no standalone source-jump row. The source editor draws the located selection. Right-click menus dismiss on outside click or Escape.

The value bar appears for a selected cell. Header filter menus anchor to their trigger, adjust near viewport edges, and use an inset search focus border. Visual/browser confirmation of the latest changes is still pending.

## Leaving the page

While a document is open, or an operation/unsaved state exists, beforeunload requests the browser's reload/close confirmation. The browser owns the text and may suppress the dialog. There is no browser recovery journal and no guarantee against crash, process termination or every mobile lifecycle event. Save work before leaving.

## Verification and artifacts

Current automated suite: 102 tests, including mocked browser Save and reload, engine data integrity, TSV/batch atomicity and exact source ranges. Offline build passed. These tests are not real browser permission or visual checks. See USER-GUIDE.md for supported behavior and limitations.

Generated output, screenshots, dependencies, native target folders and local fixtures are excluded from Git. Rebuild artifacts from the committed source rather than committing local binaries.

## Hosted installation and offline use

Open https://arsxd.github.io/lattice/ over HTTPS. Use Chrome or Edge’s address-bar install icon or browser install menu. Lattice does not add a persistent install button to the editing toolbar. Installation and file access remain subject to browser and corporate policy.

The service worker caches the application shell, not your JSON files. Load the app online once before using it offline. It does not persist unsaved documents across closures. Save your work before closing. Updates wait until all app windows/tabs close; there is no forced reload while editing.

The downloaded HTML remains self-contained and does not register a service worker. Developers build hosted assets with `npm run pwa:build`. GitHub Actions tests and builds both distributions, then deploys `dist` through GitHub Pages on `main`. Pull requests verify without deploying.

## Current polish changes

Reload retains the current nested location, falling back to its nearest existing parent when removed. Sort and filters are retained when column names and order match; the row page resets to the first page. Undo history resets because the source is reopened. Scroll restoration is not implemented.

Details now has a persistent pressed state beside Review changes in table mode. Column-source navigation was removed because it only pointed to the first value; selected-cell source navigation remains. Active value filters appear in the table summary. Diff navigation selects and scrolls both versions and shows the current change number; unchanged lines can be expanded and collapsed again.

The hosted welcome page includes dismissible installation guidance. It shows **Install Lattice** when the browser offers a direct prompt, and browser-menu instructions otherwise. It stays out of the editing workspace; **Not now** hides it for the browser session.

## Consistency pass verification

The 2026-11-13 suite includes full filtered-column selection across 500-row pages, cross-page atomic paste, stale-revision guards, generated-column collisions and bounded lossless previews. Local macOS Chromium checks verified 620-row column copy, Shift row selection, Source/Table selection retention, container-name navigation, keyboard pane resizing and light/dark rendering. With the browser context offline, cached startup, local-file opening, nested navigation and Details rendering passed; only the in-memory `blob:` document worker request was observed during that workflow. This does not verify corporate endpoint monitoring or real Windows file/clipboard permissions.

Small Details tables are capped at 20 rows, 10 columns, 100 rendered cells, 32,768 source characters and 12 AST levels. Large JSON previews retain the existing 8,192-character limit; the value bar remains bounded and marks truncated scalar text read-only. Numeric previews use source tokens rather than floating-point serialization. Grid copy is capped at 10,000 cells and 16,777,216 value characters. These are operational limits, not a claim that every accepted 64 MiB file will remain responsive.

The standalone HTML was also smoke-tested over localhost: local file opening, Enter on a scalar-array name, pointer pane resizing and narrow dark layout passed, with no service-worker registration. Automated `file:` navigation is blocked by the browser tooling, so direct-file execution was not reverified in this pass. The standalone build suppresses installation guidance and service-worker registration even when served over HTTP.
