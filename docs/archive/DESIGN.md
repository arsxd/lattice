# JSON Workbench — design proposal

Status: original design proposal, 8 November 2026. A development implementation now exists; see [IMPLEMENTATION.md](../IMPLEMENTATION.md) for verified features and remaining gaps. “JSON Workbench” is a working title, not a checked product name. No production application, performance result, or native compatibility claim is implied by the mockup.

## 1. Product and scope

Build an offline macOS/Windows document editor that makes arbitrary JSON understandable and safely editable as tables. The user's intended work includes JSON signal sheets for AUTOSAR applications, hardware-interface sheets, flat key/value configurations, and nested configurations. No actual customer file or schema has been supplied. Domain field names in the mockup are invented illustrative data, not AUTOSAR definitions or an assertion of standards compliance.

“Any JSON” means support for every JSON value shape, including primitive roots. It cannot mean unlimited file size, depth, or number of columns. Actual workload size and OS versions are unknown. Provisional performance fixtures are specified below; supported limits must be measured before release.

Essential outcome: open a file, locate a collection or property, understand types and nesting, edit a value, inspect the change, and save without changing unrelated data.

### Initial release

- Local open, drag/drop, recent files, multiple document tabs, Save and Save As.
- Object property tables; array record tables; optional keyed-record tables; mixed and primitive arrays; scalar roots.
- Navigable outline and breadcrumbs; nested values remain navigable, never implicitly expanded into multiple rows.
- Typed cell editing, add/remove property or array element, rename property, explicit type conversion.
- Column sizing/pinning/hiding, search, typed filters, view-only sort, one-cell clipboard operations.
- Source editor, error locations, synchronized selection, one document undo/redo history.
- Change review, external-file-change detection, recovery drafts, save failure handling.
- Keyboard operation, light/dark/system theme, platform shortcuts and native file dialogs.

### Subsequent increments

Rectangular paste with preview, optional local JSON Schema validation, saved column layouts, explicit nested-field projection, diff between separate files, CSV export with type-loss disclosure, JSONC/JSONL as separate formats. Do not claim these as first-release features.

ARXML, DBC, XLSX import, AUTOSAR semantic validation, formulas, cloud sync, AI assistants, collaboration, plugin execution, and database connectivity are outside this design's first release. File contents never upload as part of ordinary editing.

## 2. JSON-to-table contract

The table is a projection of the document. It is never the serialization model.

| Selected JSON shape | Default presentation | Editing semantics |
|---|---|---|
| Object with ordinary properties | Key / Type / Value property table | Each row is an existing property; preserve spelling and order |
| Array of objects | Record table; union of immediate keys in first-seen order | A cell addresses a property on the original row object |
| Object keyed by record identifiers | Property table; offer “View values as records” | Key column is the actual property name; rename is an explicit command |
| Array of primitives | Index / Type / Value | Original array index is visible; order is preserved |
| Mixed array | Index / Type / Value | Object/array values open a nested table |
| Primitive root | One-row Type / Value table | Edit the root through its type-aware editor |
| Empty object or array | Empty state with “Add property” or “Add item” | Ask for key/type or item type; do not invent a schema |

Nested object cells show “Object · N fields”; arrays show “Array · N items”. Enter/open action navigates; a breadcrumb returns. The inspector displays the complete selected value and its source path. No automatic recursive flattening: it can duplicate parent rows and disguise cardinality.

Optional later nested columns use arrays of path segments internally. A literal key `a.b` must remain different from object path `["a", "b"]`. JSON Pointer is the copyable external path convention; escape `~` and `/` per RFC 6901 [S2]. Duplicate-key objects cannot be uniquely addressed by JSON Pointer, so structured editing is disabled for a document containing duplicate keys until the source is repaired.

Missing, null, empty string, false, and zero are distinct. Show `missing` in subdued italic type, `null` as a type literal, `""` for an empty string, and the actual value for false/zero. The full cell type is available in the inspector and assistive label. Never fill absent fields during open, sorting, filtering, or save.

