# Sample datasets

Extra files for trying the **Upload** feature (top-right of the dashboard). Each
one is small and demonstrates a specific capability. Upload a file, and the whole
dashboard re-analyzes it instantly.

**Every dataset is provided in all three supported formats — CSV, Excel
(`.xlsx`) and JSON — and produces identical results**, which shows the loader is
format-agnostic:

| Dataset (`.csv` / `.xlsx` / `.json`) | What it demonstrates | Result when uploaded |
|---|---|---|
| `sample_clean` | The happy path — tidy, consistent data | 12 records, **12 valid, 0 issues** |
| `sample_messy` | Detection & handling of inconsistencies | 10 records, **8 valid, 2 excluded**, with all 8 issue types in the Data Quality Report (invalid date, invalid/missing times, negative hours, hours mismatch, overnight shift, duplicate) |
| `sample_new_categories` | **Extensibility** — reasons are never hardcoded | 10 records with brand-new reasons (`Sensor Fault`, `Tool Change`, `Calibration`, `Shift Handover`) that appear automatically in the filters, charts and legend |

`sample_new_categories.*` is the best one to try: it proves the app "remains
useful when new activity categories appear" — the new reasons show up with no
code change, and you can then group them via **Edit groups**. Upload the `.xlsx`
or `.json` version to see format support at the same time.

> These files use the same schema as the bundled dataset:
> `DAY_DATE, START, END, HOURS, REASON`. An uploaded dataset stays active (even
> across a browser refresh) until you click **"Use sample data"** in the header
> to return to the bundled default.
