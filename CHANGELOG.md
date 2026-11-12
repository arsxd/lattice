# Changelog

## 0.1.6 — 2026-11-13

- Editable validated Review with draft undo/redo, per-region Restore and strict atomic Apply; LF/CRLF-safe synchronization and tab continuity.
- Reload preserves compatible query, page, active cell and scroll, with removed-field safeguards.
- Measured-height frozen rows and native frozen columns with explicit rendering/viewport bounds.
- Opt-in per-window IndexedDB recovery with Web Locks, durable adoption and incomplete-draft recovery.
- Passive PWA update-ready status; no forced reload.
- Windows/Linux Chromium browser checks gate deployment; updated offline download and verification guide.


- Fixed squeezed Details tables with readable column widths, single-line headers, three-line value previews and bounded internal scrolling.

- Aligned document tabs with the table beside Browse and moved table/selection counts into the status bar, keeping action buttons together.

- Unified cell/row/column selection, Shift/additive header selection, full filtered-column copy and cross-page atomic paste with explicit limits.
- Distinguished generated mixed-value columns from real properties to prevent accidental structural edits.
- Container names open tables with double-click/Enter; F2 renames keys.
- Resizable Browse/Details panes, Browse above the sidebar, bounded wrapping of long column titles and consolidated bottom controls.
- Small record tables in Details and compact lossless array previews; large/deep previews stay bounded.
- In-place delayed busy ring, compact reload toast and consistent navigation buttons.


- Fixed heavy UI work when selecting large nested values: container summaries in the value bar, bounded Details JSON previews, and duplicate selection-read suppression.
- Oversized scalar value-bar previews are read-only; full-value Copy JSON and Source remain available.

- Moved Find to the bottom-right beside wrapping and pagination; typing remains editable while search results refresh.

- Unified home, Back/Forward and sidebar disclosure icons with consistent SVG strokes and alignment.

- Consolidated table search, counts, sort/filter status and Add actions into one control line.
- Wrapping grows rows according to their visible text and column widths, keeping short rows compact.

- Context-menu Copy/Paste with platform shortcut hints and permission-error recovery.
- Keyboard movement updates clipboard selection; right-click preserves an existing range or targets the clicked cell.
- Context-menu positioning and keyboard navigation improved; exact scalar-root copy fixed.

- Per-document Back/Forward table navigation with search/sort/filter history.
- Lazy expandable document sidebar with current-location highlighting and stable sibling branches.
- Larger root navigation target and visible document filename.

- Optional text wrapping in the table footer, with compact defaults and draggable/resettable row heights.
- Multiline inline string editing with Alt+Enter; Enter/Tab commit and Escape cancels.

- Blank grid presentation for empty strings/collections, null and absent fields; exact states remain visible in Details.
- Short object summaries in cells and bounded contents previews in Details, preserving exact numeric tokens.
- Restore active cell focus when returning from Source; clear it after applying structural source edits.

- Installable GitHub Pages web app with offline application caching; single-file download retained.
- Reload retains nested location and compatible sorting/filtering, with progress and success feedback.
- Details toggle state and placement, readable Index width, active value-filter summary and clearer file-access errors.
- Diff navigation selects changed ranges with a change counter; unchanged lines can be collapsed again.
- Removed column-source action; selected-cell source navigation remains.

## 0.1.5 — 2026-11-11 (web development preview)

- Replaced work-specific demo themes with a fictional bookshop catalogue, store orders and application settings.
- Added downloadable generic examples, value-shape fixtures, before/after review pair and screenshot recipes.
- Bundled demo now opens the books sheet from the canonical example JSON.
- 79 automated tests pass, including example validity and exact numeric token preservation.


## 0.1.4 — 2026-11-11 (web development preview)

- Web-only release line on main; native desktop and experimental work retained on dev.
- Removed freeze controls from the release UI after reported problems.
- Details is shown only in Table mode.
- Expanded the synthetic sample workspace for real feature exploration and screenshots.
- Removed internal handoffs, AI notes and historical planning files from current public branch contents.
- Web-only build workflow; generated native installers are not part of this release.

## Earlier previews

0.1.0–0.1.3 introduced the worker-backed JSON engine, document tabs, spreadsheet editing, sorting/filtering, source review, browser file access, and experimental native/freeze functionality. Earlier previews remain historical; use the current release for the supported web feature set.
