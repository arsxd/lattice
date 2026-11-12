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

Click a cell, drag over a range, Shift+click or use Shift+arrows. **Ctrl+C / Cmd+C** copies the selected values; **Ctrl+V / Cmd+V** pastes. Arrow-key navigation updates the copy target. Copy exports quoted tab-separated values compatible with spreadsheet cells, using complete values rather than truncated previews. If preparation is still running, retry Copy when ready.

Right-click a cell for **Copy** and **Paste**, with shortcut hints. Right-clicking inside a range keeps the range; right-clicking outside selects the clicked cell. Menu clipboard actions require browser permission. If blocked, close the menu and use the keyboard shortcuts. Inside a text editor, the browser’s normal text-selection clipboard behavior applies.

Paste starts at the selection's top-left cell. It validates before applying, rejects incompatible/read-only/nested targets and does not extend the table automatically. It can cross page boundaries within the filtered/sorted table. Nonadjacent destinations are rejected. A paste is one undo step. Blank pasted cells become null. Ctrl+D/Cmd+D or Fill down copies the top cell of each selected column down; it does not generate numeric sequences.

## Sort and filter

Header dropdowns contain ascending/descending sort, Clear sort, searchable value checklists and Apply/Cancel. Filters combine across columns. Sorting is view-only; header clicks do not move it to another column. The active column shows an arrow and a summary names the sort.

The checklist contains at most 2,000 distinct values; a truncation notice appears when needed. Clear a column filter to include all its values. Global Find searches the table separately from checklist filters. Clear filters resets active filters.

## Source and review

Select a cell, then Source to locate its exact JSON token. Missing fields have no source token. There is no separate source-jump row.

Merely viewing source should not create a draft. Editing source reveals Apply source / Discard draft. Apply commits to the document engine; Discard reloads committed text. These are distinct from saving the file to disk.

Review changes compares the opened/saved baseline on the left with an editable current draft on the right. **Restore** beside a changed region copies that baseline region into the draft; it does not save or immediately change the table. **Undo draft / Redo draft** and the usual editor shortcuts undo draft changes, including Restore. **Validate** checks JSON syntax and existing size/depth limits in a worker. **Apply changes** is enabled only for a valid changed draft and commits it as one document undo step. **Discard draft** restores the committed document, keeping edits already made in the table.

Previous/Next change highlights changed regions. Show/Hide unchanged lines can be toggled repeatedly without losing draft edits. Drafts survive document-tab switching. Apply or discard a Review draft before switching to Table/Source or saving. This compares against the baseline, not a newly modified disk file; it is not a three-way merge tool.

## Save and external editors

Where browser APIs permit, Open retains a file handle, Save writes back, and Save as selects another destination. Cancelling or failed writes must not mark the document saved. A detected external file change blocks overwriting; no exclusive lock or automatic file watcher exists.

Download exports a copy. The document stays dirty because the app cannot confirm the download was saved. Keep the exported file before closing. Browser file access is not guaranteed after page reload.

Reload source refreshes from a retained handle or asks you to choose the source again. Confirming reload replaces only the active document and resets undo history. It retains the current nested location (or its nearest existing parent), with sort/filter columns remapped by name and column role. It restores the selected row/cell path and its page when still present, plus scroll position when that row remains on the page. Missing cells clear selection; multi-cell ranges collapse to their active cell. Array indices retain positions, not semantic record identity if an external editor reorders array elements. Cancel retains your work.

## Troubleshooting and reports

| Symptom | Check |
|---|---|
| Old interface after updating | Close the old tab; open the downloaded HTML from the new release |
| Open starts in the wrong folder | Newer builds supply a handle hint; local-origin storage or policy may still prevent persistence |
| Save unavailable | Browser may not expose the file-picker API; use Download |
| Save says externally changed | Keep your edits separately, then reload/reopen the source; do not overwrite blindly |
| Source Apply/Discard appears without editing | Report line endings, browser and minimal JSON; CRLF regression checks exist |
| Paste rejected | Check table bounds, target column types, metadata/container cells and rectangular clipboard shape |
| A missing sheet tab | Provide a minimal nested JSON example; wrapper handling is heuristic |
| No close/reload warning | Browsers can suppress beforeunload dialogs; it is not crash recovery |

