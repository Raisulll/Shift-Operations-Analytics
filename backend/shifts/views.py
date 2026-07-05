from collections import Counter

from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from . import analysis
from .cleaning import ingest_csv
from .grouping import group_map, group_of, non_productive_reasons, resolve_streak_target, streak_presets
from .models import ShiftRecord
from .serializers import ShiftRecordSerializer


def apply_filters(qs, params):
    """Apply optional, data-derived query-param filters to a ShiftRecord queryset.

    Supported params (all optional):
      start_date=YYYY-MM-DD   end_date=YYYY-MM-DD
      reasons=A,B,C           valid_only=true|false  (default true)
    """
    valid_only = params.get("valid_only", "true").lower() != "false"
    if valid_only:
        qs = qs.filter(is_valid=True)

    start_date = params.get("start_date")
    if start_date:
        qs = qs.filter(day_date__gte=start_date)

    end_date = params.get("end_date")
    if end_date:
        qs = qs.filter(day_date__lte=end_date)

    reasons = params.get("reasons")
    if reasons:
        wanted = [r.strip() for r in reasons.split(",") if r.strip()]
        if wanted:
            qs = qs.filter(reason__in=wanted)

    return qs


@api_view(["GET"])
def dataset(request):
    """Return cleaned shift records, filterable by date range and reason."""
    qs = apply_filters(ShiftRecord.objects.all(), request.query_params)
    data = ShiftRecordSerializer(qs, many=True).data
    return Response({"count": len(data), "results": data})


@api_view(["GET"])
def quality_report(request):
    """Summarise detected inconsistencies and list every flagged row."""
    all_records = ShiftRecord.objects.all()
    issue_counts = Counter()
    flagged = []
    for rec in all_records:
        if rec.issues:
            for issue in rec.issues:
                issue_counts[issue["code"]] += 1
            flagged.append(
                {
                    "source_row": rec.source_row,
                    "is_valid": rec.is_valid,
                    "reason": rec.reason,
                    "raw": rec.raw,
                    "issues": rec.issues,
                }
            )
    total = all_records.count()
    valid = all_records.filter(is_valid=True).count()
    return Response(
        {
            "summary": {
                "total": total,
                "valid": valid,
                "invalid": total - valid,
                "issue_counts": dict(sorted(issue_counts.items())),
            },
            "rows": flagged,
        }
    )


@api_view(["GET"])
def reasons(request):
    """Distinct reasons (from valid rows) with counts, plus current grouping.

    Reasons are always derived from the data — never hardcoded — so a new
    category simply appears here. The grouping + non-productive sets are
    configurable via environment variables.
    """
    counts = (
        ShiftRecord.objects.filter(is_valid=True)
        .values("reason")
        .annotate(count=Count("id"))
        .order_by("-count", "reason")
    )
    lookup = group_map()
    non_prod = non_productive_reasons()
    reason_list = [
        {
            "reason": row["reason"],
            "count": row["count"],
            "group": group_of(row["reason"], lookup),
            "non_productive": row["reason"] in non_prod,
        }
        for row in counts
    ]
    return Response(
        {
            "reasons": reason_list,
            "groups": lookup,
            "non_productive_reasons": sorted(non_prod),
        }
    )


@api_view(["GET"])
def efficiency(request):
    """Operational Efficiency Score, overall and per day (filterable)."""
    qs = apply_filters(ShiftRecord.objects.all(), request.query_params)
    return Response(analysis.efficiency(qs))


@api_view(["GET"])
def streaks(request):
    """Breakdown streaks. Params: preset (breakdown|failure_family), reasons
    (explicit comma list, wins over preset), min_days (default 2)."""
    label, target = resolve_streak_target(
        request.query_params.get("preset"), request.query_params.get("reasons")
    )
    try:
        min_days = max(1, int(request.query_params.get("min_days", 2)))
    except (TypeError, ValueError):
        min_days = 2
    qs = apply_filters(ShiftRecord.objects.all(), request.query_params)
    result = analysis.detect_streaks(qs, target, min_days=min_days)
    return Response(
        {
            "target": label,
            "target_reasons": target,
            "min_days": min_days,
            "presets": streak_presets(),
            "count": len(result),
            "streaks": result,
        }
    )


@api_view(["GET"])
def shift_chart(request):
    """Data for the shift-analysis chart (filterable)."""
    qs = apply_filters(ShiftRecord.objects.all(), request.query_params)
    return Response(analysis.shift_chart(qs))


@api_view(["GET"])
def insights(request):
    """At least three actionable operational insights."""
    qs = apply_filters(ShiftRecord.objects.all(), request.query_params)
    all_records = ShiftRecord.objects.all()
    valid = all_records.filter(is_valid=True).count()
    quality_summary = {"total": all_records.count(), "valid": valid}
    return Response({"insights": analysis.insights(qs, quality_summary)})


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def upload(request):
    """Upload a shift CSV; it replaces the active dataset after cleaning."""
    file = request.FILES.get("file")
    if file is None:
        return Response(
            {"detail": "No file provided. Send a CSV as form field 'file'."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        summary = ingest_csv(file, replace=True)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # malformed CSV, parse errors, etc.
        return Response(
            {"detail": f"Could not process file: {exc}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response({"detail": "Dataset replaced.", "summary": summary})
