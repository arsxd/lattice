# Implementation checkpoint

9 November 2026. Development build 0.1.0.

## Delivered architecture

- `src/document/engine.ts`: strict JSON syntax tree with source spans, lossless scalar edits, structural text patches, duplicate-key diagnostics, revision checks, bounded history and table projections.
- `src/worker/`: document engine runs off the rendering thread; requests time out at 30 seconds and require reopening if the worker fails.
- `src/App.tsx`: one-document workbench with records/properties views, inspector, typed-edit dialog, staged source editing, review, paging, search and sort.
- `src/editor/SourceEditor.tsx`: CodeMirror JSON source surface.
- `src/platform/files.ts`: native bridge and explicit browser-download fallback.
- `src-tauri/src/files.rs`: user-selected file handles, UTF-8 validation, content-hash conflict checks, sibling temporary-file write/flush/replace.
- `src-tauri/src/recovery.rs`: versioned, checksummed private local recovery checkpoint. Generation ordering prevents late old checkpoint writes from replacing a newer clear/update.

Dependencies are pinned in package-lock.json and Cargo.lock. The grid package is an upstream beta release (`7.0.0-beta.64`); adoption remains provisional pending wider platform/accessibility testing.

## Changes from the original proposal

This is the first usable vertical slice, not the entire initial-release feature list.

- One document instead of tabs; 500-row pages plus grid virtualization bound frontend transfer/rendering.
- Structured commands use path + expected document revision. Selection is cleared after mutations. Cross-revision stable node identities are deferred; old commands are rejected rather than silently redirected.
- Scalar replacement validates the new token then updates owned syntax-tree spans. Structural changes and source changes reparse. No general incremental parser is claimed.
- Source edits are staged with explicit Apply/Discard; committed source edits use the same history as table edits.
- Recovery uses one checksummed checkpoint instead of a journal, and restores to a new unsaved document rather than rebinding an old file handle.
- No remote functionality, external schema retrieval, or data upload.

## Verification evidence

- 37 TypeScript engine tests pass. Includes 250 generated JSON replacement/undo round trips and 100 generated sequences of scalar edits, precision tokens, BOM/CRLF, escaped and prototype-like keys, duplicate keys, missing/null/empty/false/zero distinctions, mixed sorting, wide collections, stale revisions and structural edits.
- Six Rust tests pass for no-op byte round trip, external changes, destination collision, invalid UTF-8, missing parent, symlink refusal, and recovery integrity. Some cases share one test function.
- Production frontend type check/build and macOS arm64 application bundling passed.
- Chromium browser smoke check: example loading, numeric edit 10→25, undo back to an unmodified document.
- Native macOS app smoke check: launch, records table, typed edit, native Save As, overwrite save, reopen. A saved sample was byte-compared against the expected one-token edit. Large integer, exponent, decimal and negative-zero tokens survived unchanged.
- Native external-change check: appended a space to the verification file outside the app, then Save refused the overwrite with a conflict message. Reopened that file successfully.
- A native unsaved edit produced the expected checksummed recovery checkpoint on disk. Recovery restoration and quit handling are being verified in the final smoke pass; see the final addendum below for the observed result.

One native save automation attempt put a full path into the filename field, producing a malformed filename and a stalled attempt. Using the folder chooser and explicit filename succeeded. This was not sufficient evidence to attribute the stall to the file-layer implementation. The accidental successful filename fixture was moved into verification output.

## Performance evidence

`output/verification/benchmark.json` records an Apple M4 / Node 26.8.2 synthetic engine run, not native WebView performance or whole-app memory.

For 100,000 rows / 18,900,000 bytes, the optimized run opened in about 459 ms, projected the first page in about 41 ms, and performed five scalar commits in about 38–42 ms. Process RSS at that measurement was about 711 MB. Earlier versions generated every cell and reparsed twice: those observations motivated the bounded projection and scalar fast path.

These results support further development, not a production size/performance guarantee. Structural edits, undo, source changes, long-running sessions, huge strings, and pathological documents require broader profiling. The four-million-token guard was added after this benchmark; the fixture remains below the guard.

## Release gates still open

Windows build/runtime (CI configured, not remotely run), native installer/signing/notarization, broad accessibility/IME testing, disk-full and power-loss fault injection, filesystem metadata preservation, large-file/native WebView profiling, multi-document workflow and advanced spreadsheet operations.

No final compatibility matrix or production release claim is made.

## Final native verification addendum

- Restart displayed the existing recovery checkpoint. Restore produced `recovered-untitled.json` containing `recovery_test: "unsaved fixture"` and correctly marked it unsaved.
- The initial native confirmation route did not provide a reliably observed Quit guard. The final build replaces the predefined Quit menu entry with an application event and an explicit in-window unsaved-changes dialog.
- In the final macOS bundle, Cmd+Q with an unsaved `quit_guard_test` value displayed **Unsaved changes**, **Discard changes**, and **Keep editing**. Clicking Keep editing returned to the table with the original unsaved value intact.
- A separate forced-crash/power-loss campaign was not performed. Observed recovery evidence covers checkpoint persistence and restore after process restart, not every failure mode.
- Final automated checks: 37 TypeScript tests and 6 Rust tests passed; frontend build and native app bundle succeeded. Vite reports a non-fatal main-chunk size warning; source-editor code splitting remains an optimization opportunity.

