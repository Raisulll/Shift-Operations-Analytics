"""Dynamic reason categorisation.

Nothing in the codebase hardcodes the list of reasons — they are always derived
from the data at runtime. This module only holds the *policy* for two things that
legitimately need naming:

1. Which reasons count as non-productive for the Operational Efficiency Score.
2. Optional grouping of raw reasons into higher-level buckets, so the solution
   "remains useful when new activity categories appear or categories are grouped
   together" (assignment requirement).

Both are configurable via environment variables, so no code change is needed to
regroup categories or to treat a newly-appeared reason as non-productive.
"""

from __future__ import annotations

import json

from decouple import config

# --- Efficiency policy -----------------------------------------------------
# Productive Hours = hours whose reason is NOT in this set (assignment formula:
# "not Breakdown or Unknown Failure"). Override with a comma-separated env var.
_DEFAULT_NON_PRODUCTIVE = ["Breakdown", "Unknown Failure"]


def non_productive_reasons() -> set[str]:
    raw = config("NON_PRODUCTIVE_REASONS", default="")
    if raw.strip():
        return {r.strip() for r in raw.split(",") if r.strip()}
    return set(_DEFAULT_NON_PRODUCTIVE)


# --- Optional grouping ------------------------------------------------------
# Map of {group_label: [reason, reason, ...]}. Default is identity (no grouping).
# Resolution order for the active grouping:
#   1. User-defined groups saved in the DB (ReasonGroup) via the UI.
#   2. The REASON_GROUPS env var (JSON), e.g.:
#        REASON_GROUPS='{"Equipment Failure": ["Breakdown", "Machine Jam"]}'
#   3. Identity (each reason is its own group).
def _env_group_map() -> dict[str, str]:
    raw = config("REASON_GROUPS", default="").strip()
    if not raw:
        return {}
    groups: dict[str, list[str]] = json.loads(raw)
    lookup: dict[str, str] = {}
    for label, members in groups.items():
        for member in members:
            lookup[member] = label
    return lookup


def group_map() -> dict[str, str]:
    """Return a flat {reason: group_label} lookup for the active grouping."""
    # Import here to avoid a circular import at module load time.
    from .models import ReasonGroup

    db_rows = list(ReasonGroup.objects.all().values_list("reason", "group_label"))
    if db_rows:
        return {reason: label for reason, label in db_rows}
    return _env_group_map()


def set_group_map(groups: dict[str, list[str]]) -> dict[str, str]:
    """Replace the saved grouping with ``{label: [reasons]}`` and return the
    resulting flat {reason: label} lookup. Empty input clears all grouping."""
    from .models import ReasonGroup

    ReasonGroup.objects.all().delete()
    rows = []
    for label, members in (groups or {}).items():
        label = str(label).strip()
        if not label:
            continue
        for member in members:
            member = str(member).strip()
            if member and member != label:  # identity mapping is a no-op
                rows.append(ReasonGroup(reason=member, group_label=label))
    ReasonGroup.objects.bulk_create(rows, ignore_conflicts=True)
    return group_map()


def group_of(reason: str, lookup: dict[str, str] | None = None) -> str:
    """Return the group label for a reason, or the reason itself if ungrouped."""
    if lookup is None:
        lookup = group_map()
    return lookup.get(reason, reason)


# --- Streak target presets --------------------------------------------------
# The streak engine looks for consecutive-day runs of a "target" set of reasons.
# Two named presets ship by default; both are overridable via env, and callers
# may also pass an explicit list of reasons instead of a preset name.
_DEFAULT_STREAK_PRESETS = {
    # Faithful to the assignment wording ("recurring breakdown periods").
    "breakdown": ["Breakdown"],
    # Broader unplanned-downtime view — reveals patterns the raw label hides.
    "failure_family": ["Breakdown", "Power Failure", "Machine Jam", "Unknown Failure"],
}


def streak_presets() -> dict[str, list[str]]:
    """Named streak targets. Override with STREAK_PRESETS (JSON) if desired."""
    raw = config("STREAK_PRESETS", default="").strip()
    if raw:
        return json.loads(raw)
    return {k: list(v) for k, v in _DEFAULT_STREAK_PRESETS.items()}


def resolve_streak_target(preset: str | None, reasons: str | None) -> tuple[str, list[str]]:
    """Resolve the target reason set from a preset name and/or explicit list.

    Explicit ``reasons`` (comma-separated) wins; otherwise the named ``preset``;
    otherwise the 'breakdown' default. Returns (label, reason_list).
    """
    if reasons:
        wanted = [r.strip() for r in reasons.split(",") if r.strip()]
        if wanted:
            return ("custom", wanted)
    presets = streak_presets()
    name = (preset or "breakdown").strip()
    if name in presets:
        return (name, list(presets[name]))
    # Unknown preset name -> fall back to the default target.
    return ("breakdown", list(presets.get("breakdown", ["Breakdown"])))
