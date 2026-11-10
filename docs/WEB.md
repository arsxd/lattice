# Lattice web and offline clients

Current application: **Lattice — JSON Workbench**. Updated 2026-11-10.

## Offline use

Build on a developer machine with `npm ci` then `npm run offline:build`. Transfer `output/Lattice-Offline.html` to the end-user computer and open it in a browser. Node, Rust and a local server are not required there. The HTML embeds application code, styles, favicon and document worker. The packager also refreshes the old JSON-Workbench/JSON-Ledger filenames locally; Lattice is the canonical filename.

The project owner reported basic browser use works. That does not verify all Windows, corporate-policy, permission, clipboard or focus scenarios. Browsers may restrict file URLs and downloads; never bypass managed security controls. No hosted site has been published and no document-upload endpoint is implemented.

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

Host `dist/` over HTTP(S). The multi-file dist entry point is not the offline deliverable; use the packaged HTML for direct-file use. No service worker or installable PWA is implemented.

## Open, Save and external changes

Supported browser picker APIs retain a file handle. Save writes back after checking current decoded contents against the baseline; Save as selects a destination. Success is reported only after writable-stream closure. External-change detection is not a file lock and cannot eliminate races. Unsupported browsers use a file input and Download, which exports a copy and retains dirty state because successful saving cannot be confirmed. Real permission/revocation and file:// Save flows remain incompletely verified.

Reload source reads the retained handle, or asks the user to choose the file again. It prompts before discarding edits and resets history, sorting, filters and navigation for that document. It does not watch the source continuously.

## Selection, source and filters

Header menus are the column-filter/sort entry point. Global Find and Clear filters remain; the duplicate toolbar column-filter input is removed. Sorting changes only through the menu, with a persistent arrow and summary. Source navigates to the active selected cell; there is no standalone source-jump row. The source editor draws the located selection. Right-click menus dismiss on outside click or Escape.

The value bar appears for a selected cell. Header filter menus anchor to their trigger, adjust near viewport edges, and use an inset search focus border. Visual/browser confirmation of the latest changes is still pending.

## Leaving the page

While a document is open, or an operation/unsaved state exists, beforeunload requests the browser's reload/close confirmation. The browser owns the text and may suppress the dialog. There is no browser recovery journal and no guarantee against crash, process termination or every mobile lifecycle event. Save work before leaving.

## Verification and artifacts

Current automated suite: 77 tests, including mocked browser Save and reload, engine data integrity, TSV/batch atomicity and exact source ranges. Offline build passed. These tests are not real browser permission or visual checks. See USER-GUIDE.md for supported behavior and limitations.

Generated output, screenshots, dependencies, native target folders and local fixtures are excluded from Git. Rebuild artifacts from the committed source rather than committing local binaries.
