# Lattice — developer and AI handoff

Last consolidated: 2026-11-10. Read this before continuing development.

Current name: **Lattice — JSON Workbench**, selected by the owner. Legacy branding in dated entries is historical. Current offline artifact: `output/Lattice-Offline.html`. See the final dated amendments for the latest behavior; earlier verification boundaries remain historical evidence.

## 1. Product intent and user requirements

Build a well-engineered JSON viewer/editor for macOS, Windows and browsers. The primary audience understands Excel and may know nothing about JSON. The user's real use cases include AUTOSAR signal sheets and hardware interface sheets; the app must also handle arbitrary JSON structures. There is no supplied AUTOSAR schema or production sample dataset. `src/sample.ts` is illustrative synthetic data, not a standards-compliant AUTOSAR database.

The user explicitly rejected generic generated-looking UI, JSON-property dialogs for ordinary rows, automatic switches of table representation after adding a row, and Apply/Cancel controls for each scalar cell. Preserve a spreadsheet workflow and keep structural complexity out of routine editing.

Deployment constraint: the user wants personal use on a corporate Windows laptop, has no npm there, cannot approach IT, and is concerned about unsigned executables. This led to a self-contained HTML deliverable. Do not assume corporate approval, promise bypass of restrictions, or require development tools on the end-user machine. Build tooling runs on the developer machine. The user has not authorized publishing to an external host.

## 2. Current status and evidence boundaries

This is version 0.1.0, a development application, not a production release.

| Area | Implemented | Verification boundary |
|---|---|---|
| JSON engine and row/column edits | Yes | Automated tests and earlier Chromium flows |
| Spreadsheet interaction | Yes | Earlier Chromium tests; incomplete IME/accessibility coverage |
| macOS desktop | Built and exercised during earlier passes | Latest browser-save/offline changes have not been retested in a native UI |
| Windows desktop | Tauri config and installer CI workflow | No Windows build/runtime/installer run verified |
| Hosted web build | Static build scripts and browser file handling | Not published; broad browser support unverified |
| Offline HTML | Single HTML including styles, application and inline worker | Built; syntax/integrity checks passed after packaging fix; direct-file interaction remains unverified |
| Browser direct Save | Capability detection, handles, Save as, conflict checks | Mocked tests only; real picker/permission/write flows unverified |
| Diff review | CodeMirror MergeView | Build checked; interactive diff navigation unverified |

Latest automated result: 52 tests across four test files passed. Do not turn that count into a claim that all UI/platform behavior works.

The user reported that an earlier offline file did not work on Mac. A concrete packaging corruption bug was found and fixed, but successful user confirmation has not been received. Local-file inspection/navigation was blocked by the automation tools, not established as blocked by the user's browser. These are different facts.

## 3. Read order and source precedence

1. This handoff: current consolidated contract and unresolved work.
2. `README.md`: entry-point commands, but some older limitations may lag newer additions.
3. Owning source files and tests: actual current implementation.
4. `docs/TABS-AND-CELLS.md`: interaction decisions and dated amendments.
5. `docs/IMPLEMENTATION.md`: historical implementation/verification log.
6. `docs/WEB.md` and `docs/WINDOWS.md`: deployment notes with later amendments.
7. `docs/archive/DESIGN.md`, `RESEARCH.md`, `REVIEW.md`, `preview.html`: original design/research; not proof of implementation.

Later dated changes supersede earlier plans. Some historical documents say one document only, download-only browser saving, no line-level diff, or missing/null values require dialogs. Those statements have been superseded as described below. Never delete historical evidence merely to make it look current.

## 4. Architecture and file map

