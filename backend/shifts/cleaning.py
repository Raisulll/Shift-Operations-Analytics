"""Data-cleaning pipeline for shift records.

The dataset is deliberately seeded with operational inconsistencies. This module
DETECTS each one, records it as a structured issue (code + human detail + the
action taken), and HANDLES it — recovering the row where we reasonably can and
excluding it from analysis otherwise. Nothing is silently dropped; every flagged
row survives into the quality report.

Design rule for the HOURS column: START/END is the source of truth. In the
sample data 47 of 51 rows have HOURS == (END - START) to within rounding, so
when they disagree we trust the timestamps and recompute HOURS.
"""

from __future__ import annotations

import math
from datetime import datetime, date

import pandas as pd

from .models import ShiftRecord

# --- Issue codes (documented in the README) --------------------------------
INVALID_DATE = "INVALID_DATE"
INVALID_START = "INVALID_START"
INVALID_END = "INVALID_END"
MISSING_START = "MISSING_START"
MISSING_END = "MISSING_END"
NEGATIVE_HOURS = "NEGATIVE_HOURS"
HOURS_MISMATCH = "HOURS_MISMATCH"
END_BEFORE_START = "END_BEFORE_START"
CROSS_MIDNIGHT = "CROSS_MIDNIGHT"
DUPLICATE = "DUPLICATE"

# Absolute tolerance (hours) before HOURS and (END-START) are deemed to disagree.
HOURS_TOLERANCE = 0.05

EXPECTED_COLUMNS = ["DAY_DATE", "START", "END", "HOURS", "REASON"]


# --- Low-level parsers ------------------------------------------------------
def _parse_date(value) -> date | None:
    """Parse the M/D/YYYY DAY_DATE column. Returns None if unparseable."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%m/%d/%Y").date()
    except ValueError:
        return None


def _parse_dt(value) -> datetime | None:
    """Parse an ISO-8601 timestamp (e.g. 2025-10-21T07:00:00Z). None if bad."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_float(value) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _delta_hours(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / 3600.0


