# Shift Operations Analytics

A web application that turns raw employee **shift records** into operational
insight: it cleans messy data, visualizes shift patterns over time, scores
operational efficiency, detects recurring breakdown streaks, and surfaces
actionable insights for a plant manager.

Built with **React** (frontend) and **Django + Django REST Framework** (backend),
with **pandas** for the data pipeline. All analysis logic lives on the backend
and is exposed as a REST API the frontend consumes.
---

## Table of contents
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Data cleaning: detected inconsistencies & handling](#data-cleaning-detected-inconsistencies--handling)
- [Breakdown streak analysis](#breakdown-streak-analysis)
- [Operational Efficiency Score](#operational-efficiency-score)
- [Operational insights](#operational-insights)
- [Extensibility: no hardcoded categories](#extensibility-no-hardcoded-categories)
- [Testing](#testing)
- [Design decisions & assumptions](#design-decisions--assumptions)

---

## Features
- **Data-quality pipeline** — detects, documents and handles inconsistencies in
  the raw data; nothing is silently dropped. Every flagged row appears in a
  quality report with the issue and the action taken.
- **Shift-analysis chart** — date on the X axis, time of day (12 AM → next 12 PM,
  a 36-hour span) on the Y axis, one colored bar per shift by reason. The
  extended axis renders overnight (cross-midnight) shifts correctly.
- **Filtering** — by date range, by reason (multi-select), and valid-only toggle.
- **Operational Efficiency Score** — overall and as a daily trend.
- **Breakdown streak detection** — configurable, with a `breakdown` vs
  `failure_family` toggle.
- **Extra visualization** — total hours by reason.
- **At least three actionable insights**, computed from the data.
- **CSV upload** — analyze any shift CSV, not just the bundled one.

## Tech stack
| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite, [Recharts](https://recharts.org/) |
| Backend | Django 6 + Django REST Framework |
| Data | pandas |
| Database | SQLite by default; **PostgreSQL-ready** via `DATABASE_URL` |

## Project structure
```
.
├── backend/
│   ├── config/                 # Django project (settings, urls)
│   ├── shifts/                 # app
│   │   ├── data/shift_data.csv # bundled default dataset
│   │   ├── models.py           # ShiftRecord
│   │   ├── cleaning.py         # data-cleaning pipeline (+ ingest_csv)
│   │   ├── analysis.py         # efficiency, streaks, chart shaping, insights
│   │   ├── grouping.py         # data-derived reason policy (no hardcoding)
│   │   ├── views.py / urls.py  # REST API
│   │   ├── serializers.py
│   │   ├── tests.py            # 15 unit tests
│   │   └── management/commands/load_dataset.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api.js              # API client
    │   ├── colors.js          # deterministic reason palette
    │   ├── components/         # chart, filters, panels, upload
    │   └── App.jsx
    └── .env.example
```

---

## Getting started

### Prerequisites
- **Python 3.12+** (developed on 3.14)
- **Node.js 18+** and npm

You run **two processes**: the Django API (port 8000) and the Vite dev server
(port 5173). Open two terminals.

### 1) Backend (Django API)

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py load_dataset --replace   # load + clean the bundled dataset
python manage.py runserver                # http://127.0.0.1:8000
```

**macOS / Linux (bash):**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py load_dataset --replace
python manage.py runserver
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

---

## Configuration
Everything runs with **no configuration**. To override defaults, copy
`backend/.env.example` → `backend/.env`. Key options:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | SQLite | Set to a `postgres://…` URL to use PostgreSQL — no code changes |
| `NON_PRODUCTIVE_REASONS` | `Breakdown,Unknown Failure` | Reasons excluded from productive hours |
| `REASON_GROUPS` | *(none)* | JSON map to group reasons into buckets |
| `STREAK_PRESETS` | breakdown / failure_family | JSON target sets for streak detection |
| `DEFAULT_DATASET_PATH` | bundled CSV | Dataset loaded by `load_dataset` |
| `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` | dev defaults | Standard Django settings |

Frontend: `VITE_API_BASE` (default `/api`) and `VITE_API_PROXY`
(default `http://127.0.0.1:8000`) — see `frontend/.env.example`.

### Using PostgreSQL
The app ships on SQLite for zero-friction setup. To run on Postgres instead:
```bash
# backend/.env
DATABASE_URL=postgres://user:password@localhost:5432/renata_shifts
```
Then `python manage.py migrate && python manage.py load_dataset --replace`. The
same models and migrations apply.

---

## API reference
Base path: `/api`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dataset` | Cleaned records. Filters: `start_date`, `end_date`, `reasons` (csv), `valid_only` |
| GET | `/quality-report` | Summary + every flagged row with issues and actions |
| GET | `/reasons` | Distinct reasons (data-derived) + counts + grouping |
| GET | `/analysis/efficiency` | Efficiency score, overall and per day |
| GET | `/analysis/streaks` | Breakdown streaks. Params: `preset`, `reasons`, `min_days` |
| GET | `/analysis/shift-chart` | Per-record segments for the shift chart |
| GET | `/analysis/insights` | Actionable insights |
| POST | `/dataset/upload` | Upload a CSV (form field `file`); replaces the active dataset |

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
> as *productive* even though they are operationally downtime. We follow the
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
15 unit tests cover the cleaning rules (each issue code) and the analysis layer
(efficiency exclusion, consecutive-day streak logic, configurable targets,
overnight-axis handling, insight generation):
```bash
cd backend
python manage.py test shifts
```

## Design decisions & assumptions
- **SQLite by default, Postgres-ready.** Zero-setup local runs; production/Postgres
  is one env var away.
- **Analysis on the backend.** All cleaning and analytics run server-side (Python/
  pandas) and are exposed via REST; the frontend only renders.
- **Timestamps are UTC** (`...Z`) as provided; `DAY_DATE` is treated as the
  operational day and reconciled with the timestamps.
- **Upload replaces the active dataset**, with the bundled CSV as the default/
  fallback — so the app is useful immediately and with your own data.