| File | Responsibility |
|---|---|
| `src/App.tsx` | Workspace orchestration, document sessions, UI, keyboard/pointer editing, native lifecycle/recovery integration |
| `src/document/engine.ts` | Canonical text, AST, projections, validation, revision-guarded mutations, bounded undo/redo |
| `src/worker/document.worker.ts` | One document engine per worker; RPC dispatcher |
| `src/worker/client.ts` | Inline worker construction, request IDs, timeout/error/disposal handling |
| `src/editor/scalar.ts` | Strict typed scalar token validation/encoding |
| `src/editor/SourceEditor.tsx` | CodeMirror source draft editor |
| `src/editor/ReviewDiff.tsx` | Read-only aligned before/after diff |
| `src/platform/files.ts` | Desktop IPC or browser picker/download/save adapter |
| `src/workspace/recovery.ts` | Versioned workspace envelope, legacy checkpoint decoding |
| `src/style.css` | Theme tokens, grid, tabs, dialogs and diff styles |
| `src-tauri/src/main.rs` | Native chooser/save commands, token registry, quit guards, recovery commands |
| `src-tauri/src/files.rs` | Bounded UTF-8 reads, hashes, checked temporary-file replacement |
| `src-tauri/src/recovery.rs` | Private checksummed recovery checkpoint persistence |
| `scripts/build-offline.mjs` | Embeds built JS/CSS into one HTML |
| `.github/workflows/desktop.yml` | macOS app / Windows NSIS build-and-upload configuration; not executed remotely |

Stack: React/TypeScript, react-data-grid (pinned beta), jsonc-parser, CodeMirror 6, Vite, Tauri 2/Rust. Exact versions are in `package.json`, `package-lock.json`, and `src-tauri/Cargo.lock`. Keep lockfiles. No backend document service or upload endpoint is implemented.

### Data path

UI action → document-specific client → worker RPC → engine mutation → projection → UI. Saving requests canonical worker text and passes it to the platform adapter. The table is a projection, not the stored data model.

Each document owns an independent worker. Active React state is captured into a session snapshot when switching. The session retains its worker, saved baseline, query, selection, source draft, review state and sheet information. Closing releases that session's worker and native file token. Do not replace this with cosmetic tabs sharing one undo history.

### Worker protocol

Actions: `open`, `project`, `raw`, `text`, `mutate`, `source`, `undo`, `redo`, `saved`. Requests have IDs; the client maps replies to promises. A timeout or worker failure disposes the worker and rejects pending work. Inspect the client before changing timeout behavior. React Fast Refresh can preserve state after effect cleanup disposes workers; reload the development browser after modifying app code if it reports a closed worker.

## 5. Data integrity invariants

- Canonical JSON is text plus a jsonc-parser AST. Do not parse and stringify the entire document using JavaScript numbers to perform edits.
- Preserve untouched numeric lexemes, including integers above JS safe precision, `1e400`, `-0`, trailing decimal zeros and high-precision decimals.
- Strings remain strings, including leading zeros and formula-like text. No inferred formulas, dates or automatic conversion of existing values.
- Mutations use JSON paths plus a base revision. Reject stale edits rather than silently targeting a different row.
- Strict JSON and duplicate-key diagnostics block table editing and ordinary saving until repaired.
- Sorting/filtering are view operations; they never reorder the saved document.
- Missing, null, empty string, false and zero are distinct, even when missing/null cells display blank.
- Scalar changes have an optimized AST-span update path. Structural changes, source application and history operations reparse.
- Row/column mutations must be atomic from the user's undo perspective.
- Do not claim universal atomicity, filesystem durability or complete protection from external writers.

Resource guards: 64 MiB native file input/output; engine text bound of 64 Mi UTF-16 characters; depth 256; scanner token guard of four million. Table projection is paged at 500 rows. Record fields are limited to 200 columns before falling back to structural/property navigation. These limits are guards, not performance guarantees. Each open document adds worker memory.

Earlier benchmark evidence is in `output/verification/benchmark.json` and historical implementation notes; it is machine/runtime-specific and not a full native-app guarantee.

## 6. Spreadsheet interaction contract

