# Shift Operations Analytics

A web application that turns raw employee **shift records** into operational
insight: it cleans messy data, visualizes shift patterns over time, scores
operational efficiency, detects recurring breakdown streaks, and surfaces
actionable insights for a plant manager.

Built with **React** (frontend) and **Django + Django REST Framework** (backend),
with **pandas** for the data pipeline. All analysis logic lives on the backend
and is exposed as a REST API the frontend consumes.

---

## Features
- **Data-quality pipeline** — detects, documents and handles inconsistencies in
  the raw data; nothing is silently dropped. Every flagged row appears in a
  quality report with the issue and the action taken.
- **Shift-analysis chart** — built from the **clean, consistent (valid) records
  only**; date on the X axis, time of day (12 AM → next 12 PM, a 36-hour span)
  on the Y axis, one colored bar per shift, coloured by reason and covering
  **every reason in the dataset**. The extended axis renders overnight
  (cross-midnight) shifts correctly.
- **Filtering** — by date range, valid-only toggle, and by **reason _or_ group**
  (multi-select chips that follow the active Reason/Group toggle — selecting a
  group filters to all of its member reasons). **All filters combine** (they are
  applied together / AND-ed), so you can narrow to, say, a date window *and* a
  specific group at once.
- **Aggregation** — hours rolled up by reason/group and by day-of-week, plus the
  Pareto view of the vital-few downtime drivers.
- **Operational Efficiency Score** — overall and as a daily trend.
- **Breakdown streak detection** — configurable, with a `breakdown` vs
  `failure_family` toggle.