A column may contain mixed types. Its header reports mixed types rather than coercing values. Units, hex-looking strings, enum names, bit positions, and identifiers are ordinary data until an explicit schema is supplied. Preserve strings such as `"0012"`, `"0x1A"`, and `"false"` as strings. Bare hexadecimal is not valid JSON numeric syntax [S1].

Union-column discovery scans the whole selected collection asynchronously; display progress and discovered count. Proposed default: show the first 40 discovered columns and expose all discovered keys in Columns. A view column limit must not discard source fields. Extremely wide objects fall back to property navigation. Thresholds remain tunable after measurement.

## 3. Interaction model

### Layout decision

| Option | Strength | Cost | Decision |
|---|---|---|---|
| Single table with nested inline rows | Compact for shallow files | Ambiguous alignment for mixed shapes | Not default |
| Outline + table + inspector | Explicit hierarchy, focused editing, exact values | Takes horizontal space | Selected; inspector can collapse |
| Permanently split source and table | Immediate source context | Halves useful table width | Optional source/split view |

```
Native window title and platform menu
Document tabs                               modified indicator
Outline        Breadcrumb / selected collection      Table | Source
               Find/filter           Columns / Add
               Field headers                         Value inspector
               Rows                                  Path, type, value
               Rows                                  Edit validation
Status: displayed / total rows, selection, validation, save state
```

Normal window target 1440×900; usable minimum proposed 960×640. Outline starts at 220 px, inspector at 280 px; both resizable/collapsible. Below 1180 px the inspector becomes an explicitly opened overlay. Table scrolls horizontally; columns do not squash into unreadable text. Native title-bar controls stay platform-owned.

### Visual system

| Role | Light token | Reason |
|---|---|---|
| Work surface | `#FFFFFF` | Clean continuous data area |
| Chrome | `#F3F5F7` | Separate navigation from document |
| Divider | `#D9DEE5` | Row/column boundaries |
| Main text | `#20262E` | High legibility |
| Secondary text | `#596575` | Supporting counts and types |
| Focus/accent | `#245FC5` | One clear active cell and selection |

System UI font: SF system on macOS, Segoe UI on Windows. Monospace only for source, paths, and values where character alignment helps; no display font. 13 px default UI, 14 px editable values; support app zoom. Default rows 32 px, optional comfortable rows 40 px; 1 px grid lines, 4–6 px control corners. Numeric cells align right, strings left. No gradient decoration, floating dashboard cards, headline hero, decorative chart, or animated page entrance. Error and modified states require an icon/text as well as color. Dark tokens must be separately contrast-tested; do not invert light colors blindly.

Design review: the useful distinction is the visible relationship between hierarchy, selected cell and exact source value. Keep the table as the dominant surface. The outline is document structure, not a generic application navigation sidebar. Do not spend space on a branded welcome banner once a document is open.

### Core flow

1. Open JSON. Detect encoding, parse in a worker, report errors without silently repairing them. Select the root; suggest a records view only when its shape supports one.
2. Navigate to a collection. Show its full path, original indices/keys, counts, and current projection.
3. Select cell. Inspector shows exact value, type and path. Enter/F2/double click opens the appropriate editor.
4. Commit with Enter; Tab commits and moves; Escape cancels. Invalid values remain in the editor with a specific error; no partial mutation. Multiline string uses explicit Apply and Cancel.
5. Change review presents source diff and affected paths. Save operates on the whole document, not only filtered/visible records.
6. Successful save clears dirty state only for the saved revision. Edits made during saving remain dirty.

Commands: Cmd on macOS / Ctrl on Windows for O, S, Shift+S, F, Z. Redo uses platform conventions. Arrow keys navigate grid cells; Home/End and Page keys navigate within grid. Tab must allow leaving the grid at its boundaries. Navigation and editing are separate modes. Delete/Backspace must never ambiguously mean null, empty string, or property removal: expose explicit “Remove property”, “Set null”, and “Clear string” commands. Column hiding affects only the view; field deletion is a separate data command with affected-record preview.

