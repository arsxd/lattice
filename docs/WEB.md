# Web architecture and verification

Lattice 0.1.6 distributes a hosted PWA and a single-file offline HTML. Native apps are not released. Node 24 is for development only; end users need only a supported desktop browser.

## Build and verification

- `npm ci`, `npm test`: engine, state and platform regression checks.
- `npm run test:browser`: Playwright Chromium workflow checks against a dedicated local preview server. CI runs these on Windows and Linux and gates Pages deployment on both jobs.
- `npm run offline:build`: builds `output/Lattice-Offline.html`, embedding code, styles, favicon, document/validation workers.
- `npm run pwa:build`: creates `dist` with a manifest, icons and hashed-cache service worker.

GitHub Pages deploys only `main` after verification. Feature-branch workflow dispatch verifies without deployment. Generated output, traces, local fixtures and private development notes are ignored by Git.

## Data and revisions

Each document has its own worker-backed text/AST engine. Mutations and bulk operations guard the canonical revision; numbers and string tokens are retained as text. Review validation uses a separate worker. Its baseline is read-only, current pane editable; per-hunk restore changes only the draft. Strict review Apply validates again in the canonical worker and creates one undoable document commit. Source can still represent invalid repair drafts. LF/CRLF replacement and cross-pane restoration use CodeMirror Text to avoid doubled carriage returns.

Reload retains the nearest available nested location, remaps query columns by name and role, locates the previous row once after filtering/sorting, and restores its page/active cell and compatible scroll position. Deleted cells clear selection. Multi-cell ranges collapse to the active cell. Array paths are positional; no heuristic record identity is invented. Reload resets undo/navigation history.

## Local persistence and file access

Browser file handles provide Save when supported and authorized. Save checks decoded disk contents against the baseline before writing and confirms success only after stream closure. This is conflict detection, not an exclusive lock; external races remain possible. Other browsers use file input and Download, retaining dirty state because downloading is not confirmed disk saving. Browser handles do not reveal absolute paths.

Picker hints and layout preferences are optional metadata. JSON recovery is separate and OFF by default. Enabling **Local recovery** stores raw unsaved name/text records in IndexedDB after a two-second debounce. Per-window UUID keys and held Web Locks prevent overwriting or recovering a live window. Startup restore checkpoints the adopted workspace before deleting older records. Disable clears recovery data; save/close removes clean documents from subsequent snapshots. Invalid source/review drafts can be recovered. Uncommitted cell input, undo history and file handles are not recovered. Quota, unsupported APIs or damaged records produce visible errors and retain previous valid snapshots where possible. Recovery is not a crash-proof disk save.

## Installation, updates and privacy

[Hosted app](https://arsxd.github.io/lattice/) installation uses the browser's own prompt/menu. Welcome guidance is dismissible and stays out of the editor toolbar. A waiting service worker exposes **Update available** in the existing status area. Updates never call skipWaiting or force reload; save and close all app tabs/windows before reopening. Hourly/visibility update checks carry no document content.

The service worker caches application assets, not JSON files. Once successfully cached, the shell works offline. JSON recovery, if explicitly enabled, is local IndexedDB storage independent of that asset cache. The standalone HTML has no manifest, does not register a service worker and shows no install/update guidance, even when served over HTTP. No document-upload endpoint or analytics integration is implemented. This cannot establish what corporate endpoint software observes; see [Windows checks](WINDOWS.md).

## Rendering and freeze limits

The table uses 500-row pages and virtualized columns/rows. Frozen columns use the grid's native support. Frozen rows use the public editable Row renderer with measured cumulative heights and bounded page rendering: at most 10,000 cells including the gutter, at most 40% viewport height. Larger pages retain virtualization and column freezing. Resizing/wrapping can pause unsafe freezes; no fixed-height row offsets or private grid internals are used.

Details tables cap 20 rows, 10 columns, 100 cells, 32,768 source characters and 12 AST levels. The scroll region is at most 288px high; headers stay single-line and values at most three lines. Raw JSON previews cap 8,192 characters, value-bar previews 4,096; truncated scalar previews are read-only. Exact Source/Copy JSON remain available. These bounds do not guarantee every accepted 64 MiB file will feel equally responsive.

## Verification boundaries

Unit tests cover revision/atomicity, exact numeric tokens, CRLF, partial drafts, reload remapping, freeze geometry, recovery ownership/storage errors and update lifecycle. Browser tests cover actual input, selection, draft validation/restore, tab continuity, frozen scrolling, recovery after refresh, offline startup and a real waiting worker. GitHub-hosted Windows automation does not verify managed corporate browser policy, installation approval, endpoint monitoring or actual file-picker permission prompts. Direct file: execution must be checked manually because the local browser automation tool blocks file: URLs.