Report bugs through GitHub Issues. Include release version, OS/browser version, exact steps, expected/actual results, and a minimal sanitized JSON example. Never attach company files, credentials, paths or personal data you cannot share publicly. Screenshots should be redacted. See the issue template for a checklist.

## Empty values and nested previews

Empty strings (`""`), empty objects (`{}`), empty arrays (`[]`), `null` and missing properties appear as blank grid cells. Select a cell and open **Details** to see its exact state and JSON. Hover text and accessible names also identify the state. The underlying values remain distinct; no conversion occurs. Zero, false and literal strings such as "null" remain visible. A missing property is absent from the file; entering a value creates it.

Nested objects show up to three key/value hints in the cell. Double-click still opens the nested table. Turn on **Details** for a contents table alongside a JSON preview. The preview shows at most 20 rows, 10 columns and 100 cells. Small collections of records use their combined keys as columns; other collections use key/value rows. Preview columns retain readable widths instead of shrinking to fit the pane; scroll within the preview to see additional columns/rows. Headers stay on one line and values show at most three lines. The preview area is capped at 288 pixels high; focus it to scroll with the keyboard. Long values are truncated. Previews are omitted above 32,768 source characters or 12 syntax-tree levels; use **Open table**, **Source** or **Copy JSON** for the complete value. Numeric previews use the original JSON spelling.

Switching from Table to Source and back restores the active cell. Applying a source draft clears the selection because rows and keys may have changed; select a new cell after applying.

## Multiline cells and row height

Use **Wrap text** in the table footer to show line breaks and wrap long text inside cells. Only rows whose visible content needs extra lines grow automatically, up to three lines. Short and blank rows stay compact. Heights recalculate when columns are resized; manual row heights take precedence. Longer content is clipped to the row height. The grid preview remains limited to 240 characters. Source and Copy JSON provide the full value; Details limits its text preview.

Drag the bottom edge of a row number to change its height (28–400 pixels). Double-click that edge to reset to its current content-based height. Once the resize handle has focus, Up/Down adjusts its height and Home resets it. Heights are view settings for the current document/table and remain attached to the row path when sorting/filtering. They are not saved in JSON or restored after closing the app.

While editing a string cell, **Alt+Enter** inserts a line break, **Enter** commits, **Tab** commits and moves, and **Escape** cancels. Line breaks are saved as escaped newlines in valid JSON. String cell editing now uses a multiline text field; other JSON types keep their existing validation.

## Browsing nested tables

**Browse** opens an expandable document sidebar. The chevron expands a branch; its name opens that table. The current table is highlighted, ancestors open as you navigate, and sibling branches remain in the hierarchy. Hiding and reopening Browse retains the current expansion state. Each branch lists up to 200 nested tables; all data remains accessible through the parent table.

**Back** and **Forward**, beside the breadcrumb, revisit table locations within the active document. Each document has its own history, capped at 100 locations. History retains the most recent search, sort, filters and row page for a visited table. Visiting another table after going back replaces the forward branch. These controls are separate from Undo/Redo and the browser’s page navigation.

History resets after source reload or applying a source draft. If an earlier location has been removed through table editing, revisiting it opens the nearest available parent. Navigation is paused while a source draft has unapplied changes.

The home icon opens the document root. The sidebar and status bar show the current filename; the breadcrumb shows the JSON location. Browser file handles do not expose an absolute disk path, so the app does not invent one.

## Freeze panes

Use **Freeze** beside Wrap text for **Freeze first row**, **Freeze first column**, or **Freeze above and left of selection**. The last option keeps rows above and columns left of the active cell visible. **Unfreeze panes** clears both. The row-number gutter stays pinned independently.