Sort and filter alter a list of stable row references only. Numeric sorting uses exact decimal comparison, never binary floating point for arbitrary JSON numbers. Mixed-type sorting uses a documented fixed type order; ties preserve original order. Editing a sorted row targets its document node, never its display index. Invalid numeric filter syntax is rejected, not treated as zero. First release should defer repositioning the edited row until commit and retain focus on its stable identity.

One-cell copy: plain displayed value plus a private typed JSON clipboard payload when available. Plain text pasted into an existing string remains a string; into a number requires valid JSON number grammar. Missing cells require choosing a type. Multicell paste is deferred until a preview can show type errors, insertion/removal effects and filtered-row targeting as one atomic undoable transaction.

### Required exceptional states

| State | Required response |
|---|---|
| Invalid source JSON | Source view with location and repair guidance; table editing disabled; preserve draft |
| Duplicate keys | List locations; source-only editing until duplicates resolved; never silently keep one value |
| External edit, local clean | Notify and offer reload; preserve navigation where possible |
| External edit, local dirty | Compare, reload/discard local, or Save As; never silently overwrite |
| Save fails / disk full / permission denied | Keep dirty document and recovery copy; explain failed path and retry/Save As |
| Background parse pending | Mark table stale and lock structured edits until matching revision validates |
| Empty filtered result | “No matching rows” and Clear filters; distinguish empty document |
| Resource limit reached | Stop work cleanly, explain limit, retain original; do not pretend partial data is complete |
| App closes with unsaved work | Save / Discard / Cancel per document; failed save prevents close |
| Recovery after crash | Offer recovered draft alongside disk file, with timestamps and explicit restore/discard |

Malformed source can be saved as a draft/Save As only with an explicit “Save invalid JSON” choice. Ordinary save is disabled while invalid. Recovery stores the draft even when invalid.

## 4. Architecture decision

**Provisional choice: Tauri 2 + React/TypeScript + a dedicated document worker.** Tauri uses a Rust core and system WebViews [S3]. This permits native file operations with a web-based table surface. It does not make the grid a native widget. Choice must pass a real macOS/Windows spike before product implementation expands.

| Option | Relevant properties | Trade-off / best use |
|---|---|---|
| Tauri | Rust host, OS WebViews, JS UI [S3] | Selected provisionally; must test WebKit and WebView2 differences and JS/Rust boundary |
| Electron | Chromium-derived processes and Node main process [S4] | Fallback if consistent Chromium behavior or JS-only host work outweighs bundling runtime |

No measured startup, RAM, binary-size, or speed advantage is claimed. Framework selection cannot substitute for document correctness.

```
React UI: grid adapter / outline / source editor / inspector
     │ revisioned commands, bounded projections, diagnostic events
Document Web Worker: canonical text / syntax index / commands / history
     │ save snapshot and recovery checkpoint via restricted UI bridge
Tauri Rust host: file handles / conflict checks / write-replace / recovery
     │
User-selected local files and private application storage
```

- Worker owns canonical text and revision. Derived syntax nodes carry source spans; number values retain original lexemes. UI receives viewport values, indices and summaries, not a recursively cloned full JSON object on every keystroke.
- `jsonc-parser` is a candidate tokenizer/span parser, not permission to use ordinary object parsing and reserialization. Its documented offset and edit APIs are useful [S5]. Never use its JavaScript numeric node value as the authority for arbitrary-precision numbers. Extract token text from source spans. Any convenience `modify` operation must be audited for numeric reserialization; raw validated replacement text is required for numeric edits.
- Strict JSON parser options for initial release. UTF-8 input only initially; preserve detected UTF-8 BOM, line endings and trailing newline. Other encodings require explicit conversion or are refused; never silently replace invalid byte sequences. Escape spelling and untouched text must survive no-op save.
- Initial implementation may reparse the complete document in the worker after a committed transaction. This is a deliberate simplicity/performance trade-off, not an incremental-parser claim. Benchmark it before promising limits; an incremental text/syntax model or native engine is a later migration only if measurements require it.
- React grid candidate: react-data-grid; source editor candidate: CodeMirror 6. Keep each behind an adapter. Pin a tested release and its dependency/license manifest, never depend on moving main branches.
- The source editor's changes dispatch to the same history service; disable competing independent undo stacks. A source transaction can invalidate node IDs; cancel pending structured edits and remap selection by safe path/span or clear it.
- Rust host owns path authorization and save lifecycle; document IDs refer to user-opened handles. Reject renderer requests for arbitrary filesystem paths. No broad shell permissions, remote pages, dynamic evaluation of JSON values, or network resource loading from fields.