- Grid fills the workspace. Browse/Details panels default hidden.
- Document tabs are at the top; top-level container sheet buttons are at the bottom; deeper containers use breadcrumbs/Parent navigation.
- UI row numbers and column letters do not modify actual JSON keys or array indices.
- Click selects; typing replaces a selected scalar immediately.
- Double-click/F2 edits a scalar. Enter on an already selected scalar moves down. Enter on a container navigates; F2 can open the expanded whole-value editor.
- In the editor: Enter/Shift+Enter commits and moves down/up; Tab/Shift+Tab commits and moves right/left; Escape cancels.
- Clicking another cell commits before moving. Clicking a toolbar command commits first and executes the command once after success.
- Invalid input remains in the editor, retains focus, and shows an error in the status bar. No Apply/Cancel cell bar.
- Delete/Backspace clears a selected scalar. An empty numeric/boolean editor commits blank/null rather than inventing zero/false.
- Blank/missing cells use a consistent existing non-null column type when known; otherwise text. This is limited type guidance, not schema inference.
- Multiline/whole-container/type-change operations retain an expanded editor. Source editing remains explicitly staged with Apply/Discard; removing cell confirmations did not remove the source draft contract.

Pointer click capture and replay prevent navigation/commands from overtaking an unfinished edit. A suppression flag prevents the original click and replay from running the command twice. A focus race was fixed by skipping queued grid focus if a new inline input already exists. The pinned grid does not focus an unchanged active position reliably, so explicit DOM focus restoration remains necessary. Test fast typing after Delete and after commit whenever changing this code.

### Rows and columns

Add row in a record table inserts an object with the union of existing fields and null placeholders displayed blank. Numeric mapping IDs advance with exact integer arithmetic; named mappings get a collision-free `row_N`; arrays append. Adding a row clears search/sort when needed to expose it and selects the last relevant page.

Add column asks only for its name, rejects collisions, and adds blank/null cells to object rows as one undoable transaction. Existing tokens are preserved. Text is assembled in slices rather than repeatedly copying the whole document per row.

Mixed collections keep record columns and expose existing scalar entries in `Single value`. Inapplicable cells are read-only. Never convert/delete a stray scalar silently. This was added after generic Add property inserted key `3` as an empty string and collapsed the user's pin table into Key/Type/Value.

Empty collections need a row before a column can be persisted. No persistent schema exists independently of JSON content. Rectangular paste, fill-down and full Excel parity remain unimplemented.

## 7. File handling, saves and external edits

### Desktop

Native file selection gives the renderer an opaque token, not arbitrary path authority. Native handles track a path/hash. Save checks the external content hash, writes a sibling temporary file, flushes and replaces the target. Supported permissions are preserved; parent directory syncing is best effort on Unix. Symlinks/nonregular files are rejected by the native reader. Verify owning Rust code before changing these constraints.

The app does not watch/reload files automatically and does not implement exclusive file locking. Save conflict detection refuses a detected externally modified file. Other writers can still race. Compare-with-latest-disk and general merge conflict resolution are not implemented.

### Browser direct Save — latest addition

`src/platform/files.ts` detects picker APIs. Open uses `showOpenFilePicker` when available and retains a handle and decoded `diskText` baseline. Otherwise it uses a file input.

`prepareBrowserSave` obtains a save handle for new documents/Save as, before requesting worker text. Save checks current decoded contents against the baseline, creates a writable stream, checks again, writes canonical text, and closes. Only successful closure returns `confirmed: true`, which updates the saved baseline/dirty state. Failure aborts the stream where possible. Cancelling a picker returns without marking saved.

This compares decoded text, not the native byte hash, and is not locking or a transaction shared with external editors. A race remains after the final check. Runtime capability, user activation, permission and corporate policy requirements vary. An exposed picker API can still deny access; currently that surfaces as an error rather than silently downloading. Real permission prompts, revoked permissions, Save as to an already-open file, and file:// behavior need browser testing.

### Download fallback

No handle → Blob/object URL download. Download cannot confirm that the user saved the file, so the document stays dirty. Browser recovery is not implemented. Handle access is held in memory and must not be promised to survive reload.

### Review

