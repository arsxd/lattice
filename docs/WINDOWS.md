# Windows checks

## Use without developer tools

Download `Lattice-Offline.html` from [Releases](https://github.com/arsxd/lattice/releases/latest) and open it in Chrome or Edge. Transfer only that HTML; npm and Node are not needed. Alternatively open [the hosted app](https://arsxd.github.io/lattice/) and use the browser install menu when your policy permits. Load it successfully online before testing cached offline startup.

## Automated Windows coverage

The Web verification workflow runs Playwright Chromium on `windows-latest` and Ubuntu. These checks use generated public/non-sensitive fixtures. They verify application behavior and are required before Pages deploys. They do not emulate your company's policies, native permission decisions or monitoring tools. Workflow results are visible in [Actions](https://github.com/arsxd/lattice/actions/workflows/web.yml).

## Manual managed-laptop protocol

Use a disposable non-confidential file first; keep its original copy.

1. Open both the downloaded HTML and installed PWA where allowed. Confirm menus, dropdowns and selection are readable in light/dark themes and at your normal Windows display scaling.
2. Open, edit and Save a disposable file. Reopen it in another editor to verify contents. Cancel Save as and confirm the app retains its unsaved state. If browser APIs are restricted, verify Download exports a valid edited copy.
3. Modify the original file externally, then try Save. Confirm conflict handling preserves your changes. Reload source and check the location/page/selection; external array reordering retains positional indices.
4. Test Ctrl+C/Ctrl+V and right-click clipboard actions. Permission denial should explain the fallback rather than claim success.
5. On non-sensitive data, optionally enable Local recovery, commit an edit or leave an incomplete Source draft, wait at least two seconds, then reload/reopen. Restore it and save a new copy. Turn recovery off afterward to remove test drafts.
6. Close the installed app, disconnect from the network, reopen and test local opening/editing. Reconnect before updating. Save and close ALL app windows/tabs when Update available appears.
7. Test a wrapped multi-line table with frozen rows/columns: scroll both directions, edit a frozen cell, resize rows, filter/sort and unfreeze. Wide pages may disallow row freeze to preserve rendering bounds.

Record browser/version, OS/display scaling, delivery mode, steps, expected/actual result and sanitized error text. Corporate-policy permission and monitoring outcomes remain unverified until performed on that actual environment. Do not bypass restrictions or use confidential data for bug reports.
