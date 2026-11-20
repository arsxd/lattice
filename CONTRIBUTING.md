# Contributing to Lattice

Bug reports, small reproducible JSON examples and focused fixes are welcome. See the [user guide](docs/USER-GUIDE.md) for current behavior and [web architecture](docs/WEB.md) for implementation boundaries.

## Develop locally

Use Node.js 24 or newer.

```sh
npm ci
npm run web:dev
```

```sh
npm test
npm run test:browser
npm run offline:build
```

The browser suite builds a production preview on its own port. Main requires a pull request and passing unit/build checks plus Chromium workflows on Linux, Windows and macOS. Browser permission dialogs, installation and assistive technologies still need relevant manual checks.

## Propose a change

Keep the change focused and explain the user-visible problem, resulting behavior and relevant verification. Use synthetic fixtures. Preserve exact JSON numeric/string tokens, atomic revision-guarded edits and ordinary spreadsheet interactions. Keep work on experimental grouped sheets separate from the released editor.

Add regression coverage at the affected behavior rather than duplicating implementation details. Generated HTML, traces, local fixtures and development notes are excluded from Git. Changes to production dependencies must include refreshed `npm run notices` output.

## Report a bug

Use the [bug form](https://github.com/arsxd/lattice/issues/new?template=bug_report.md). Include the app version, OS/browser, hosted/HTML/PWA mode, steps, expected/actual behavior and a minimal synthetic JSON example when possible. Omit private data and credentials from examples and screenshots.

Project code uses [0BSD](LICENSE); bundled dependencies retain their own terms.
