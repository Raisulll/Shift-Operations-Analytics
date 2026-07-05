import io

import pandas as pd
from django.test import TestCase

from shifts import analysis, cleaning, grouping
from shifts.cleaning import clean_rows, summarize
from shifts.models import ShiftRecord

HEADER = "DAY_DATE,START,END,HOURS,REASON"


def _clean(*rows):
    """Clean a tiny inline CSV and return the list of cleaned dicts."""
    df = pd.read_csv(io.StringIO("\n".join([HEADER, *rows])), dtype=str, keep_default_na=False)
    return clean_rows(df)


def _codes(rec):
    return {i["code"] for i in rec["issues"]}


class CleaningRuleTests(TestCase):
    def test_clean_row_has_no_issues(self):
        rec = _clean("10/21/2025,2025-10-21T07:00:00Z,2025-10-21T10:30:00Z,3.5,Training")[0]
        self.assertTrue(rec["is_valid"])
        self.assertEqual(rec["issues"], [])
        self.assertEqual(rec["hours"], 3.5)

    def test_invalid_date_recovered_from_start(self):
        rec = _clean("2025-15-55,2025-10-07T15:15:00Z,2025-10-07T16:39:00Z,1.4,Cleaning")[0]
        self.assertIn(cleaning.INVALID_DATE, _codes(rec))
        self.assertEqual(str(rec["day_date"]), "2025-10-07")  # recovered
        self.assertTrue(rec["is_valid"])

    def test_invalid_start_excluded(self):
        rec = _clean("10/1/2025,invalid-time,2025-10-01T08:24:00Z,1.4,Breakdown")[0]
        self.assertIn(cleaning.INVALID_START, _codes(rec))
        self.assertFalse(rec["is_valid"])

    def test_missing_start_derived_from_end_minus_hours(self):
        rec = _clean("10/12/2025,,2025-10-12T18:28:00Z,3.3,Breakdown")[0]
        self.assertIn(cleaning.MISSING_START, _codes(rec))
        self.assertIsNotNone(rec["start"])
        self.assertTrue(rec["is_valid"])

    def test_missing_end_derived_from_start_plus_hours(self):
        rec = _clean("10/12/2025,2025-10-12T18:10:00Z,,2.7,Power Failure")[0]
        self.assertIn(cleaning.MISSING_END, _codes(rec))
        self.assertIsNotNone(rec["end"])
        self.assertTrue(rec["is_valid"])

    def test_negative_hours_recomputed(self):
        rec = _clean("10/8/2025,2025-10-08T17:45:00Z,2025-10-08T20:27:00Z,-3,Other")[0]
        self.assertIn(cleaning.NEGATIVE_HOURS, _codes(rec))
        self.assertAlmostEqual(rec["hours"], 2.7, places=2)  # from timestamps
        self.assertTrue(rec["is_valid"])

    def test_hours_mismatch_trusts_timestamps(self):
        rec = _clean("10/14/2025,2025-10-14T12:30:00Z,2025-10-14T16:30:00Z,18,Breakdown")[0]
        self.assertIn(cleaning.HOURS_MISMATCH, _codes(rec))
        self.assertEqual(rec["hours"], 4.0)  # recomputed, not 18
        self.assertTrue(rec["is_valid"])

    def test_cross_midnight_kept_valid(self):
        rec = _clean("10/4/2025,2025-10-04T07:30:00Z,2025-10-05T08:00:00Z,24.5,Quality Check")[0]
        self.assertIn(cleaning.CROSS_MIDNIGHT, _codes(rec))
        self.assertTrue(rec["is_valid"])  # overnight shift is legitimate

    def test_exact_duplicate_second_copy_excluded(self):
        row = "10/20/2025,2025-10-20T07:30:00Z,2025-10-20T09:30:00Z,2,Cleaning"
        first, second = _clean(row, row)
        self.assertTrue(first["is_valid"])
        self.assertIn(cleaning.DUPLICATE, _codes(second))
        self.assertFalse(second["is_valid"])

    def test_summary_counts(self):
        cleaned = _clean(
            "10/21/2025,2025-10-21T07:00:00Z,2025-10-21T10:30:00Z,3.5,Training",
            "10/1/2025,invalid-time,2025-10-01T08:24:00Z,1.4,Breakdown",
        )
        summary = summarize(cleaned)
        self.assertEqual(summary["total"], 2)
        self.assertEqual(summary["valid"], 1)
        self.assertEqual(summary["invalid"], 1)
        self.assertEqual(summary["issue_counts"][cleaning.INVALID_START], 1)


