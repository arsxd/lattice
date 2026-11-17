# Editable expanded rows

Development build: `1.1.0-dev.9`. This replaces the earlier standalone read-only preview. It is integrated into the normal app on the experimental branch and is not included in RC3.

## Workflow

Open a record collection and check **Show nested data** beside Table/Source. The app discovers child record arrays automatically. Nested object mappings render as one worksheet, with shared group keys, record keys as rows and leaf properties as columns. Nested value objects use merged group headers with leaf-property subheaders. Ordinary column headings span the header levels. JSON path metadata is retained separately from displayed labels; literal slash characters in keys remain literal. Object mappings work at the root and inside named sheets. Child arrays still use separate sections; sibling arrays are never joined into combinations that do not exist in the JSON.

Parent fields span their visible child rows. Type or double-click to edit. Enter commits, Tab commits and moves, Escape cancels. Edits use canonical JSON paths in the existing worker, revision guards, atomic mutations and undo history. The existing value bar, Details and Source inspect the selected value. Source/table switching retains expanded selection and view settings in memory for the document.

Parent sorting moves whole groups. Child sorting stays within each parent. Filter menus use the existing checklist UI. A matching parent search retains its children; a matching child search retains its parent association. Existing compact parent filters and order are applied before local section filters. The compact view retains its own query and freeze settings when expanded mode is toggled.

Header/row selection, keyboard copy/paste and right-click Copy/Paste operate on the displayed section. Repeated parent references in a paste are deduplicated. Conflicting values for one merged parent reject the complete operation. Insertions, row/column edits and range operations remain undoable. Generated identifiers remain read-only; real object-map keys can be renamed directly.

**Add row** appends a child to the selected parent, creating an absent child array if needed. **Add column** adds a child field across that section's existing arrays. Numeric/boolean types guide entry into null/missing cells. Parent properties can be added in compact view. Column separators support pointer dragging and arrow keys. Wrapping is bounded to three lines. Freeze includes whole parent groups; the menu reports the actual prefix count. Oversized frozen prefixes pause with an explanation rather than covering the whole viewport.

## Bounds and release gates

Expansion supports a 2 MiB selected table (not the whole source file), 100 array-parent records, eight child-array sections, 500 rows per section, 20 columns per section, 10,000 total rendered cells and 2 MiB of transferred scalar text. Unsupported/mixed shapes and over-limit projections show an explanation and leave the compact editor available. Values retain original number tokens; display text is bounded, while clipboard requests retrieve complete raw values with a revision guard and a 16 MiB limit.

Run `npm run grouped:build` to build the complete editable offline app as `output/Lattice-Expanded-Preview.html`. Run `npm run grouped:verify` for focused browser tests, or `npm run test:browser` for the complete suite. The old prototype renderer and its duplicate model/tests were removed because the editable implementation supersedes them.

Before release: required Windows/Linux/macOS CI, real-file user testing, keyboard/accessibility checks and merged-row behavior at display scaling. No stable-release claim follows from automated checks alone. Native browser permissions and recovery of an uncommitted inline draft remain outside these tests, as with ordinary inline edits.

Object-map expansion supports up to 500 terminal records and 200 total columns (including row labels) within the same 10,000-cell bound. Add row creates a new keyed record beside the selected record; Add column inserts a field across displayed records. Keys can be renamed directly. Missing nested containers remain read-only in the flattened view; create the container through compact view or Source first.

Arrays of records containing nested objects (for example sample Orders shipping) use the same grouped-column renderer without adding a generated index. Header groups remain contiguous when a field is discovered in a later record. Group-header selection selects its leaf columns. Freeze offsets include every visible header row.

Both compact and expanded modes use the same content-width measurement policy: bounded samples, enough room for leaf headers and values, capped widths for long contents, and manual overrides retained. Expanded mode does not distribute spare viewport space equally. Resize observation reattaches whenever the compact grid remounts after a nested-view toggle and ignores zero-sized detached grids. The select-all corner uses the same plain control styling as the compact sheet.

A single expanded worksheet fills the available document area. Its grid scrolls independently while the action bar stays immediately above the sheet tabs, including at short and tall window sizes.