# --- Row cleaner ------------------------------------------------------------
def _clean_row(source_row: int, raw: dict, seen: set) -> dict:
    """Clean a single row into a model-ready dict."""
    issues: list[dict] = []

    def flag(code, detail, action):
        issues.append({"code": code, "detail": detail, "action": action})

    reason = str(raw.get("REASON", "") or "").strip() or "Unknown"

    day_date = _parse_date(raw.get("DAY_DATE"))
    start = _parse_dt(raw.get("START"))
    end = _parse_dt(raw.get("END"))
    hours = _parse_float(raw.get("HOURS"))

    start_blank = str(raw.get("START", "") or "").strip() == ""
    end_blank = str(raw.get("END", "") or "").strip() == ""

    # --- Timestamps: distinguish "blank" (maybe recoverable) from "invalid".
    if start is None:
        if start_blank:
            flag(MISSING_START, "START is empty.", "attempt derive from END - HOURS")
        else:
            flag(INVALID_START, f"START '{raw.get('START')}' is not a valid timestamp.", "excluded")
    if end is None:
        if end_blank:
            flag(MISSING_END, "END is empty.", "attempt derive from START + HOURS")
        else:
            flag(INVALID_END, f"END '{raw.get('END')}' is not a valid timestamp.", "excluded")

    # --- Negative / zero hours.
    if hours is not None and hours <= 0:
        flag(NEGATIVE_HOURS, f"HOURS = {hours} is not positive.", "recompute from START/END if possible")

    # --- Derive a missing endpoint from the other + a positive HOURS.
    positive_hours = hours if (hours is not None and hours > 0) else None
    if start is None and start_blank and end is not None and positive_hours is not None:
        start = end - pd.to_timedelta(positive_hours, unit="h").to_pytimedelta()
        _set_action(issues, MISSING_START, "derived START = END - HOURS")
    if end is None and end_blank and start is not None and positive_hours is not None:
        end = start + pd.to_timedelta(positive_hours, unit="h").to_pytimedelta()
        _set_action(issues, MISSING_END, "derived END = START + HOURS")

    # --- Reconcile HOURS against the timestamps (source of truth).
    if start is not None and end is not None:
        computed = _delta_hours(start, end)
        if end < start:
            flag(END_BEFORE_START, f"END precedes START ({computed:.2f} h).", "excluded")
        else:
            if start.date() != end.date():
                flag(CROSS_MIDNIGHT, "Shift spans midnight into the next day.", "kept (valid overnight shift)")
            if hours is None or abs(computed - hours) > HOURS_TOLERANCE:
                # Only flag a *mismatch* when a value existed and disagreed;
                # a negative/blank hours case was already flagged above.
                if hours is not None and hours > 0:
                    flag(HOURS_MISMATCH,
                         f"HOURS={hours} but END-START={computed:.2f} h.",
                         "recomputed from START/END")
                hours = round(computed, 2)

    # --- Recover DAY_DATE from START if the date cell itself was bad.
    if day_date is None:
        if start is not None:
            day_date = start.date()
            flag(INVALID_DATE,
                 f"DAY_DATE '{raw.get('DAY_DATE')}' is invalid.",
                 "recovered from START date")
        else:
            flag(INVALID_DATE,
                 f"DAY_DATE '{raw.get('DAY_DATE')}' is invalid and unrecoverable.",
                 "excluded")

    # --- Exact-duplicate detection (on the raw tuple).
    key = (raw.get("DAY_DATE"), raw.get("START"), raw.get("END"),
           raw.get("HOURS"), raw.get("REASON"))
    is_duplicate = key in seen
    seen.add(key)
    if is_duplicate:
        flag(DUPLICATE, "Exact duplicate of an earlier row.", "excluded (kept first occurrence)")

    # --- Final validity gate for analysis (charts / streaks / efficiency).
    is_valid = (
        day_date is not None
        and start is not None
        and end is not None
        and end >= start
        and hours is not None
        and hours > 0
        and not is_duplicate
    )

    return {
        "source_row": source_row,
        "day_date": day_date,
        "start": start,
        "end": end,
        "hours": hours,
        "reason": reason,
        "is_valid": is_valid,
        "issues": issues,
        "raw": {k: (None if pd.isna(v) else v) for k, v in raw.items()},
    }


def _set_action(issues: list[dict], code: str, action: str) -> None:
    for issue in issues:
        if issue["code"] == code:
            issue["action"] = action
            return


# --- Public API -------------------------------------------------------------
def clean_rows(df: pd.DataFrame) -> list[dict]:
    """Clean a raw shift DataFrame into a list of model-ready dicts."""
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    seen: set = set()
    cleaned = []
    for i, (_, row) in enumerate(df.iterrows(), start=1):
        cleaned.append(_clean_row(i, row.to_dict(), seen))
    return cleaned


def summarize(cleaned: list[dict]) -> dict:
    """Aggregate a cleaning result into counts for the quality report."""
    issue_counts: dict[str, int] = {}
    for rec in cleaned:
        for issue in rec["issues"]:
            issue_counts[issue["code"]] = issue_counts.get(issue["code"], 0) + 1
    valid = sum(1 for r in cleaned if r["is_valid"])
    return {
        "total": len(cleaned),
        "valid": valid,
        "invalid": len(cleaned) - valid,
        "issue_counts": dict(sorted(issue_counts.items())),
    }


def ingest_csv(path_or_filelike, replace: bool = True) -> dict:
    """Read a shift CSV, clean it, persist to the DB, and return a summary.

    Shared by the ``load_dataset`` management command and the upload endpoint so
    both go through exactly one cleaning path.
    """
    df = pd.read_csv(path_or_filelike, dtype=str, keep_default_na=False)
    cleaned = clean_rows(df)

    if replace:
        ShiftRecord.objects.all().delete()
    ShiftRecord.objects.bulk_create([ShiftRecord(**rec) for rec in cleaned])

    return summarize(cleaned)