`ReviewDiff` compares last opened/saved baseline with current committed text, not latest disk contents. CodeMirror MergeView aligns panes, highlights changed text, collapses unchanged regions and offers previous/next navigation. Both panes are read-only. Save updates the baseline; undo/redo refresh current review text. Source drafts must be applied before ordinary save/review. It is not an interactive merge tool or a Beyond Compare clone.

## 8. Recovery and closing

Native-only recovery stores one checksummed workspace envelope containing all unsaved document texts, including invalid/unapplied source drafts, after a two-second debounce. Legacy single-document checkpoints remain readable. The envelope marker uses a NUL-prefixed name that cannot collide with a native filename.

Read the old checkpoint before writing a new one. Read failures retain it. Restoring prepares workers before publishing restored tabs; documents are restored unsaved without original file bindings. Clean tabs, original handles, undo history and view positions are not a restart/session journal. Uncommitted inline input is not checkpointed. The 64 MiB serialized envelope bound can be reached across several documents; errors retain the earlier checkpoint.

Native close/quit guards consider all sessions. HTML discard dialogs replaced a native dialog flow that was unreliable during testing. Custom native Quit menu/event handling prevents predefined Quit bypass. Do not remove it casually. Browser beforeunload is a best-effort warning, not reliable persistence.

## 9. Evolution: additions, removals and superseded approaches

| Earlier approach/problem | Current decision | Reason |
|---|---|---|
| Design mockup only | Worker-backed running app | Functional correctness and real file operations |
| One document replaced on Open | Independent document tabs | Parallel engineering files and isolated histories |
| Only outline for nested structure | Sheet buttons plus breadcrumbs; Browse optional | Familiar sheet navigation without tabs at every depth |
| Scalar edit dialog | Inline editing | Routine data entry should resemble Excel |
| Generic Add property in record table | Add row / Add column | Avoid scalar insertion and representation collapse |
| All rows must be objects to keep columns | Mixed record projection with Single value | Keep columns without deleting non-record content |
| Missing/null always use typed dialog | Blank cells edit inline with type guidance | New rows must be easy to fill |
| Apply/Cancel cell bar; navigation disabled during editing | Enter/Tab/click commits; Escape cancels | User explicitly rejected extra confirmation workflow |
| Permanently visible outline and inspector | Hidden by default | Grid-first workspace |
| Plain before/after source blocks | CodeMirror aligned highlighted diff | Locate and review actual changes |
| Browser preview/download-only | Web scripts, offline artifact, capability-based Save | No npm/install on end-user laptop; direct Save when permitted |
| External worker/assets | Inline worker plus single-file packager | Direct HTML needs no companion files/server |
| String replacement when embedding bundles | Callback replacements | Bundled `$&`/replacement markers corrupted embedded JS |

Do not restore rejected controls without an explicit new user request. Keep advanced operations available, but do not require JSON knowledge for routine row/cell entry.

## 10. Build/run commands

Run from the project directory. Node 24+ is the documented development requirement; native builds additionally need Rust stable and platform Tauri prerequisites. Lockfiles determine dependencies.

```sh
npm ci
npm test
npm run web:dev
```

Web dev uses localhost port 1420. An existing process may already own it; identify it rather than killing unrelated processes.

```sh
npm run web:build
npm run web:preview
npm run offline:build
```

- Web output: `dist/` for static HTTP(S) hosting.
- Offline output: `output/JSON-Workbench-Offline.html`.
- Offline build embeds built JS/CSS and the Vite inline document worker. Preserve callback-based replacements and escaping of closing script/style sequences.
- Vite currently warns about deprecated `inlineDynamicImports` and a large main bundle; these warnings are known, not resolved.

```sh
npm run desktop
npm run tauri -- build --bundles app
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run bench
```

On this developer Mac, Cargo was installed under `$HOME/.cargo/bin`; add it to PATH or source the cargo environment when needed. The native app builds into `src-tauri/target/release/bundle/macos/JSON Workbench.app`.

Windows, on an actual Windows development machine with Node/Rust/MSVC C++ Build Tools/WebView2:

```powershell
npm ci
npm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
```