Show nested data is a browser-local preference shared across sheets and files. The checkbox remains visible on all sheets. Flat sheets without container values keep their ordinary vertical layout. Unsupported sections fall back to the regular grid with a compact status icon beside the checkbox explaining the reason. Its right-edge-anchored message with left-aligned text stays closed on mount and sheet changes; hover or keyboard focus opens it temporarily, and clicking pins it open. Escape and outside clicks dismiss it without changing the preference; changed document revisions can try expansion again. Primitive arrays remain cells; empty arrays alone do not establish a child-record schema. Iteration uses focused checks; full CI remains a merge gate.

The 100-parent cap is a conservative implementation guard, not a benchmark-established maximum. The native merged-cell renderer mounts the expanded sheet without viewport virtualization. Raising this cap requires measured rendering and editing checks alongside the existing cell and row bounds.

Fallback feedback follows the quiet contextual-help pattern: https://spectrum.adobe.com/page/contextual-help/. It supplements the usable compact view and is not styled as a primary action or blocking error.

Regular and expanded sheets share the same SVG column-menu chevron. Their select-all corner remains clickable and accessible by name, with no visible triangle. The value bar leaves unavailable cell addresses blank rather than displaying a dash.

Object collections enter child-array expansion only when every immediate member is an object. A single record mixing scalar fields and nested objects uses the mapping projection instead, preserving nested array cells and exact edit paths. This prevents the false fallback observed for GitHub event index 10.

The approved workspace design is applied through src/workspace.css; real controls and data operations remain in place. The value bar is an explicit editable field (Value) or read-only Preview, without formula syntax. Expanded selections report their visible row/column to the App, and headers use the same letter helper as the compact grid. Expanded freezing measures actual header height instead of assuming fixed 34px rows.

## Spreadsheet reference: GridCraft

The user designated [storytold/gridcraft](https://github.com/storytold/gridcraft) as a spreadsheet reference on 2026-11-17. The following is based on its current source, not a local runtime or performance evaluation.

- [Formula bar](https://github.com/storytold/gridcraft/blob/main/crates/ui-egui/src/formula_bar.rs): distinct Name Box, bordered full-width input surface, click-to-edit behavior, top-aligned controls, bounded automatic multiline growth, and optional explicit expansion. Lattice should preserve its directly editable Value field and visible address; additional expansion must leave useful worksheet space. Formula insertion and Python controls are outside this JSON editor's scope. Retain the user's Enter/Escape/click-away workflow rather than introducing required Apply/Cancel buttons.
- [Grid](https://github.com/storytold/gridcraft/blob/main/crates/ui-egui/src/grid.rs): explicit coordinate headers and separate selection, editing, geometry, and visible-cell painting modules. Use this as a reference for consistent selection geometry and future nested viewport rendering; its Rust renderer is not a drop-in React grid and its performance has not been established for Lattice.
- [Sheet tabs](https://github.com/storytold/gridcraft/blob/main/crates/ui-egui/src/tabs.rs): compact tabs, active-tab reveal, previous/next navigation, All Sheets navigation, and commit-before-navigation handling. Reference these for Lattice's overflow and focus behavior. Sheet reordering/renaming must not be assumed to be harmless JSON presentation changes.
- [Theme](https://github.com/storytold/gridcraft/blob/main/crates/ui-egui/src/theme.rs): named tokens distinguish chrome, input, headers, selection, and status, with explicit contrast tests. Lattice should use the same separation of responsibilities across both renderers. GridCraft deliberately keeps the worksheet white in dark mode; Lattice retains its existing dark worksheet unless the user chooses otherwise.

Implementation priorities: (1) keep the current value bar unmistakably editable, (2) unify selection/header behavior across compact and merged sheets, (3) improve tab overflow without moving established controls, (4) measure and implement bounded nested viewport rendering before revisiting size caps. This reference does not authorize a formula engine, an Excel ribbon, or a renderer rewrite.

No GridCraft source code or assets have been copied. Its repository offers MIT and Apache-2.0 licenses; the inspected MIT file requires retaining its copyright and permission notice if substantial code is reused. Lattice's existing 0BSD license does not remove third-party notice obligations.

The value bar uses the neutral label Value, with its border/caret conveying editing; read-only values retain Preview. The Details toggle uses the rounded-pane SVG from the approved design mockup, including its 24-unit viewBox and 1.6-unit stroke.

File-drop feedback uses a contained target below the toolbar, without a page-wide blue border or a hint over the home actions. Active drags refresh a short expiry; feedback clears after 1.5 seconds without drag events, on pointer interaction, Escape, window blur, dragend, and drop. This only manages visual feedback: file handling limits, draft guards, and actual drop acceptance are unchanged.