### Grid component gate

| Candidate | Evidence / concern | Gate |
|---|---|---|
| react-data-grid | Upstream documents virtualization, keyboard navigation, cell editing and clipboard hooks [S6] | First candidate: typed editors, OS webviews, focus, screen readers, controlled row updates |
| AG Grid Community | Free core grid; Enterprise is separate [S7] | Fallback if first candidate fails; enumerate required features and paid boundaries before adopting |

Avoid building a custom grid from scratch. Library capability is not proof that this product's editing semantics or accessibility work. Rectangular spreadsheet behavior is not assumed from a single-cell clipboard API.

## 5. Document correctness contract

A representative command contract (design notation, not implemented API):

```ts
type EditCommand = {
  documentId: string;
  baseRevision: number;
  targetNodeId: string;
  action: 'replaceValue' | 'insertProperty' | 'removeNode' | 'renameProperty';
  input: { kind: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'; raw: string };
};
// Separate typed payloads will replace this illustrative union at implementation.
// Worker rejects stale revision or mismatched node/type before applying anything.
```

Every mutation: resolve identity → check revision and constraints → create non-overlapping text edits → validate complete result → record forward and inverse edits → increment revision → update projections. Failed validation changes nothing. Transaction offsets are UTF-16 code units in the JS engine; Rust treats saved text as UTF-8 bytes and must not apply those offsets directly.

Maintain session node identities across table operations with an explicit edit mapping. Never use source array index, user-provided `id`, or JSON Pointer alone as a stable row ID. Array insertion shifts indices; duplicate user IDs are allowed. Source replacement may rebuild the identity map; stale commands are rejected.

Mandatory invariants:

1. No-op open/save is byte-identical for supported encoding, including formatting and number spellings.
2. A cell edit changes only its intended token or the smallest syntactically necessary region for structural edits. Full formatting is an explicit undoable command.
3. `9007199254740993`, long decimals, `-0`, and `1e400` retain their tokens without conversion to JavaScript Number. Exact comparison uses normalized sign/coefficient/exponent strings or a reviewed decimal library with bounded resources.
4. Undo followed by redo restores exact text and revision-consistent views. Save-point identity controls dirty state, not merely a count of edits.
5. Views never alter data. Hidden fields and filtered rows remain in saved JSON.
6. Object keys are stored in node lists/maps safely, not assigned onto ordinary prototype-bearing objects. Keys such as `__proto__` remain data.
7. Duplicate object keys are detected from syntax nodes before any record projection; ordinary object conversion is not a detection strategy.
8. Malformed strings, deeply nested input and huge tokens cannot indefinitely freeze the UI; impose documented resource budgets, cancellation and worker restart behavior.

### Persistence

Save snapshots a revision. Host checks expected disk identity/content hash, writes a temporary sibling file, flushes it, and uses a platform-tested replacement procedure. Preserve supported permissions; do not silently follow a changed symlink or truncate the destination first. If a safe replacement fails, keep both draft and original. Do not claim universal atomic/durable behavior across network shares and all filesystems; validate supported local filesystems and document residual races with non-cooperating external writers.

Recovery uses revisioned checksummed checkpoints/journal in per-user application storage, separate from originals. A checkpoint must exist before its journal is trimmed. Bound retention and disk usage; recover only complete entries. Proposed autosave debounce is 2 seconds after edits, to recovery storage only. This interval is a design target, not a no-loss guarantee. Offer recovery disable/delete controls because engineering files can contain confidential data. Do not log values or full document paths by default.

## 6. Verification and release gates

