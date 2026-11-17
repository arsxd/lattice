# Example JSON files

All names, titles, prices and transactions are fictional demonstration data.

| File                                                                             | Contents                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [01-bookshop-workspace.json](01-bookshop-workspace.json)                         | Keyed books, related orders, reading lists, nested details, tags and precise numeric tokens |
| [02-store-orders.json](02-store-orders.json)                                     | Root array of orders with quantities, statuses, booleans, null notes and nested shipping    |
| [03-application-settings.json](03-application-settings.json)                     | Application wrapper with appearance, notifications and environment settings                 |
| [04-json-value-shapes.json](04-json-value-shapes.json)                           | Empty, missing and null values, simple and nested arrays, and numeric precision             |
| [05-merged-worksheet.json](05-merged-worksheet.json) | Curated book collections showing merged group rows and nested details headers together |
| [review/before.json](review/before.json), [review/after.json](review/after.json) | Added and removed books, changed prices and stock, and a revision change                    |

Choose **Explore sample workspace** in Lattice to open the bookshop directly. Open the other files through **Open JSON file…**.

To see both kinds of merging together, open the sample workspace, choose **collections**, then check **Show nested data**. Each collection name spans its book rows; **details** spans the **edition**, **pages**, **language** and **note** columns. `05-merged-worksheet.json` provides the same small example on its own.

To try review, open `review/before.json`, replace the staged whole-document Source with `review/after.json`, apply it, then choose **Review changes**.

The precision examples include `9007199254740993`, `1e400`, `-0`, a long decimal and text `00127`. Tools that parse and reserialize numbers may change these tokens.