Freeze is a view setting for the current document/table, not JSON data. It follows displayed positions after sorting/filtering and applies to each displayed page. Row offsets use the current wrapped/manual heights. Frozen rows may occupy at most 40% of the grid height; frozen columns must leave at least 40% of the width scrollable. Row freezing supports pages with at most 10,000 rendered cells, including the gutter. This mode renders the bounded page to retain editable frozen rows. Wider pages keep virtualization and column freezing. If resizing or wrapping makes a stored freeze unsafe, the menu reports that it is paused; reduce the freeze or unfreeze.

## Large selected values

The value bar shows a short summary for nested objects/arrays instead of inserting their full JSON into a text input. Scalar values longer than 4,096 characters use a read-only preview; a truncated preview cannot be committed as an edit. Use Source for the complete value.

Details shows at most 8,192 characters of raw JSON and clearly labels truncated previews. **Copy JSON** and copying selected grid cells still use complete values. Selecting a large container does not modify its data. These limits apply to previews, not the file or nested table.

## Whole rows, columns and pane sizing

Click a column letter/title to select that column across **all matching rows**, including other pages. Click a row number to select the whole row. Shift extends a selection; Ctrl/Cmd-click adds or removes row/column ranges. Ctrl+Space selects the current column; Shift+Space selects its row. Ctrl/Cmd+A selects the table. Highlighting and copying use the same selection. Grid clipboard operations are limited to 10,000 cells and 16,777,216 value characters; larger selections remain highlightable, but copying requests a smaller range. Native text-field selection is unaffected. Disjoint row/column ranges can be copied in table order; paste requires one adjacent destination.

A generated **Array value** column carries a **view** badge. It holds non-object entries in a mixed collection and cannot be renamed/deleted as a real JSON property. Real properties with the same name remain separate.

Double-click or Enter on a nested collection name opens its table; F2 renames an object key. Scalar arrays remain editable inline in value cells. Array previews remove formatting whitespace outside strings and preserve number spelling and whitespace inside strings.

**Browse** sits above the left pane; **Details** stays beside Review changes. Drag either pane boundary to resize it. Focus the boundary and use Left/Right for keyboard resizing, or Home/double-click to reset. Only pane widths are stored locally, never JSON content. The right pane overlays the workspace at narrower window sizes. Column titles wrap to two lines when needed, independently of data wrapping.

Long-running actions show a small ring spinning in place after a brief delay. Reload confirmation uses a compact status toast without moving the grid. Busy actions remain disabled to prevent repeated requests.

## Optional local recovery

**Local recovery** is off by default and can be enabled on the welcome screen or bottom status bar. It stores raw unsaved document contents in this browser's IndexedDB on this device; no upload occurs. Enable it only when retaining local copies is appropriate. It requires Web Locks for safe separation between active app windows. Storage/policy failures are shown as errors, not reported as saved work.

After edits settle for two seconds, committed table edits and Source/Review drafts are checkpointed, including incomplete JSON. In-progress cell input is not checkpointed until committed. On reopening after an interrupted session, choose **Restore draft** to open recovered documents as unsaved new tabs, or **Discard recovered draft**. Restore durably adopts the drafts before deleting the older checkpoint. Files must be saved again; recovery does not reconnect a file handle or restore undo history. Saved/closed documents leave the next checkpoint. Turning recovery off removes stored recovery drafts; open documents are unaffected.

Recovery is best effort: a crash before the debounce, browser data deletion/eviction, storage denial or private mode may prevent recovery. Per-document recovery data is limited to 64 MiB of UTF-16 text/name memory, with 128 MiB total across windows; these differ from file-byte limits. Active windows use separate slots and are excluded from recovery prompts.

## Installed-app updates

When a newer cached application waits to activate, the status bar shows **Update available**. It explains how to save and close every Lattice window/tab, then reopen. **Keep working** dismisses the explanation without reloading or discarding your work. The app checks periodically and when it becomes visible. Offline checks may wait until connectivity returns. The downloaded HTML is updated by downloading the newer release file instead.
