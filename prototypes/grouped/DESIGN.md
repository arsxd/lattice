# Grouped child-row preview

Status: experimental, read-only; excluded from the main app and releases.

Goal: display records containing a child array as child rows with shared parent cells and a shared two-level header. Preserve JSON identity rather than merging records merely because their values look equal.

## First slice

- Choose one child array at a time. Never form a Cartesian product between sibling arrays.
- Parent scalar fields span that parent's visible children. Empty child arrays retain a parent-only row. Other nested values remain bounded summaries.
- Sort parent fields by moving whole groups; sort child fields only within each parent. Filtering child values removes nonmatching children while keeping their parent association. Matching parent values retain the complete group.
- Support arrays of records and object maps of records at a chosen path. A path picker lists bounded container paths; unsupported shapes explain why they cannot be grouped.
- Retain canonical parent/child JSON paths and exact numeric tokens, including values outside JavaScript's number range.
- Limits: 2 MiB source, 100 parents, 500 child rows, 20 columns and 10,000 displayed cells. Reject over-limit projections; never silently filter a partial dataset.
- Build a separate offline preview HTML. No app route, service worker, recovery storage, Save, editable cells or freeze controls are added.

## Before integration

Prove selection, copy/paste, parent/child insertion/deletion, undo, sort/filter semantics, frozen prefixes and source mapping. Merged-cell selection must identify an original JSON path unambiguously. Ordinary sheet mode must remain available; switching views must not mutate JSON. Performance limits and unsupported shapes must be visible before expensive projection. Keyboard and screen-reader behavior needs validation.

Acceptance tests cover distinct parents with equal labels, empty children, separate sibling arrays, missing fields, exact numbers, group-safe sorting/filtering and hard bounds. A browser test opens the generated standalone preview without network access and exercises sorting and filtering. This slice validates layout and read-only semantics only.

## Run and verify

Run `npm run grouped:verify` to type-check, build and exercise the actual offline HTML in Chromium. Open `output/Lattice-Grouped-Preview.html` directly to review the sample or a file. The parent-path picker explores at most 100 containers and four levels; this is a bounded prototype, not the main Browse explorer. Preview values are clipped to 240 characters. The source projection is complete within the stated limits; search uses full scalar values.

The model helper is exposed only through a development-branch DocumentEngine method. The normal app does not import the preview UI. No experimental assets are copied into the normal PWA or offline build.