Packaged handoff: `output/JSON-Workbench-macOS-arm64.zip`. This contains the same locally built development app, not a signed/notarized distribution release. CI configuration is present but no remote Windows job has run.

## Document tabs and inline cells — 2026-11-09

This addendum supersedes the earlier single-document limitation and test count.

- Implemented document tabs with independent workers, undo/redo, saved baselines, selection, query and source drafts; guarded individual close and all-document quit.
- Implemented root-container sheet buttons and breadcrumb navigation for deeper nesting.
- Implemented direct scalar editing with exact-number validation, Enter/Tab/Shift+Tab/Escape, expanded typed editors for missing/null/multiline/container values, and read-only metadata columns.
- Workspace recovery now checkpoints all unsaved documents in one envelope. Legacy checkpoints remain readable, startup reads precede writes, and read errors retain the old checkpoint.
- 43 TypeScript tests pass (37 engine + 6 scalar/recovery tests). Existing 6 Rust checks remain applicable to the unchanged native save/recovery layer.
- Browser interaction checks passed: invalid `01` rejection; exact `900719925474099312345` cell edit; Tab commit; switching tabs; independent undo; invalid source-draft retention; cancelling and confirming tab close; sheet switching; nested mapping breadcrumb navigation.
- Native macOS checks passed: inline `cycle_ms` change from 10 to 25; two open documents; incomplete source draft in the second tab; all-document quit prompt; on-disk checkpoint with both exact texts; restored both tabs after relaunch, including the edited value and invalid source diagnostics. The persisted checkpoint was copied before a clean test quit and reintroduced before relaunch. This verifies restoration, not an actual power-loss/forced-crash scenario.
- Native fixture checkpoint retained under `output/verification/workspace-recovery-checkpoint.json`.
- Windows CI now builds and uploads an NSIS setup artifact. No remote run has occurred; Windows build/runtime remain unverified. See `WINDOWS.md`.

See `TABS-AND-CELLS.md` for the interaction contract and remaining limits. Rectangular paste, fill-down, unlimited-size claims, recovery journals and full accessibility/IME coverage are not implemented.
- Final keyboard regression check passed after focus restoration: Enter commit → F2 reopens the same cell; Escape discards changed text → F2 works again; Tab commits and focuses the next value column. The pinned grid's same-position imperative selection did not restore focus, so the application explicitly focuses the rendered target cell after editor removal.
- Visual check: `output/playwright/workspace-tabs.png` shows the implemented 1440×900 browser layout with two document tabs and root-container sheet buttons.
- Development-only limitation: React Fast Refresh may preserve component state after effect cleanup has disposed its workers. Reload the browser preview after modifying application code; a normal packaged application has no Fast Refresh runtime.


## Spreadsheet additions — 2026-11-10

- Replaced generic Add property in record tables with Add row and Add column.
- Added exact-ID row generation, union-field blank rows, and one-transaction column insertion across object rows. Existing tokens are preserved and the column operation assembles text in linear passes.
- Blank/missing cells now edit inline with a consistent column type or text fallback. Mixed collections retain their field columns and expose existing scalar entries separately, without converting their contents.
- 49 automated tests passed, including row shape/layout stability, column undo/redo, exact numeric tokens, mixed entries, array union fields, duplicate/stale/width rejection and large numeric row identifiers.
- Browser smoke test reproduced the supplied two-row pin mapping: Add row created row 3 with all existing columns visible; the blank conn_pin cell accepted pin 2 inline; adding notes retained the table; one Undo removed the column while retaining pin 2, and Redo restored it.
- Screenshot: output/playwright/excel-rows-columns.png. These new interactions were exercised in Chromium; the macOS app is rebuilt from the same frontend. A separate native UI smoke pass for these additions has not been performed.


## Spreadsheet interaction pass — 2026-11-10

Removed Apply/Cancel cell controls. Added type-to-replace, Enter/Shift+Enter vertical movement, click-to-commit with guarded replay of toolbar actions, selected-scalar clearing, and inline validation that retains focus. Added UI-only row numbering and column lettering; navigation and value-inspector panes default closed.

Chromium checks passed: rapid typing 250 into a selected numeric cell preserved all three keystrokes; Enter committed and selected the row below; F2 reopened that cell; Tab moved right; clicking another cell committed a string; invalid 01 stayed in the editor; Escape retained the original numeric token; clicking Add row while editing committed and added exactly one row. No Apply cell button remained. Screenshot: output/playwright/spreadsheet-workflow.png. These checks do not establish full Excel parity, rectangular paste/fill support, native IME coverage or Windows runtime behavior.

Final interaction regressions passed in Chromium: Delete followed immediately by typing 75 retained both characters; Enter committed and moved down; clearing a numeric editor committed a blank; Shift+Enter moved up; Shift+Tab moved left. A delayed-focus race discovered during this check was fixed by skipping queued grid focus while a new inline editor is already active. The final macOS bundle includes this correction. Native WebView interaction testing for this pass remains unverified.


Review now uses CodeMirror MergeView 6.12.3 with aligned read-only panes, intraline highlighting, collapsed unchanged regions and change navigation. Save and undo/redo refresh the review baseline/current text. Frontend build and 49 tests pass; native bundle rebuilt. Interactive diff UI verification remains unverified. Windows installer/runtime remain unverified; no Git remote is configured for dispatching the included Windows CI job.
