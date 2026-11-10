# Changelog

## Unreleased — 0.1.0

Project branding is Lattice — JSON Workbench, selected by the owner. JSON Ledger was an intermediate rejected proposal. Persistent desktop/storage identifiers are retained.

### Added

- Worker-backed text/AST JSON engine with exact numeric token preservation.
- Multi-document tabs, nested tables, top-level sheets, source editing and undo/redo.
- Spreadsheet cell editing, range selection, TSV clipboard operations and fill-down.
- Row insertion, duplication and deletion; column addition, rename and deletion.
- Combined header filters, exact numeric sorting and persistent sort indicators.
- Side-by-side highlighted diff and source location jumps.
- Desktop checked saves and workspace recovery; browser direct Save with download fallback.
- Hosted-web and single-file offline build targets with embedded icon/worker/assets.
- Developer handoff, deployment instructions and native build workflow.

### Recent refinements

- Reload source with baseline refresh and unsaved-change protection.
- Source navigation follows the active grid cell, with a drawn selection.
- Outside-click/Escape dismissal for row/column context menus.
- Browser unload warning while a document is open.
- Header-anchored filters, compact chevrons, consistent spacing and inset search focus.
- Removed duplicate toolbar column filter and standalone source-jump button.
- Offline packager refreshes legacy filenames to avoid stale local copies.

### Changed or removed

- Replaced routine scalar dialogs with inline editing.
- Removed per-cell Apply/Cancel controls; Enter/Tab/click commits and Escape cancels.
- Hidden Browse/Details panels by default.
- Replaced generic Add property for record tables with Add row/Add column.
- Kept record columns visible for mixed collections instead of collapsing the view.
- Moved sorting to explicit column menus to prevent header-click sort changes.
- Unified selection/editing borders and adjusted dropdown spacing/menu anchoring.
- Fixed script corruption caused by string replacement markers in offline packaging.

This records implementation, not universal verification. See docs/HANDOFF.md for tested boundaries.