Installer output is under `src-tauri/target/release/bundle/nsis/`. End users should not need npm if a working installer or offline HTML is supplied. No Windows installer is presently verified. The included Actions workflow cannot be treated as executed evidence. Earlier inspection found no Git remote configured; recheck before any remote work. No publishing, signing certificate, notarization or updater is configured.

## 11. Artifacts and freshness

`output/` is generated handoff material, not canonical source. Current artifact names:

- `JSON-Workbench-Offline.html`: latest rebuilt after direct browser Save addition.
- `OFFLINE-README.txt`: older instructions; direct Save supersedes download-only statements.
- `JSON-Workbench-macOS-arm64.zip`, `.sha256`, and `JSON Workbench.app`: earlier native handoff; do not assume latest browser/offline changes are included.
- `JSON-Workbench-web.zip`, `JSON-Workbench-source.zip`: generated on earlier passes; rebuild before redistributing as current.
- `output/playwright/`: historical screenshots, not necessarily latest UI.
- `output/verification/`: synthetic fixtures, checkpoints and benchmark evidence.

Before delivering a new artifact, build from current source, package after success, verify archive integrity/hash, and state exactly which platform/interaction was tested. An already-running native copy will retain its old interface until saved/quit/reopened. Reopening a browser tab must load the newly generated HTML, not a cached/downloaded older copy.

## 12. Tests and verification strategy

| Test file | Coverage |
|---|---|
| `tests/engine.test.ts` | Strict parsing, precision, generated roundtrips/edit sequences, path/revision behavior, projections/search/sort/structural operations |
| `tests/workspace.test.ts` | Scalar encoding and workspace recovery envelope/legacy handling |
| `tests/table-structure.test.ts` | Row shape stability, union fields, mixed entries, atomic column history, precise IDs/tokens, width/collision/stale rejection |
| `tests/browser-save.test.ts` | Mocked successful close, external-change rejection before writer creation, failed-write abort |

Historical native Rust checks: six passed in earlier passes. Browser Save mocks do not verify browser permission UI or filesystem locking. Historical Chromium UI checks cover rapid type-to-replace, Enter/Tab/Shift movement, click commit, invalid-number rejection, Escape, one-time toolbar replay, row/column additions and tab/source-draft retention. Earlier native checks cover file save roundtrip, external conflict rejection, recovery and quit guards. Do not present those as freshly rerun after every change.

Important manual regression sequence:

1. Open the synthetic pin fixture (`output/verification/excel-row-fixture.json`) or equivalent non-sensitive sample.
2. Add row 3; verify existing columns remain; type into blank cells.
3. Add a column; Undo removes only that addition; Redo restores it.
4. Select numeric cell, type rapidly; Enter moves down, Shift+Enter up, Tab right, Shift+Tab left.
5. Delete then immediately type several characters; no character loss or premature blur commit.
6. Type invalid numeric `01`; click away; editing stays and original token remains until valid commit. Escape restores prior value.
7. Edit a cell and click Add row; value commits and exactly one row is added.
8. Switch documents with invalid source draft; return and verify it; cancel/confirm closing only the intended tab.
9. Review modified/added/deleted lines; navigate chunks; save and verify baseline clears; undo/redo refresh review.
10. Browser Save: actual supported browser, permissions granted/denied/revoked, cancel picker, new file, Save as, second write, external edit, failed write.
11. Offline: double-click the exact HTML through file://, then Open/edit/review/Save or Download; use network logging to verify no application asset requests.
12. Desktop: native close and Cmd/Ctrl+Q with dirty background tabs, recovery restore, file conflict, permissions and non-ASCII paths.

Do not use proprietary company files as public-hosting or test fixtures. No example proves actual AUTOSAR correctness.

## 13. Next work, in priority order

