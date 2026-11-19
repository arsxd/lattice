# v1.0.0-rc.4 validation

This is a release candidate, **not the stable release**. This round includes file-opening and usability improvements. Grouped child-row layouts remain experimental and are excluded from this candidate.

Download `Lattice-Offline.html` and `SHA256SUMS.txt` from [v1.0.0-rc.4](https://github.com/arsxd/lattice/releases/tag/v1.0.0-rc.4). The HTML runs by itself. The checksum is optional for use and lets testers identify the exact artifact. The [hosted app](https://arsxd.github.io/lattice/) follows main; its contents may change after this candidate. Use the versioned HTML for a repeatable candidate test.

## Automated gates

| Gate                     | Evidence                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit/engine safety       | `npm test`: revision guards, atomic edits, exact number/string tokens, undo and invalid drafts                                                                     |
| Browser workflows        | `npm run test:browser`, Chromium on Windows, Linux and macOS; see the candidate commit's [Actions run](https://github.com/arsxd/lattice/actions/workflows/web.yml) |
| Save contract            | Controlled browser-handle tests: successful Save, cancelled Save as, failed close/abort and external changes; these do not test native permission dialogs          |
| Standalone distribution  | Actual `file:` HTML with networking disabled: edit, Undo/Redo, export and reopen; exact UTF-8 BOM, CRLF, escape spelling and large-number tokens                   |
| Dependencies and notices | Production `npm audit` (high/critical advisories block CI), generated notices checked against tracked files; this is not a complete security audit                 |
| Artifact identity        | CI-built HTML plus SHA-256 checksum; release download must match the CI artifact                                                                                   |

[Performance measurements](PERFORMANCE.md) cover one synthetic shape and one machine. They are evidence for those scenarios, not a maximum-size guarantee. See [accessibility coverage](ACCESSIBILITY.md) for what automation does and does not establish.

## Manual release gates

All results below are **pending** until recorded for this candidate. Earlier basic-use reports do not establish that these specific cases passed.

Target combinations: macOS Chrome and Windows Chrome/Edge, using the browser versions actually tested. Record exact OS/browser versions. CI's Chromium is not a substitute for installed Chrome/Edge or native file dialogs. Safari/Firefox are outside this release target until separately verified.

| ID  | Check                                                                                                                              | Expected outcome                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| M1  | Open a disposable real file, edit several values/keys, Save, close and reopen; inspect in another editor                           | Correct values and types; unrelated data and precise number tokens preserved                              |
| M2  | Cancel Open/Save as, deny file access, and modify the source in another editor before Save                                         | Cancellation retains edits; blocked access is understandable; detected external change is not overwritten |
| M3  | Sort/filter, edit simple arrays, navigate nested tables and document tabs, copy/paste, resize and freeze/unfreeze                  | Operations affect intended cells; selection, indicators and previews remain consistent; no sustained hang |
| M4  | Edit Source and Review; try invalid JSON, Undo/Redo, per-change restore and closing a dirty draft                                  | Invalid changes cannot silently reach saved data; draft protections and undo remain usable                |
| M5  | Enable recovery, leave an incomplete draft, wait for its checkpoint, reopen and restore; then disable recovery                     | Complete draft retained, including sibling JSON outside scoped Source; disabling removes recovery records |
| M6  | Installed PWA: start after disconnecting; reconnect for an update, save, close all windows and reopen                              | Cached app starts offline; update does not discard unsaved work; newer app loads after reopening          |
| M7  | Keyboard-only workflow, light/dark themes, native 200% zoom and display scaling; screen-reader checks from the accessibility guide | Controls and data remain reachable, readable and understandable; no blocking focus/announcement defect    |

Use a separate copy of important data. Results can contain the data shape and approximate size without sharing its contents. Native file access depends on browser support and permission; Download is the documented fallback. No exclusive file lock or three-way merge is promised.

## Record a result

Record candidate version (and checksum if downloaded), OS/browser version, hosted/HTML/PWA mode, test ID, approximate file size/shape, actions, expected/actual outcome and pass/fail. Retest affected cases after each fix. Keep private data and filesystem paths out of public reports; use the [bug form](https://github.com/arsxd/lattice/issues/new?template=bug_report.md).

Use the candidate for roughly a week of normal work alongside the targeted checks. Elapsed time alone does not qualify a release. Data loss, incorrect saves, wrong-target edits, unrecoverable drafts or an unusable core workflow block stable publication. Publish a new candidate after fixes; do not silently replace a candidate's HTML.

## Stable promotion

Publish v1.0.0 only after automated gates pass, the targeted manual results are recorded, and no unresolved release blocker remains. The project license decision is complete: project code is 0BSD; third-party notices retain their own terms. Accessibility or browser limitations that remain must be explicit and must not prevent the documented core workflows in the target combinations.

The previous downloadable prerelease remains available for rollback. Save/export your files before changing versions; switching app versions does not undo saved JSON changes. PWA updates remain passive—save and close all app windows before reopening.
