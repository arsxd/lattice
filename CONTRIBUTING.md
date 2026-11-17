# Contributing

Use synthetic JSON fixtures, preserve exact numeric tokens, and keep ordinary editing spreadsheet-like.

Use focused unit and browser checks for the affected behavior during iteration. Run the complete suite before merging/releasing, or when a change crosses shared engine boundaries. Do not repeat passing checks without a relevant change. Build the offline preview once when delivering it; report which checks ran. Use `npm ci` when dependencies need installing. Browser permission, clipboard and focus interactions need real browser checks in addition to unit tests. Include the OS, browser, release and reproduction steps in reports. Do not upload private/company JSON files.

Generated output and private development notes are excluded from Git. Submit focused pull requests with behavior, tests and limitations. Project code uses 0BSD; dependency notices retain their own terms. Run `npm run notices` after changing production dependencies and retain the generated notices in your change. During release-candidate validation, keep changes limited to reproducible fixes, tests and documentation.