1. Reproduce the user's Mac offline failure with real browser console evidence. The packaging fix passed syntax and embedded-bundle identity checks; direct-file execution remains the highest uncertainty.
2. Test real browser Save/picker flows for offline HTML and hosted builds. Verify user activation survives the actual save event path, permissions behave correctly, and failed writes retain dirty state. Do not weaken browser security to make it pass.
3. Add a repeatable offline packaging integrity check to the build, including no external script/style references and literal JS preservation. The prior corruption must not recur.
4. Verify diff navigation, alignment, no-change state, large-file behavior, theme/accessibility, and refreshed baseline after saving/history.
5. Build and test on Windows or a Windows CI runner. Produce an installer only after compilation; distinguish installer generation from runtime/UI verification.
6. Reconcile older README/design statements with this handoff; retain historical logs but label superseded claims.
7. Consider extracting the large App component into workspace/session, cell-interaction and lifecycle modules with behavioral tests. Preserve current guards/focus semantics during refactoring.
8. Further spreadsheet features only after data safety: single/rectangular clipboard operations, fill-down, column operations, row-key editing, recent files/drag-drop, schema validation. These are pending, not promised delivered.

No exclusive file lock, external file watcher/auto-reload, compare-with-latest-file command, three-way merge, browser recovery journal, cloud sync, complete Excel compatibility, or standards-specific AUTOSAR validation exists today.

## 14. Working rules for the next AI/developer

- Inspect current owning code and repository status before editing; the working tree historically contains untracked project files and no implementation commits were made during this session. Do not reset/clean it.
- Preserve the user's Excel-first direction. Do not replace it with JSON dialogs, a dashboard or decorative templates.
- State implementation and verification separately. Label unverified platforms and direct-file behavior honestly.
- Use the user's latest request to scope work; no need to re-ask settled preferences.
- Do not silently publish, upload user documents, bypass corporate restrictions or claim IT approval.
- Do not mutate generated binaries by hand. Rebuild and package from source.
- Update this handoff when behavior/decisions change; keep older dated logs as history.

A new agent can start by reading this file, checking `git status --short`, running `npm test`, and selecting the earliest unresolved verification item relevant to the user's next request. No additional product-design interview is required to resume.

### Favicon addition — 2026-11-10

`index.html` embeds the existing `assets/app-icon.svg` as a base64 SVG favicon. Hosted and offline builds retain it without a separate icon file or network request. The offline HTML and web ZIP were rebuilt; decoded favicon bytes were checked against the source SVG in source HTML and both built HTML entry points. Browser tab rendering was not visually verified. To change the icon, update the SVG and regenerate the data URI in index.html before rebuilding.

### Range/clipboard milestone — 2026-11-10

Added `src/grid/SheetRange.tsx` around the data grid and `src/grid/clipboard.ts`. Cell drag, Shift+click and Shift+arrow selection highlight a rectangle. Copy prepares exact scalar text from worker raw values, quoting tabs/newlines/quotes for TSV. If preparation is not ready, the UI asks the user to copy again. Paste accepts a TSV rectangle from the top-left selection, validates field types and bounds, and applies one engine batch. It does not grow tables automatically, tile data over a larger selection, paste into keys/type metadata/containers, or span pages. Blank pasted fields become null. Clipboard preparation/paste is bounded at 10,000 cells.

Engine `Mutation` now includes a batch of `AtomicMutation` operations. It executes against a temporary engine and commits the resulting text once; failure leaves the original revision/text/history untouched. This currently reparses repeatedly inside the temporary engine and needs profiling before large paste performance claims.

Right-click menus expose Add row, Add column, Delete row and record-column Rename/Delete. Column rename/delete currently require an unfiltered table fitting one page; the UI refuses rather than changing a partial subset. Insert-before, duplicate rows/columns, full-column selection and fill-down remain pending. Browser clipboard events and context-menu interactions require actual runtime verification; unit tests cover TSV and atomicity, not those browser flows.

### Row insertion/duplication and fill-down continuation — 2026-11-10

Context menus now include Insert row above/below and Duplicate row. The engine `relative-row` operation generates a collision-free key for object mappings, preserves the duplicate's exact raw JSON, and inserts at the selected source position. Array indices shift naturally. Sorted/filtered views still project their existing order; source insertion position is relative to the actual selected row. Each operation is one undo step.

