# Changelog

## 1.1.0-dev.8 — development only

- Flat key/value sheets retain their vertical layout with nested data enabled; the preference checkbox remains available on every sheet. Unsupported sections fall back silently without covering sheet tabs.
- File drops use a stronger inset outline, subtle tint, and centered hint.


- Keep primitive book ID arrays inline; remember the nested-view preference across sheets/files and browser reloads, with automatic regular-view fallback. Use a quiet file-drop outline and compact hint.
- Add a curated-collections sample and standalone example showing merged parent rows and nested column headers together.
- Keep a single expanded worksheet’s controls anchored above the sheet tabs, matching compact view at different window heights.
- Use a **Show nested data** checkbox, shared content-based column sizing and a plain select-all corner. Fix compact widths after repeated view switches; increase mapping capacity to 200 total columns within the 10,000-cell bound.
- Show nested properties under merged group headers and editable leaf subheaders; support sample Orders shipping objects as well as Books details.
- Fix expansion of nested object mappings at the root and inside named sheets. Render mappings as one worksheet with shared group cells and editable leaf values/row keys.
- Apply the size bound to the selected table rather than rejecting small nested tables in a larger file.
- Replace the read-only grouped preview with **Show nested data** in the normal app. Child arrays are discovered automatically; parent cells span their children and edit directly.
- Keep edits, range paste and insertions tied to exact JSON paths and the existing undo history. Reject conflicting values for one merged parent atomically.
- Support section sort/filter, row/column insertion, range copy/paste, column resize and whole-group freezing within documented bounds. Retain expanded state across Source navigation.
- This feature remains on the experimental branch, excluded from RC3 and the hosted app. Real-file, platform and accessibility validation are release gates.

## 1.0.0-rc.3 — 2026-11-17

- Show the app version on the welcome screen and status bar.
- Explain empty or invalid JSON in plain language, with parser details available on demand.
- Open dropped JSON files in separate tabs, with bounded batch sizes and shared UTF-8 checks. Preserve source typing while files are prepared.
- Allow Details to expand to half the window width.
- Hide generated array indices by default while preserving real data fields; expose original positions in Details and through an optional context-menu column. Open records through **Open row**. Sorting, filtering and range edits retain original JSON paths.
- This remains a release candidate. Grouped child-row layouts are excluded; manual stable-release gates remain pending.

## 1.0.0-rc.2 — 2026-11-16

- Removed forced viewport filling for small tables. Property values, primitive-array values, single-field records and scalar tables now start with bounded content widths, keeping numeric values near their keys. Manual column resizing remains available.
- Prevented cached resized widths from carrying across unrelated tables/documents while retaining each table’s own manual width.
- Added wide-window and manual-resize regression coverage. This remains a release candidate; manual stable-release gates are still pending.

## 1.0.0-rc.1 — 2026-11-16

- Began a release-candidate validation round; this is not a stable release. No new editor features.
- Applied 0BSD to project code, as requested; bundled dependencies retain their existing terms. Generate complete notices for all production dependencies and include project/dependency licenses in the standalone and hosted apps.
- Added exact-byte offline export/reopen and linked-Save contract tests for cancellation, failed writes and external conflicts. Native browser permissions remain manual checks.
- Added macOS Chromium to Windows/Linux CI, production advisory checks, notice drift detection and release SHA-256 checksums.
- Synchronized the offline homepage copy with the hosted app and documented the remaining stable-release gates.

## 0.1.10 — 2026-11-13

- Filled the Details contents table across wide panes, removing the empty strip inside its right border. Narrow panes retain minimum column widths and horizontal scrolling.

## 0.1.9 — 2026-11-13

- Prevented sorting/filter changes during the final refresh of a cell edit, keeping indicators consistent with the displayed data.
- Fixed keyboard activation of header filters and restored focus to their button on Escape.
- Kept all file/theme toolbar controls visible at the supported 720-pixel minimum width.
- Added a reproducible production-browser benchmark, measured 1/5/25 MiB workflows, keyboard regressions and explicit accessibility verification limits.

## 0.1.8 — 2026-11-13

- Source opens the current table by default, with a Whole document switch. Scoped edits preserve sibling data and complete recovery drafts.
- Compact array editing, consistent text selection, longer bounded selected-value previews and a three-line value bar.
- Content-based default column widths, reserved filter space and complete header selection. Header/range selections show a range summary in Details.
- Freeze actions follow selected row/column headers, and Close review returns to the previous view with draft safeguards.
- Refreshed start screen, GitHub link, concise public documentation and real sample screenshots.

## 0.1.7 — 2026-11-13

- Fixed false diff highlights after distant edits with bounded line-first matching and exact changed-text spans. Unchanged lines remain neutral.
- Simplified Review to one toolbar, compact restore arrows, automatic background validation and error-only feedback below the editors. Draft undo/redo shortcuts remain available.

- Unified full-column header highlighting and removed the repeated Browse filename. Browser filename tooltips explain that full disk paths are unavailable.

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
