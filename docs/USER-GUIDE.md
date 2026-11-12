# Using Lattice

## Start with the downloaded app

Download `Lattice-Offline.html` from the repository Releases page and open it in a desktop browser. No companion files or server are needed. Replacing the HTML with a newer release does not update a currently open tab: save your work, close it and open the new file.

Use a non-sensitive sample first to check your browser's Open, editing and Save/Download behavior. Corporate policies may restrict local HTML and file APIs.

## Documents, sheets and nested data

Open creates a document tab. Each document has its own worker and undo history. Bottom sheet tabs expose top-level containers and groups beneath single-object wrappers. Nested objects/record arrays open as tables; breadcrumbs return to parents. Simple primitive arrays display inside the cell and can be edited as JSON, e.g. `[1, 2, 3]`.

Property tables show Key/Value; arrays show Index/Value. Type metadata is available in Details. A real JSON field named `type` remains ordinary data. Object Key cells can be renamed directly; array indices are generated and read-only. Duplicate object keys are rejected.

## Enter and change data

Click selects a cell. Type to replace; double-click/F2 edits. Enter commits and moves down; Shift+Enter moves up. Tab commits and moves right; Shift+Tab moves left. Click another cell to commit; Escape cancels. Invalid input stays in the editor with an error.

Blank/null cells accept direct entry. A consistent existing column type guides numeric/boolean input; otherwise blank fields default to text. Existing values retain their type. Details provides explicit type-changing operations. Strings that resemble numbers/formulas remain strings. Numeric input uses JSON number syntax; boolean input uses `true` or `false`.

Add row creates a blank record with existing fields. Right-click a row for insert above/below, duplicate and delete. Add column asks for a name. Column rename/delete affects the full object-row table and rejects name collisions.

## Select, copy, paste and fill

Drag over cells, Shift+click or use Shift+arrows. Copy exports quoted tab-separated values compatible with spreadsheet cells. If preparation is still running, retry Copy when ready.

Paste starts at the selection's top-left cell. It validates before applying, rejects incompatible/read-only/nested targets and does not extend the table automatically. It cannot cross pages. A paste is one undo step. Blank pasted cells become null. Ctrl+D/Cmd+D or Fill down copies the top cell of each selected column down; it does not generate numeric sequences.

## Sort and filter

Header dropdowns contain ascending/descending sort, Clear sort, searchable value checklists and Apply/Cancel. Filters combine across columns. Sorting is view-only; header clicks do not move it to another column. The active column shows an arrow and a summary names the sort.

The checklist contains at most 2,000 distinct values; a truncation notice appears when needed. Clear a column filter to include all its values. Global Find searches the table separately from checklist filters. Clear filters resets active filters.

## Source and review

Select a cell, then Source to locate its exact JSON token. The column menu can locate the first applicable field in visible rows. Missing fields have no source token. There is no separate source-jump row.

Merely viewing source should not create a draft. Editing source reveals Apply source / Discard draft. Apply commits to the document engine; Discard reloads committed text. These are distinct from saving the file to disk.

Review changes compares the last opened/saved baseline against the current committed text. It is a read-only aligned diff with navigation and collapsed unchanged areas, not a comparison against the newest disk file or a three-way merge tool.

## Save and external editors

Where browser APIs permit, Open retains a file handle, Save writes back, and Save as selects another destination. Cancelling or failed writes must not mark the document saved. A detected external file change blocks overwriting; no exclusive lock or automatic file watcher exists.

Download exports a copy. The document stays dirty because the app cannot confirm the download was saved. Keep the exported file before closing. Browser file access is not guaranteed after page reload.

Reload source refreshes from a retained handle or asks you to choose the source again. Confirming reload replaces only the active document and resets its history, filters/sort and navigation. Cancel retains your work.

## Troubleshooting and reports

| Symptom | Check |
|---|---|
| Old interface after updating | Close the old tab; open the downloaded HTML from the new release |
| Open starts in the wrong folder | Newer builds supply a handle hint; local-origin storage or policy may still prevent persistence |
| Save unavailable | Browser may not expose the file-picker API; use Download |
| Save says externally changed | Keep your edits separately, then reload/reopen the source; do not overwrite blindly |
| Source Apply/Discard appears without editing | Report line endings, browser and minimal JSON; CRLF regression checks exist |
| Paste rejected | Check page bounds, target column types, metadata/container cells and rectangular clipboard shape |
| A missing sheet tab | Provide a minimal nested JSON example; wrapper handling is heuristic |
| No close/reload warning | Browsers can suppress beforeunload dialogs; it is not crash recovery |

Report bugs through GitHub Issues. Include release version, OS/browser version, exact steps, expected/actual results, and a minimal sanitized JSON example. Never attach company files, credentials, paths or personal data you cannot share publicly. Screenshots should be redacted. See the issue template for a checklist.

## Empty values and nested previews

Empty strings (`""`), empty objects (`{}`), empty arrays (`[]`), `null` and missing properties are shown separately in muted text. A missing property is absent from the file; entering a value creates it. Zero and false are ordinary values. Placeholder labels are display hints, not text inserted into your document.

Nested objects show up to three key/value hints in the cell. Double-click still opens the nested table. Turn on **Details** for a contents table alongside the exact JSON. The preview shows up to 30 entries, truncates long values, and is omitted for selections larger than 128 Ki characters; use **Open table** or the exact JSON for the complete value. Numeric previews use the original JSON spelling.

Switching from Table to Source and back restores the active cell. Applying a source draft clears the selection because rows and keys may have changed; select a new cell after applying.

## Multiline cells and row height

Use **Wrap text** in the table footer to show line breaks and wrap long text inside cells. It starts with space for about three lines; longer content is clipped to the row height. The grid preview remains limited to 240 characters. Details and Source contain the full value.

Drag the bottom edge of a row number to change its height (28–400 pixels). Double-click that edge to reset to the current compact/wrapped default. Once the resize handle has focus, Up/Down adjusts its height and Home resets it. Heights are view settings for the current document/table and remain attached to the row path when sorting/filtering. They are not saved in JSON or restored after closing the app.

While editing a string cell, **Alt+Enter** inserts a line break, **Enter** commits, **Tab** commits and moves, and **Escape** cancels. Line breaks are saved as escaped newlines in valid JSON. String cell editing now uses a multiline text field; other JSON types keep their existing validation.

## Browsing nested tables

**Browse** opens an expandable document sidebar. The chevron expands a branch; its name opens that table. The current table is highlighted, ancestors open as you navigate, and sibling branches remain in the hierarchy. Hiding and reopening Browse retains the current expansion state. Each branch lists up to 200 nested tables; all data remains accessible through the parent table.

**Back** and **Forward**, beside the breadcrumb, revisit table locations within the active document. Each document has its own history, capped at 100 locations. History retains the most recent search, sort, filters and row page for a visited table. Visiting another table after going back replaces the forward branch. These controls are separate from Undo/Redo and the browser’s page navigation.

History resets after source reload or applying a source draft. If an earlier location has been removed through table editing, revisiting it opens the nearest available parent. Navigation is paused while a source draft has unapplied changes.

The home icon opens the document root. The sidebar and status bar show the current filename; the breadcrumb shows the JSON location. Browser file handles do not expose an absolute disk path, so the app does not invent one.
