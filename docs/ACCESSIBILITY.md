# Keyboard and accessibility checks

This records verified behavior and remaining checks. It is not a WCAG conformance statement.

## Automated browser coverage

- Arrow navigation moves focus between grid cells. F2 edits a scalar; Escape cancels and returns focus to its cell.
- Keyboard Enter opens a header filter, its search field receives focus, and Escape closes it and returns focus to the header button.
- Row/column/range selection and the corner selection remain distinct from single-value inspection.
- Unsaved-change confirmation initially focuses Keep editing, cycles Tab within its buttons, and Escape preserves the draft.
- At a 720 × 500 CSS-pixel viewport, file and theme controls remain within the toolbar. This exercises a narrow layout; native browser zoom and OS scaling are separate manual checks.

These flows are in `e2e/workbench.spec.ts`. Existing browser coverage also checks pane resizing, source location without automatic text selection, Source line wrapping, format/undo behavior, theme controls and file-menu dismissal. These checks cover Chromium workflows, not full assistive-technology compatibility. Run `npm run test:browser` against the production build.

## Accessibility follow-up in rc.7

A focused follow-up on macOS with installed Chrome 158.0.8127.37 verified these local changes:

- The document tablist explicitly owns only document tabs; close buttons remain separately reachable. Arrow-key switching and closing another document retain the active tab.
- Accessible names include visible action labels and both the column letter and field name.
- The saved Review source is a labelled, read-only textbox reachable with Tab. PageDown scrolls an expanded comparison; typing does not edit either pane.
- axe-core 4.14.1 reported no violations for the WCAG 2/2.1 A/AA tags in the tested Home, Table (light/dark), invalid Source and expanded Review views after layout and theme transitions settled.

Two new keyboard/semantics regressions, the focused accessibility audit, and ten affected existing browser regressions passed. These automated checks do not establish full WCAG conformance. CSS zoom at 200% was only a layout smoke check; native zoom remains separate.

## Manual checks still required

- VoiceOver on macOS and NVDA on Windows: cell coordinates, row/column headers, selection state, sort/filter state, errors and draft status.
- Native browser zoom at 200%, OS text/display scaling, forced colors and reduced motion.
- Keyboard-only use of every menu, modal, clipboard action and multiple-document workflow, beyond the regression cases above.
- Contrast and focus visibility throughout both themes; automated keyboard checks do not establish contrast compliance.

Interaction references: [W3C grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