def _mk(day, start, end, hours, reason):
    """Build (unsaved) valid ShiftRecord objects for analysis tests."""
    from datetime import datetime, timezone

    def dt(s):
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)

    return ShiftRecord(
        source_row=0,
        day_date=datetime.fromisoformat(day).date(),
        start=dt(start),
        end=dt(end),
        hours=hours,
        reason=reason,
        is_valid=True,
    )


class AnalysisTests(TestCase):
    def test_efficiency_excludes_non_productive(self):
        recs = [
            _mk("2025-10-01", "2025-10-01T08:00:00", "2025-10-01T10:00:00", 2.0, "Training"),
            _mk("2025-10-01", "2025-10-01T10:00:00", "2025-10-01T12:00:00", 2.0, "Breakdown"),
        ]
        eff = analysis.efficiency(recs)
        self.assertEqual(eff["overall"]["total_hours"], 4.0)
        self.assertEqual(eff["overall"]["productive_hours"], 2.0)
        self.assertEqual(eff["overall"]["efficiency"], 50.0)

    def test_streak_needs_consecutive_days(self):
        # Two breakdown days with a gap -> no streak at min_days=2.
        recs = [
            _mk("2025-10-04", "2025-10-04T10:00:00", "2025-10-04T11:00:00", 1.0, "Breakdown"),
            _mk("2025-10-08", "2025-10-08T10:00:00", "2025-10-08T11:00:00", 1.0, "Breakdown"),
            _mk("2025-10-09", "2025-10-09T10:00:00", "2025-10-09T11:00:00", 1.0, "Breakdown"),
        ]
        streaks = analysis.detect_streaks(recs, ["Breakdown"], min_days=2)
        self.assertEqual(len(streaks), 1)
        self.assertEqual(streaks[0]["start"], "2025-10-08")
        self.assertEqual(streaks[0]["end"], "2025-10-09")
        self.assertEqual(streaks[0]["length_days"], 2)

    def test_streak_target_is_configurable(self):
        # Power Failure bridges two Breakdown days only under the family target.
        recs = [
            _mk("2025-10-07", "2025-10-07T10:00:00", "2025-10-07T11:00:00", 1.0, "Power Failure"),
            _mk("2025-10-08", "2025-10-08T10:00:00", "2025-10-08T11:00:00", 1.0, "Breakdown"),
        ]
        self.assertEqual(analysis.detect_streaks(recs, ["Breakdown"], 2), [])
        family = analysis.detect_streaks(recs, ["Breakdown", "Power Failure"], 2)
        self.assertEqual(len(family), 1)
        self.assertEqual(family[0]["length_days"], 2)

    def test_shift_chart_overnight_extends_axis(self):
        recs = [_mk("2025-10-04", "2025-10-04T07:30:00", "2025-10-05T08:00:00", 24.5, "Quality Check")]
        chart = analysis.shift_chart(recs)
        seg = chart["segments"][0]
        self.assertTrue(seg["crosses_midnight"])
        self.assertGreater(seg["end_min"], 24 * 60)

    def test_insights_returns_at_least_three(self):
        recs = [
            _mk("2025-10-07", "2025-10-07T10:00:00", "2025-10-07T13:00:00", 3.0, "Power Failure"),
            _mk("2025-10-08", "2025-10-08T14:00:00", "2025-10-08T18:00:00", 4.0, "Breakdown"),
            _mk("2025-10-09", "2025-10-09T14:00:00", "2025-10-09T17:00:00", 3.0, "Breakdown"),
            _mk("2025-10-10", "2025-10-10T09:00:00", "2025-10-10T12:00:00", 3.0, "Training"),
        ]
        result = analysis.insights(recs, {"total": 4, "valid": 4})
        self.assertGreaterEqual(len(result), 3)
        for ins in result:
            self.assertIn("title", ins)
            self.assertIn("detail", ins)


class GroupingTests(TestCase):
    def test_set_and_read_grouping(self):
        grouping.set_group_map(
            {"Equipment Failure": ["Breakdown", "Machine Jam", "Unknown Failure"]}
        )
        lookup = grouping.group_map()
        self.assertEqual(lookup["Breakdown"], "Equipment Failure")
        self.assertEqual(grouping.group_of("Machine Jam", lookup), "Equipment Failure")
        # Ungrouped reason maps to itself.
        self.assertEqual(grouping.group_of("Cleaning", lookup), "Cleaning")

    def test_identity_mapping_is_ignored(self):
        grouping.set_group_map({"Breakdown": ["Breakdown"]})  # self-map = no-op
        self.assertEqual(grouping.group_map(), {})

    def test_clearing_grouping(self):
        grouping.set_group_map({"X": ["Breakdown"]})
        grouping.set_group_map({})
        self.assertEqual(grouping.group_map(), {})
