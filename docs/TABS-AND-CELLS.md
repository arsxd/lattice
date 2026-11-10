# Document, sheet and cell interaction design

Implemented 2026-11-09, extending the original design.

## Navigation hierarchy

```text
New  Open  Save  Save as  Undo  Redo
[signals.json ● ×] [hardware.json ×]       Review changes
Outline    root / signals / VehicleSpeed / mapping    Inspector
           Editable table
[All data] [signals] [interfaces] [configuration]
Validation · unsaved state · bytes · recovery
```

Document tabs own independent workers and edit histories. Switching captures and restores navigation, search/sort/page, source draft, review and selection state. It does not serialize/reparse the JSON or replace the worker. Closing releases only that document's worker and file token. Unsaved close prompts identify the target document; application quit considers all documents, including inactive tabs.

Sheet buttons represent top-level object/array properties, including empty containers. All data shows the complete root object, including scalar fields. An array or scalar root has one Root sheet. Nesting remains explicit: opening a container changes the table and breadcrumb; the owning sheet remains highlighted. This avoids a separate tab row at every depth. The first 200 root containers receive buttons; all entries remain accessible through All data.

## Cell contract

A click selects. Typing replaces a selected scalar; double-click or F2 starts an inline editor using the exact JSON token, never its truncated preview. Key/index/type columns are metadata and do not start scalar edits. The inspector provides key renaming and explicit type changes.

- Enter validates, commits one undoable mutation and moves down; Shift+Enter moves up.
- Tab/Shift+Tab validates, commits and selects the next/previous value cell on the current page.
- Escape cancels without changing the document.
- Invalid input stays in the editor and explains the failure.
- Strings stay strings, including leading zeros and formula-like text. Numbers remain raw validated JSON tokens. No inferred dates, formulas or numeric conversion.
- Blank cells edit inline. Consistent non-null column types guide the editor; new or ambiguous columns default to text. Multiline strings and whole containers use the expanded typed editor. Enter on a container navigates; F2 opens the whole-value editor.
- Clicking another cell or a toolbar command commits first. Invalid input retains focus and prevents the destination action. Escape cancels. There is no confirmation bar.

Grid rows are a view of canonical JSON. Sorting/filtering never rearrange the file. Mutations use paths and revisions, so stale editor targets cannot silently edit a different value.

## Recovery and boundaries

The native checksum/file-replacement machinery persists a versioned workspace envelope containing all unsaved document texts. Each text remains a string, preserving numeric tokens and invalid source drafts. Legacy single-document checkpoints remain readable. Startup reads recovery before allowing checkpoint writes; read failure retains the checkpoint. Restoration prepares all workers before publishing any restored tabs, and creates no bindings to original files.

Recovery remains bounded to 64 MiB of serialized envelope data with a two-second debounce. It is not a session/undo journal: clean tabs, original file handles, view positions and undo history are not restored after restart. Uncommitted inline text is not a committed document edit and is not included in the recovery checkpoint. Multiple document workers increase memory use; large-workspace profiling remains open.

The existing system font, neutral chrome, blue focus/selection and dense grid are retained. Document tabs and sheet buttons have distinct positions and active indicators. No dashboard cards, decorative gradients or animated transitions were added.


## Spreadsheet row/column correction — 2026-11-10

The main table workflow now uses Add row and Add column. Adding a row must never accidentally insert a scalar sibling and collapse a record table into Key/Type/Value. The engine creates an object row containing the existing union of fields, with null placeholders displayed as blank cells. Numeric object-row identifiers advance using exact integer arithmetic; named mappings receive a collision-free row_N identifier. Array rows append.

Add column asks only for a name, rejects collisions, and inserts a null placeholder into each object row in one transaction. Existing source tokens and whitespace are retained. Column insertion assembles text slices once instead of repeatedly copying the whole document for every row. Filling a blank cell uses the consistent existing column type, or text if no consistent type is known. Existing nonblank values retain their type. Blank numeric/boolean cells are never fabricated as zero/false.

Mixed collections retain the record columns and expose non-object entries in a Single value column. Their contents are not converted or deleted. Cells that do not apply to those entries are read-only. The original scalar entry from an older version therefore remains preserved, even though newly added rows have the correct shape.

New columns default to text when filled; this is not automatic semantic schema inference. Empty collections need a row before a new column can be persisted. The table-column limit remains 200. All data navigation requests the normal table layout; the separate structure/properties view remains an explicit optional action.


## Spreadsheet interaction and layout — 2026-11-10

Ordinary cell editing no longer adds Apply/Cancel buttons, disables navigation for the duration of an edit, or requires a separate action to finish. Enter/Shift+Enter commits down/up, Tab/Shift+Tab commits right/left, and clicking another cell commits before selecting the destination. Escape cancels. Invalid input remains editable, with the error in the status bar. Clicked toolbar commands run only after a successful commit and are not allowed to execute twice. F2 and double-click edit existing text; typing on a selected scalar starts replacement immediately so initial keystrokes do not wait for worker reads. Delete/Backspace clears a selected scalar to a blank value. A blank numeric/boolean editor commits as null rather than fabricating zero/false.

The grid now fills the workspace by default. Browse and Details are opt-in panels. Row numbers are UI-only and do not change JSON keys or array indices. Column letters supplement the actual field names. Toolbars, row heights and tabs are compact. JSON structure controls remain available in Details; they are not part of routine cell entry. Source drafts retain their separate Apply/Discard contract.
