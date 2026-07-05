"""Operational analytics over cleaned shift records.

Every function operates on *valid* records only (rows that survived cleaning),
and derives its categories from the data — nothing hardcodes the reason list.
The efficiency formula and the streak target set are both policy-driven via
``grouping.py`` so they can be reconfigured without code changes.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from .grouping import group_of, non_productive_reasons, streak_presets

# Minutes-from-midnight helpers for the shift-analysis chart. The chart's Y axis
# spans one full day plus the following morning (12 AM -> next 12 PM = 36 h) so
# overnight shifts render correctly. 36 h = 2160 minutes.
CHART_AXIS_MAX_MIN = 36 * 60

_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


def _fmt_date(iso: str) -> str:
    """'2025-10-07' -> 'Oct 7' for readable insight text."""
    try:
        y, m, d = (int(x) for x in iso.split("-"))
        return f"{_MONTHS[m - 1]} {d}"
    except (ValueError, IndexError):
        return iso


def _minutes_from_daystart(dt: datetime, day: date) -> float:
    """Minutes between a timestamp and midnight (UTC) of the record's day_date.

    Normal shifts land in [0, 1440); an overnight shift's END exceeds 1440,
    which is exactly what the extended chart axis represents.
    """
    midnight = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    return (dt - midnight).total_seconds() / 60.0


# --- Operational Efficiency Score ------------------------------------------
def efficiency(records) -> dict:
    """(Productive Hours / Total Hours) x 100, overall and per day.

    Productive = hours whose reason is NOT in the non-productive set
    (default Breakdown + Unknown Failure, per the assignment).
    """
    non_prod = non_productive_reasons()

    total = 0.0
    productive = 0.0
    by_day_total: dict[date, float] = defaultdict(float)
    by_day_prod: dict[date, float] = defaultdict(float)

    for r in records:
        if r.hours is None or r.day_date is None:
            continue
        total += r.hours
        by_day_total[r.day_date] += r.hours
        if r.reason not in non_prod:
            productive += r.hours
            by_day_prod[r.day_date] += r.hours

    def score(prod, tot):
        return round((prod / tot) * 100, 2) if tot else None

    by_date = [
        {
            "date": d.isoformat(),
            "productive_hours": round(by_day_prod[d], 2),
            "total_hours": round(by_day_total[d], 2),
            "efficiency": score(by_day_prod[d], by_day_total[d]),
        }
        for d in sorted(by_day_total)
    ]

    return {
        "overall": {
            "productive_hours": round(productive, 2),
            "total_hours": round(total, 2),
            "efficiency": score(productive, total),
        },
        "by_date": by_date,
        "non_productive_reasons": sorted(non_prod),
    }


# --- Breakdown streaks ------------------------------------------------------
def detect_streaks(records, target_reasons: list[str], min_days: int = 2) -> list[dict]:
    """Maximal runs of >= ``min_days`` consecutive calendar days where each day
    has >= 1 valid record in ``target_reasons``.

    A calendar-day gap ends a streak (strict consecutive). Each streak reports
    span, length, total downtime hours (severity) and the contributing rows.
    """
    target = set(target_reasons)

    # Group qualifying records by day.
    by_day: dict[date, list] = defaultdict(list)
    for r in records:
        if r.day_date is not None and r.reason in target:
            by_day[r.day_date].append(r)

    days = sorted(by_day)
    if not days:
        return []

    # Build consecutive-day runs.
    runs: list[list[date]] = []
    current = [days[0]]
    for d in days[1:]:
        if (d - current[-1]).days == 1:
            current.append(d)
        else:
            runs.append(current)
            current = [d]
    runs.append(current)

    streaks = []
    for run in runs:
        if len(run) < min_days:
            continue
        recs = [r for d in run for r in by_day[d]]
        streaks.append(
            {
                "start": run[0].isoformat(),
                "end": run[-1].isoformat(),
                "length_days": len(run),
                "downtime_hours": round(sum(r.hours or 0 for r in recs), 2),
                "record_count": len(recs),
                "days": [d.isoformat() for d in run],
            }
        )
    # Longest / most severe first.
    streaks.sort(key=lambda s: (s["length_days"], s["downtime_hours"]), reverse=True)
    return streaks


# --- Shift-analysis chart shaping ------------------------------------------
def shift_chart(records) -> dict:
    """Per-record segments for the required shift-analysis chart.

    Each segment gives the record's date, reason, and start/end expressed as
    minutes from that date's midnight, so the frontend can draw a bar in the
    reason's colour spanning the correct time-of-day band (incl. overnight).
    """
    reasons = sorted({r.reason for r in records})
    segments = []
    for r in records:
        if r.start is None or r.end is None or r.day_date is None:
            continue
        start_min = _minutes_from_daystart(r.start, r.day_date)
        end_min = _minutes_from_daystart(r.end, r.day_date)
        segments.append(
            {
                "source_row": r.source_row,
                "date": r.day_date.isoformat(),
                "reason": r.reason,
                "group": group_of(r.reason),
                "start_min": round(start_min, 1),
                "end_min": round(end_min, 1),
                "hours": r.hours,
                "crosses_midnight": end_min > 24 * 60,
            }
        )
    segments.sort(key=lambda s: (s["date"], s["start_min"]))
    return {
        "reasons": reasons,
        "axis_min": 0,
        "axis_max": CHART_AXIS_MAX_MIN,
        "segments": segments,
    }


# --- Actionable insights ----------------------------------------------------
def _dominant_window(hours: list[int], span: int = 5) -> tuple[int, int, int] | None:
    """Find the ``span``-hour window (of the day) containing the most events."""
    if not hours:
        return None
    best = (0, 0, 0)  # (count, start_hour, end_hour)
    for start in range(0, 24):
        end = start + span
        count = sum(1 for h in hours if start <= h < end)
        if count > best[0]:
            best = (count, start, end)
    return best[1], min(best[2], 24), best[0]


def insights(records, quality_summary: dict | None = None) -> list[dict]:
    """At least three data-driven, actionable insights for a plant manager.

    Each insight is computed from the current dataset (nothing is hardcoded) and
    carries a short title, an actionable detail, and the supporting metric.
    """
    out: list[dict] = []
    recs = [r for r in records if r.hours is not None]

    # 1) Biggest downtime contributor (failure-family reasons by total hours).
    family = set(streak_presets().get("failure_family", []))
    hours_by_reason: dict[str, float] = defaultdict(float)
    count_by_reason: dict[str, int] = defaultdict(int)
    for r in recs:
        hours_by_reason[r.reason] += r.hours
        count_by_reason[r.reason] += 1
    downtime = {k: v for k, v in hours_by_reason.items() if k in family}
    if downtime:
        top = max(downtime, key=downtime.get)
        out.append(
            {
                "title": "Largest source of downtime",
                "detail": (
                    f"'{top}' accounts for {round(downtime[top], 1)} h of lost time "
                    f"across {count_by_reason[top]} events - the biggest downtime "
                    f"driver. Prioritise root-cause analysis here."
                ),
                "metric": {"reason": top, "hours": round(downtime[top], 1),
                           "events": count_by_reason[top]},
            }
        )

    # 2) Peak breakdown time-of-day window -> schedule preventive maintenance.
    bd_reasons = set(streak_presets().get("breakdown", ["Breakdown"]))
    bd_hours = [r.start.hour for r in recs if r.reason in bd_reasons and r.start]
    window = _dominant_window(bd_hours, span=5)
    if window and window[2] > 0:
        start_h, end_h, cnt = window
        out.append(
            {
                "title": "Breakdowns cluster in a daily window",
                "detail": (
                    f"{cnt} of {len(bd_hours)} breakdowns start between "
                    f"{start_h:02d}:00 and {end_h:02d}:00. Schedule preventive "
                    f"inspections just before this window to pre-empt failures."
                ),
                "metric": {"window": f"{start_h:02d}:00-{end_h:02d}:00",
                           "breakdowns_in_window": cnt, "total_breakdowns": len(bd_hours)},
            }
        )

    # 3) Longest failure streak (family view) -> concentrated intervention.
    family_streaks = detect_streaks(recs, sorted(family), min_days=2)
    if family_streaks:
        s = family_streaks[0]
        out.append(
            {
                "title": "Recurring multi-day failure streak",
                "detail": (
                    f"A {s['length_days']}-day failure streak ran {_fmt_date(s['start'])} "
                    f"to {_fmt_date(s['end'])} ({s['downtime_hours']} h across "
                    f"{s['record_count']} events). Treat this interval as a single "
                    f"incident for RCA."
                ),
                "metric": s,
            }
        )

    # 4) Lowest-efficiency day.
    eff = efficiency(recs)
    scored = [d for d in eff["by_date"] if d["efficiency"] is not None]
    if scored:
        worst = min(scored, key=lambda d: d["efficiency"])
        out.append(
            {
                "title": "Lowest-efficiency day",
                "detail": (
                    f"{_fmt_date(worst['date'])} had the lowest operational efficiency "
                    f"at {worst['efficiency']}% ({worst['productive_hours']} of "
                    f"{worst['total_hours']} h productive). Review that day's log."
                ),
                "metric": worst,
            }
        )

    # 5) Data-quality signal (only if we were handed the report summary).
    if quality_summary and quality_summary.get("total"):
        total = quality_summary["total"]
        flagged = total - quality_summary.get("valid", total)
        pct = round((flagged / total) * 100, 1)
        out.append(
            {
                "title": "Data-quality attention needed",
                "detail": (
                    f"{flagged} of {total} records ({pct}%) were excluded for "
                    f"inconsistencies (invalid/missing times, duplicates, bad "
                    f"durations). Tighten data entry at source to trust the metrics."
                ),
                "metric": {"excluded": flagged, "total": total, "percent": pct},
            }
        )

    return out