All numbers below are proposed acceptance targets, not benchmarks or current supported limits. Reference hardware/OS versions must be recorded before measuring.

| Fixture / action | Proposed target |
|---|---|
| 1 MB representative signal/config JSON | Open to usable table under 500 ms warm |
| 20 MB / 100,000 short records | Open under 3 s; cancellable progress |
| Cell commit on 20 MB fixture | p95 under 100 ms, no UI freeze |
| Scroll visible rows | p95 frame under 20 ms on agreed 60 Hz baseline |
| Repeated document open/close | No sustained growth beyond documented cache budget |
| 200 MB stress file / pathological depth / very wide rows | Controlled resource limit or measured read-only outcome, no corruption |

Measure total process-tree memory, parse/index time, worker transfers, source-editor duplication, projection size, save and recovery latency. Virtualized DOM does not imply bounded file memory. Default 20 MB editing target is provisional; the user did not specify a maximum. Do not silently reject valid larger files merely because of this planning number. Establish explicit supported limits and a preflight policy from the spike.

Required correctness suite: all JSON shapes; mixed/empty arrays; union columns appearing late; missing/null/empty; escaped keys and Unicode/emoji; huge integers and exponents; duplicate keys; LF/CRLF/BOM; malformed tokens; stale revisions; sorted/filtered edits; rename collision; empty-container insertion/deletion; undo across source/table; file changes during save; disk-full failure; crash during recovery/write. Use property-based tests for arbitrary shapes and edit/undo sequences plus byte-level golden files. Generated fixtures are synthetic and must be labelled.

Cross-platform verification: build and run on macOS Apple Silicon and Windows x64 first; add macOS Intel/Windows ARM only after demand and verification. Minimum OS versions remain undecided. Test native menus, open/save dialogs, file association, Unicode/long paths, case sensitivity, permissions, IME input, clipboard, display scaling, focus, system theme and window close. Test VoiceOver/macOS and NVDA/Windows; follow the WAI grid pattern [S8]. Current Tauri documentation recommends WebdriverIO's Tauri service with an embedded WebDriver server for Windows, Linux and macOS. Direct external tauri-driver supports Windows/Linux, not macOS [S9]. Evaluate the embedded route on both target OSes; keep test plugins out of release builds. Browser Playwright testing alone cannot certify the native wrapper; retain manual checks for OS dialogs, assistive technology and installation.

Distribution: build on each target OS; produce signed/notarized macOS distribution and a signed Windows installer when credentials are available; follow Tauri distribution guidance [S10]. Credentials, packaging, updater and actual install tests are not completed. Auto-update can be deferred from v1; if added, require signature verification and rollback testing.

## 7. Implementation sequence

1. **Risk spike:** prove exact numeric/text round trips, safe structural edits, grid editor behavior in both system webviews, worker latency on the fixtures, and native save failure handling. Output measurements and an architecture decision. Stop expansion if invariants fail.
2. **Document engine:** parser adapter, typed commands, projections, identity mapping, history, diagnostics and deterministic tests; independent of UI framework.
3. **Usable vertical slice:** open → arbitrary shape table → edit → undo → review → save; real files and native dialogs on both OSes.
4. **Workbench:** outline, nested navigation, inspector, source editing, search/filter/sort, themes, accessibility and close/recovery flows.
5. **Release hardening:** fault injection, performance limits, packaging/signing, installation checks and a small trial on user-provided redacted engineering documents.

Proposed source boundaries: `src/document/`, `src/worker/`, `src/grid/`, `src/editor/`, `src/workbench/`, `src/platform/`, `src-tauri/`, `tests/fixtures/`. This design package intentionally does not scaffold those modules yet.

Outstanding inputs: representative redacted JSON, preferred minimum OS versions, expected file sizes, need for JSONC/JSONL, and any actual schema/validation constraints. None prevents reviewing this design. These answers may change performance limits and later scope; they do not change the fundamental lossless-document requirement.

Sources and researched skills are recorded in [RESEARCH.md](RESEARCH.md). Visual review surface: [preview.html](preview.html).