- **At least three actionable insights**, computed from the data.
- **Dataset upload** — analyze any shift dataset, not just the bundled one.
  Accepts **CSV, Excel (`.xlsx`/`.xls`) and JSON**. An uploaded dataset stays
  active until you click "Use sample data" to return to the
  bundled default. Ready-made files to try it with live in
  [`sample_data/`](sample_data/) (see [Sample datasets](#sample-datasets)).

### Enhancements (beyond the brief)
- **Interactive reason grouping** — create/edit reason groups in the browser and
  a *Reason ↔ Group* toggle re-aggregates every chart, streak, score and filter
  live. This *demonstrates* the "categories can be grouped" requirement rather
  than just claiming it.
- **AI reason grouping** — a **✨ Suggest with AI** button asks an LLM to propose
  groups (merging synonyms/typos/casing) which pre-fill the editor for approval.
  The model's output is validated against the real reason list, so it can't
  invent categories.
- **AI executive summary** — an on-demand, plain-language briefing of the current
  view (efficiency, biggest downtime driver, worst day, one recommendation). The
  model only rephrases numbers computed server-side — it never sees raw rows, so
  it can't fabricate figures.
- **Reliability KPIs** — **MTBF / MTTR / Availability** over the unplanned-failure
  family, each with a hover tooltip showing exactly how it was computed.
- **Extra visualizations** — hours by reason/group, a **Pareto chart** (vital-few
  downtime drivers), an **hours-by-day-of-week** breakdown, and an **activity
  heatmap** (shifts active by hour of day across dates).
- **CSV export** of the current (filtered) view, with the resolved group column.
- **KPI summary row**, a resilient cold-start loading state, and a polished
  dashboard UI.

> The two AI features (Groq) are **optional**: without a `GROQ_API_KEY` the rest
> of the app works exactly the same and those buttons surface a clear message.

## Tech stack
| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite  |
| Backend | Django 6 + Django REST Framework |
| Data | pandas |
| Database | SQLite (local dev) · PostgreSQL — Supabase (production) |
| AI (optional) | Google Groq (LLM) — free tier, called over the standard library |
| Tests | Django test runner (backend) · Vitest + React Testing Library (frontend) |

## Project structure
```
.
├── backend/
│   ├── config/                 # Django project (settings, urls)
│   ├── shifts/                 # app
│   │   ├── data/shift_data.csv # bundled default dataset
│   │   ├── models.py           # ShiftRecord
│   │   ├── cleaning.py         # data-cleaning pipeline (+ ingest_csv)
│   │   ├── analysis.py         # efficiency, streaks, reliability, chart, insights
│   │   ├── grouping.py         # data-derived reason policy (no hardcoding)
│   │   ├── ai.py               # optional AI grouping + summary (Groq)
│   │   ├── views.py / urls.py  # REST API
│   │   ├── serializers.py
│   │   ├── tests.py            # 25 tests (unit + DRF API integration)
│   │   └── management/commands/load_dataset.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api.js              # API client
│   │   ├── colors.js           # deterministic reason palette
│   │   ├── hooks/              # useDashboardData (data-fetch orchestration)
│   │   ├── components/         # chart, filters, panels, upload (+ *.test.jsx)
│   │   └── App.jsx
│   ├── vitest.config.js
│   └── .env.example
└── sample_data/                # extra datasets for the Upload feature (CSV/XLSX/JSON)
    ├── sample_clean.*          # happy path — 12 records, 0 issues
    ├── sample_messy.*          # every inconsistency type the pipeline handles
    ├── sample_new_categories.* # brand-new reasons (extensibility demo)
    └── README.md               # what each file demonstrates
```

---

## Getting started

### Prerequisites
- **Python 3.12+** (developed on 3.14)
- **Node.js 18+** and npm

You run **two processes**: the Django API (port 8000) and the Vite dev server
(port 5173). Open two terminals.

### 1) Backend (Django API)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate                 # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py load_dataset --replace   # load + clean the bundled dataset
python manage.py runserver                # http://127.0.0.1:8000
```

### 2) Frontend (React)
In a second terminal:
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### 3) Open the app
Visit **http://localhost:5173**. The Vite dev server proxies `/api` to the Django
server, so there is no CORS setup to worry about.

> If you skip `load_dataset`, the dashboard loads but is empty until you either
> run that command or upload a CSV from the header.

### Sample datasets
The [`sample_data/`](sample_data/) folder holds extra datasets for exercising the
**Upload** feature (top-right of the dashboard). Each dataset ships in **all three
supported formats — CSV, `.xlsx` and JSON — and produces identical results**,
demonstrating that the loader is format-agnostic:

| Dataset (`.csv` / `.xlsx` / `.json`) | Demonstrates | Result when uploaded |
|---|---|---|
| `sample_clean` | The happy path — tidy, consistent data | 12 records, **12 valid, 0 issues** |
| `sample_messy` | Detection & handling of inconsistencies | 10 records, **8 valid, 2 excluded**, exercising all 8 issue types (invalid date, invalid/missing times, negative hours, hours mismatch, overnight shift, duplicate) |
| `sample_new_categories` | **Extensibility** — reasons are never hardcoded | 10 records with brand-new reasons (`Sensor Fault`, `Tool Change`, `Calibration`, `Shift Handover`) that appear automatically in filters, charts and legend |

`sample_new_categories.*` is the best one to try: it proves the app "remains
useful when new activity categories appear" — the new reasons show up with no
code change, and you can then group them via **Edit groups**. See
[`sample_data/README.md`](sample_data/README.md) for details.

---

## Configuration
Everything runs with **no configuration**. To override defaults, copy
`backend/.env.example` → `backend/.env`. Key options:

| Variable | Default | Purpose |
|---|---|---|
| `NON_PRODUCTIVE_REASONS` | `Breakdown,Unknown Failure` | Reasons excluded from productive hours |
| `REASON_GROUPS` | *(none)* | JSON map to group reasons into buckets |
| `STREAK_PRESETS` | breakdown / failure_family | JSON target sets for streak detection |
| `DEFAULT_DATASET_PATH` | bundled CSV | Dataset loaded by `load_dataset` |
| `DATABASE_URL` | SQLite file | Postgres URL in production (Render injects it); unset → local SQLite |
| `GROQ_API_KEY` | *(none)* | Enables the AI grouping + summary features. Unset → those features are cleanly disabled. Free key: https://console.groq.com/keys |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | LLM used for AI features (`llama-3.1-8b-instant` for higher limits) |
| `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` | dev defaults | Standard Django settings |

Frontend: `VITE_API_BASE` (default `/api`) and `VITE_API_PROXY`
(default `http://127.0.0.1:8000`) — see `frontend/.env.example`.

---

## Live demo
The app is deployed with the frontend on **Vercel** and the Django API on
**Render** (data in **Supabase Postgres**):

| | URL |
|---|---|
| **App (frontend)** | https://shift-operations-analytics.vercel.app/ |
| **API (backend)** | https://shift-analytics-api.onrender.com |

---

## API reference
Base path: `/api`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dataset` | Cleaned records. Filters: `start_date`, `end_date`, `reasons` (csv), `valid_only` |
| GET | `/quality-report` | Summary + every flagged row with issues and actions |
| GET | `/reasons` | Distinct reasons (data-derived) + counts + grouping |
| GET / PUT | `/grouping` | Get or set the active reason grouping ({label: [reasons]}) |
| POST | `/grouping/suggest` | AI-suggested grouping (Groq). 503 if not configured |
| GET | `/analysis/efficiency` | Efficiency score, overall and per day |
| GET | `/analysis/streaks` | Breakdown streaks. Params: `preset`, `reasons`, `min_days` |
| GET | `/analysis/shift-chart` | Per-record segments for the shift chart |
| GET | `/analysis/insights` | Actionable insights |
| GET | `/analysis/reliability` | MTBF / MTTR / availability over unplanned failures |
| GET | `/analysis/ai-summary` | AI executive summary of the current view (Groq). 503 if not configured |
| GET | `/dataset/export.csv` | Download the current (filtered) records as CSV |
| POST | `/dataset/upload` | Upload a CSV/Excel/JSON file (form field `file`); replaces the active dataset |

All GET analysis endpoints accept the same filter params as `/dataset`.

---

## Data cleaning: detected inconsistencies & handling
The dataset contains deliberate operational inconsistencies. The pipeline
(`shifts/cleaning.py`) detects each one, records a structured issue
(`{code, detail, action}`), and either **recovers** the row or **excludes** it
from analysis — but always keeps it in the quality report.

**Guiding rule:** when the `HOURS` column and the timestamps disagree, the
**START/END timestamps are the source of truth** (in the sample data the vast
majority of rows already agree with them), so `HOURS` is recomputed.

| Issue code | What it catches | How it's handled |
|---|---|---|
| `INVALID_DATE` | `DAY_DATE` not a real date (e.g. `2025-15-55`) | Recover the date from `START` if valid; otherwise exclude |
| `INVALID_START` | `START` not a valid timestamp (e.g. `invalid-time`) | Exclude (no reliable timeline) |
| `INVALID_END` | `END` not a valid timestamp | Exclude |
| `MISSING_START` | Empty `START` | Derive `START = END − HOURS` if possible; else exclude |
| `MISSING_END` | Empty `END` | Derive `END = START + HOURS` if possible; else exclude |
| `NEGATIVE_HOURS` | `HOURS ≤ 0` (e.g. `-3`) | Recompute from START/END if valid; else exclude |
| `HOURS_MISMATCH` | `HOURS` disagrees with `END − START` | Recompute `HOURS` from the timestamps; keep the row |
| `END_BEFORE_START` | `END` precedes `START` | Exclude |
| `CROSS_MIDNIGHT` | Shift spans midnight | **Informational — kept** (a legitimate overnight shift; drives the 36 h chart axis) |
| `DUPLICATE` | Exact duplicate of an earlier row | Keep the first, exclude later copies |

A row is **valid** (used in charts, streaks and efficiency) only if it has a
usable date, valid/derivable start and end, positive hours, a reason, and is not
a duplicate. On the bundled dataset: **51 records → 49 valid, 2 excluded**
(one unrecoverable timestamp, one duplicate). Invalid rows still appear in the
quality report so nothing is hidden.

---

## Breakdown streak analysis
> **Definition.** A *breakdown streak* is a maximal run of **≥ N consecutive
> calendar days** where each day has **at least one** valid record in a
> configurable **target reason set**. Default `N = 2`.

Each streak reports its date span, length in days, **total downtime hours
(severity)**, and the contributing records.

**Two targets ship (both configurable, neither hardcoded into logic):**
- `breakdown` (default) — literally the `Breakdown` reason. Faithful to the
  wording "recurring breakdown periods."
- `failure_family` — `Breakdown` + `Power Failure` + `Machine Jam` +
  `Unknown Failure`, i.e. all unplanned downtime.

**Why both matter (a key finding).** On the bundled data, the literal
`Breakdown` label yields a single 2-day streak (Oct 8–9). Widening to the
failure family reveals a **4-day downtime run (Oct 7–10)** plus two 2-day runs —
a pattern that is nearly invisible on the raw label alone. This is concrete
evidence for why categories must be *groupable* (see [Extensibility](#extensibility-no-hardcoded-categories)).

**Assumptions:**
- A single calendar-day gap ends a streak (strict consecutive days).
- A day "counts" if any valid record that day is in the target set.
- Rows excluded during cleaning do not contribute to a streak.
- The `failure_family` target is intentionally **broader** than the efficiency
  formula's non-productive set — this divergence is deliberate (see below).

---

## Operational Efficiency Score
```
Efficiency = (Productive Hours / Total Hours) × 100
```
- **Productive Hours** = hours whose reason is **not** in the non-productive set
  (default `Breakdown` and `Unknown Failure`, per the assignment).
- **Total Hours** = sum of all valid shift hours.

Computed **overall** and **per day** (shown as a trend line). On the bundled
dataset the overall score is **≈ 86.8%**.

> **Note on the formula.** As specified, only `Breakdown` and `Unknown Failure`
> are non-productive, so `Power Failure`, `Material Shortage`, `Idle`, etc. count
> as *productive* even though they are operationally downtime. I follow the
> formula literally, but the non-productive set is configurable via
> `NON_PRODUCTIVE_REASONS` if a stricter definition is wanted. This is also why
> streak detection uses its own (broader) target set rather than reusing this one.

---

## Operational insights
`/analysis/insights` computes actionable items (all data-derived), including:
1. **Largest source of downtime** — the failure reason with the most lost hours.
2. **Peak breakdown window** — the time-of-day band where breakdowns cluster
   (→ schedule preventive maintenance before it).
3. **Longest multi-day failure streak** — treat as a single incident for RCA.
4. **Lowest-efficiency day** — where to focus a log review.
5. **Data-quality signal** — share of records excluded for inconsistencies.

---

## Extensibility: no hardcoded categories
The assignment requires the solution to "remain useful when new activity
categories appear or categories are grouped together." Accordingly:
- **Reasons are always derived from the data.** No list of reasons is hardcoded
  anywhere; a new category simply appears in filters, charts and the legend.
- **Colors** are assigned deterministically from the sorted reason list, so a new
  reason just takes the next color.
- **Policy is configurable, not baked in:** the non-productive set
  (`NON_PRODUCTIVE_REASONS`), reason grouping (`REASON_GROUPS`), and streak
  targets (`STREAK_PRESETS`) are all environment-driven.
- **Grouping** (`shifts/grouping.py`) lets several raw reasons collapse into one
  bucket (e.g. an "Equipment Failure" group) without touching analysis code.

## Testing
**Backend — 25 tests** (unit + integration): the cleaning rules (each issue
code), the analysis layer (efficiency exclusion, consecutive-day streak logic,
configurable targets, overnight-axis handling, insight generation), reason
grouping, and a set of **DRF API integration tests** that hit the endpoints and
assert exact numbers, filtering, the grouping PUT→GET round-trip, and the CSV
download:
```bash
cd backend
python manage.py test shifts
```

**Frontend — Vitest + React Testing Library** for component behavior (filter
chips, group collapse/expand, reliability tiles):
```bash
cd frontend
npm test
```

## Design decisions & assumptions
- **SQLite locally, Postgres in production.** The same code runs on both — Django
  picks the engine from `DATABASE_URL` (`dj-database-url`). Local dev uses a
  zero-setup SQLite file (no external services); production points `DATABASE_URL`
  at **Supabase Postgres** for durable, concurrent storage. No schema changes are
  needed to switch — the models and migrations are database-agnostic.
- **Analysis on the backend.** All cleaning and analytics run server-side (Python/
  pandas) and are exposed via REST; the frontend only renders.
- **Timestamps are UTC** (`...Z`) as provided; `DAY_DATE` is treated as the
  operational day and reconciled with the timestamps.
- **Upload replaces the active dataset**, with the bundled CSV as the default/
  fallback — so the app is useful immediately and with your own data.
