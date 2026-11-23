# Security

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

**[Report a vulnerability](https://github.com/arsxd/lattice/security/advisories/new)** (GitHub private vulnerability reporting).

Include the Lattice version (home footer or status bar), browser and OS, and steps to reproduce. Use a small synthetic JSON file; do not send private data or file paths.

Lattice is maintained by one person. Reports are handled on a best-effort basis; there is no guaranteed response time.

## Supported versions

Only the latest published release receives fixes. Release candidates are superseded by the next candidate or by the stable release.

## What is in scope

- Script injection or other unsafe handling of JSON content, filenames or clipboard data in the app.
- Anything that sends document contents off the device. No upload endpoint or analytics integration is implemented.
- Weaknesses in the service worker, the offline HTML or the release artifacts (for example a checksum that does not match).
- Vulnerable production dependencies that affect the shipped app.

Data-integrity bugs that are not security issues (a wrong save, an edit to the wrong cell, a lost draft) belong in the [bug form](https://github.com/arsxd/lattice/issues/new?template=bug_report.md), and they are treated as release blockers.

## What Lattice does not claim

Lattice runs in your browser with the permissions you grant it. It does not sandbox the files you open, lock files against other programs, or audit third-party browsers and extensions. See [Local files, clear limits](README.md#local-files-clear-limits).
