# Design preview review

8 November 2026. Browser preview checks only; no production application exists.

- Visually inspected signal dictionary at 1440×900 in light theme and configuration property table at 1440×900 in dark theme.
- Exercised hardware-record selection and search; searching “Spare” produced 1 of 5 rows with 7 columns.
- Exercised invalid-source state at 960×640; Table control disabled. Found stale inspector content during review and changed the preview to hide the inspector while source is invalid. Recaptured and inspected the corrected state.
- Exercised external-change state; verified conflict text and restored inspector visibility.
- Found a favicon-only HTTP 404 on first load; added an inline empty favicon. Reload reported no console errors in subsequent page summaries.
- Corrected the property-table inspector to show the actual property value when selecting its key or type cell.

Screenshots are in `../output/playwright/`. Preview uses an ordinary HTML table with selectable buttons, not the proposed production keyboard grid. It demonstrates three selected JSON shapes, not the entire document engine. Arbitrary file loading, editing, sorting, saving, recursive navigation, recovery, native OS behavior, screen-reader behavior and performance are not implemented or verified. The smaller preview retains a narrow inspector outside the invalid state; the production design calls for a collapsible overlay below 1180 px.

The next gate is the risk spike in DESIGN.md, not a visual-polish sprint.
