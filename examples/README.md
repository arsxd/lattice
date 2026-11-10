# Generic example JSONs

All names, titles, prices and transactions are fictional demonstration data. These examples deliberately avoid work-specific domains and schemas.

| File | Shows | Suggested screenshot |
|---|---|---|
| `01-bookshop-workspace.json` | 16 keyed books, related orders, reading lists, nested details, tags and precise numeric tokens | Books sheet with Details closed; filter category or availability |
| `02-store-orders.json` | Root array of 12 orders, quantities, statuses, booleans, null notes and nested shipping | Filter status, then sort quantity |
| `03-application-settings.json` | Single application wrapper with appearance, notifications and environments groups | Bottom sheet tabs and nested environment settings |
| `04-json-value-shapes.json` | Empty/missing/null distinctions, simple/nested arrays and numeric precision | Source or value inspection |
| `review/before.json`, `review/after.json` | Added/removed books, changed prices/stock and revision | Read-only source diff |

## Screenshot recipes

**Main editor:** Explore sample workspace loads the bookshop directly into the books table. Close Browse/Details, use a wide window, and capture readable titles, prices, stock and tags with bottom sheet tabs. No identifying work data is needed.

**Filters:** Open category or available in a column header. Search or tick values, then capture the actual anchored menu or filtered result. Sort price to illustrate numeric order.

**Nested data:** Open a book's details table. Use the orders sheet for nested shipping, or file 03 to show appearance/notifications/environments tabs below a wrapper.

**Review:** Open review/before.json, replace its staged Source with after.json, Apply source, then Review changes. Merely opening the two files in separate tabs does not compare them.

**Integrity:** Inspect the precision group in Source. It intentionally contains `9007199254740993`, `1e400`, `-0`, a long decimal and text `00127`. Avoid reserializing it through tools that round numbers.

Capture actual app behavior, not a mockup. Redact personal paths, browser tabs and unrelated files. No screenshots are fabricated here.