Ctrl+D/Cmd+D or the range menu fills each selected column down from its top selected cell. It copies exact tokens rather than generating sequences. Incompatible scalar types, metadata and nested containers are rejected before the batch commits. Automated row insertion/duplication tests were added. Interactive range, clipboard, fill-down and context-menu flows remain unverified in a real browser; do not claim complete Excel parity. Column insert-before/duplication and broad large-table column operations remain pending.

### Value bar, column filters and full-table column edits — 2026-11-10

The user reported basic use worked; this is user confirmation of basic use, not comprehensive platform coverage. Added `src/editor/ValueBar.tsx`: active cell address, full scalar text, Enter/blur commit and Escape reset. Metadata/nested containers remain read-only in the bar. This is a value editor, not a formula evaluator.

Query now supports combined per-column case-insensitive substring filters. Toolbar selects the column and its filter text; Clear filters resets them. Filters affect the projection only. No value checklist/numeric condition menu exists yet.

`column-edit` now performs rename/delete across the entire table's object rows rather than only projected rows. It commits once and refuses collisions atomically. Added tests cover the 501st row, collision rollback and combined filters. Internally the operation uses a temporary engine and repeated mutations, so large-table performance still needs profiling. Paste and range operations remain bounded to the current page; column paging restriction removal does not establish unrestricted paste. New value-bar/filter UI interactions need runtime testing.

### Excel-style header sort/filter menus — 2026-11-10

Added `src/grid/ColumnMenu.tsx` and header dropdown buttons. Menus expose ascending/descending/clear sort, clear column filter, searchable distinct-value checklists, select/deselect shown, Apply and Cancel. Query `valueFilters` combines exact typed value keys across columns alongside existing substring filters. Engine builds distinct options from the full table before filtering/pagination, capped at 2,000 distinct options with an explicit truncation message. Clear filter includes all values. Empty selection matches no rows; missing/null/empty string and numeric/string values remain distinct. Numeric sorting uses the existing exact comparator and never reorders canonical source.

Added engine tests for cross-page distinct values, empty selections and exact typed distinctions. Header menu interactive/browser checks remain unverified. This is not Excel multi-key sorting or advanced numeric/date predicate filtering. Rebuilt offline HTML is the current user deliverable; desktop/source/web ZIP artifacts require regeneration before claiming they include this pass.

### Visible sorting and source reload — 2026-11-10

Active sort now shows a persistent ascending/descending arrow beside the field name and a named summary with Clear sort. Current query supports one active sort column, not multi-key sorting.

Reload source uses the browser handle when retained. Without a handle (including the current desktop adapter), the user chooses the source again through the file picker. It prompts before discarding dirty state, prepares a replacement worker before disposing the old one, replaces only the active session, refreshes the read/save baseline, and resets history/query to root. Cancellation leaves the document intact. It does not watch the disk or automatically reload. Browser-handle reload is covered by a mocked test; actual picker/reload UI behavior remains unverified.

### Header-click sort correction — 2026-11-10

Disabled react-data-grid's built-in header-click sorting (`sortable: false`). Sorting is explicitly selected through the column menu. Clicking another header must not transfer the current sort. The engine's sort projection and persistent indicator remain in place. Offline build passed; browser interaction verification remains pending.

### Show selected value/column in source — 2026-11-10

Engine/worker `locate` returns exact AST offsets and revision, optionally including the enclosing object property. Selected-cell Source navigation and Show selected value in source scroll/select the exact token in CodeMirror. Column menu Show column in source uses the first applicable field in the visible rows and selects that property; it does not highlight all column occurrences. Missing fields have no source token. Source targets clear on document activation and ordinary source refresh; staged source changes must be resolved before location jumps. Added exact value/property span test. Browser scrolling/focus interaction remains unverified.

### Repository organization and JSON Ledger branding — 2026-11-10

