# Keyboard and accessibility checks

This records verified behavior and remaining checks. It is not a WCAG conformance statement.

## Automated browser coverage

- Arrow navigation moves focus between grid cells. F2 edits a scalar; Escape cancels and returns focus to its cell.
- Keyboard Enter opens a header filter, its search field receives focus, and Escape closes it and returns focus to the header button.
- Row/column/range selection and the corner selection remain distinct from single-value inspection.
- Unsaved-change confirmation initially focuses Keep editing, cycles Tab within its buttons, and Escape preserves the draft.
- At a 720 × 500 CSS-pixel viewport, file and theme controls remain within the toolbar. This exercises a narrow layout; native browser zoom and OS scaling are separate manual checks.

These flows are in `e2e/workbench.spec.ts`. Existing browser coverage also checks pane resizing and Source/Review workflows. Run `npm run test:browser` against the production build.

## Manual checks still required

- VoiceOver on macOS and NVDA on Windows: cell coordinates, row/column headers, selection state, sort/filter state, errors and draft status.
- Native browser zoom at 200%, OS text/display scaling, forced colors and reduced motion.
- Keyboard-only use of every menu, modal, clipboard action and multiple-document workflow, beyond the regression cases above.
- Contrast and focus visibility throughout both themes; automated keyboard checks do not establish contrast compliance.

Interaction references: [W3C grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
