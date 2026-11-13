# Browser checks on Windows

Use [the hosted app](https://arsxd.github.io/lattice/) or download `Lattice-Offline.html` from [Releases](https://github.com/arsxd/lattice/releases). The downloaded HTML needs no Node installation or local server. Browser file access, clipboard permissions and app installation depend on browser support and settings.

## Automated coverage

The Web verification workflow runs Playwright Chromium on Windows and Ubuntu with generated fixtures. Results are available in [Actions](https://github.com/arsxd/lattice/actions/workflows/web.yml). Automated checks do not establish every native file-picker, clipboard or browser-permission interaction.

## Manual checks

Use a disposable file and keep its original copy.

1. Open the hosted app and downloaded HTML. Check menus, selection and dropdowns in light and dark themes at your display scaling.
2. Open, edit and Save a file, then verify its contents in another editor. Cancel Save as and check that unsaved changes remain. Verify Download when direct Save is unavailable.
3. Modify the original file externally, then try Save to check conflict handling. Reload source and inspect the current location and selection.
4. Check keyboard and menu clipboard actions, including denied permissions.
5. Enable Local recovery, edit a value or leave an incomplete Source draft, wait at least two seconds, and reopen. Restore the draft and save a copy. Turn recovery off to remove stored drafts.
6. Load the hosted app online, close it, disconnect and reopen to check offline startup. For updates, save and close all app windows and tabs before reopening.
7. Freeze rows and columns in a multiline table, scroll in both directions, edit, resize, filter, sort and unfreeze. Wide pages may disable row freezing to preserve rendering bounds.

For bug reports, include browser version, OS, display scaling, hosted/offline mode, reproduction steps and expected versus actual behavior. Remove personal data and file paths.