Current product display name is JSON Ledger; former name was JSON Workbench. npm project name is json-ledger. Rust crate, desktop bundle identifier and local-storage/recovery keys retain legacy values deliberately. Current offline filename is output/JSON-Ledger-Offline.html. Older JSON-Workbench artifacts may still exist locally and must not be mistaken for the latest build.

Current docs moved to docs/, this handoff is docs/HANDOFF.md, historical proposal/research/mockups are in docs/archive/, and editable app SVG is assets/app-icon.svg. output/, generated native schemas and local tooling state are ignored. README/CONTRIBUTING/CHANGELOG describe public repository navigation and first-commit checks. No license was chosen, no commit made and no push/publication performed as part of preparation. Name availability/trademark clearance is not established.


### Naming rejection, menu dismissal and source selection correction — 2026-11-10

The user rejected JSON Ledger. Product name is undecided; JSON Workbench is restored as a temporary display/npm name. Current offline deliverable returns to output/JSON-Workbench-Offline.html. Do not distribute stale JSON-Ledger artifacts as current. A later name requires user agreement.

Right-click menu now listens for outside pointerdown in capture phase and Escape, with listener cleanup. Source jump now uses active projected grid-cell coordinates rather than depending on inspector selection, which is cleared by mutations. Explicit cell-click tracking supplements grid active-position callbacks. CodeMirror drawSelection makes the source range visible. These fixes build and pass the existing tests, but interaction/visual confirmation is pending.


### Approved Lattice branding — 2026-11-10

The owner chose Lattice, with JSON Workbench as the descriptive subtitle. App chrome/native menu uses Lattice; HTML/window titles use the product name/subtitle. npm package name is lattice-json-workbench. Offline output is output/Lattice-Offline.html; CI filenames now match Lattice.app and Lattice-macOS.zip. Desktop bundle identifier, Rust crate and json-workbench local-storage/recovery keys remain unchanged for continuity. Earlier branding decisions in this log are superseded. Name availability/trademark clearance is unverified.

### Filter/source chrome simplification — 2026-11-10

Removed the duplicate toolbar column selector and substring-filter input. Header menus are the ordinary column-filter entry point; global Find and Clear filters remain. The legacy query substring-filter engine support remains available internally. Removed the standalone Show selected value in source button: Source already jumps to the active cell, and now its tooltip states that behavior. Filter-menu search focus now uses its existing border/inset highlight rather than an external outline. Offline build/test checks passed; visual confirmation remains pending.


### Unload warning and legacy offline filenames — 2026-11-10

Browser beforeunload now calls preventDefault and assigns returnValue for compatibility. It requests confirmation while any document is open, or while dirty/busy, covering background tabs and inline edits through the existing aggregate state. Browser-owned wording and lifecycle limitations apply; it is not guaranteed crash/mobile-close protection. The standalone source-jump button is absent; Source performs that action. Removed stale source-jump CSS and reworded Source tooltip. Offline packaging now refreshes both legacy JSON-Workbench/JSON-Ledger filenames with the same current HTML as Lattice, preventing stale local output copies from retaining the removed button. Copies transferred elsewhere must still be replaced manually.


### Documentation/initial commit preparation — 2026-11-10

Project location is ~/projects/lattice (macOS resolves it as ~/Projects/lattice). README, WEB and CHANGELOG were reconciled with current behavior. Source is ready for an initial local commit; generated output and local fixtures are excluded. At preparation time there was no GitHub remote configured. A destination repository URL was requested from the owner; do not invent one or claim a push succeeded without evidence. No project license has been selected. Historical no-commit/no-remote statements elsewhere in this log describe earlier checkpoints; use current Git state.


### Public download distribution — 2026-11-10

GitHub repository is https://github.com/arsxd/lattice and is public. Offline HTML and a ZIP with instructions are distributed as development preview release assets; generated binaries remain excluded from source Git. Use the Releases page for prereleases: GitHub latest-release routes may not select a prerelease. End users need only the HTML, not the repository source archive. Browser restrictions and unverified platform behavior still apply.
