from django.db import models


class ShiftRecord(models.Model):
    """A single shift record after cleaning.

    Both the original row (``raw``) and the cleaned/derived values are stored so
    the data-quality report can show "what we received" vs. "what we did about
    it". Rows that fail cleaning are still persisted (``is_valid=False``) so they
    appear in the report, but they are excluded from charts, streaks and the
    efficiency score.
    """

    # Reference back to the source CSV (1-based data-row index).
    source_row = models.IntegerField()

    # Cleaned values (any may be null when unrecoverable).
    day_date = models.DateField(null=True, blank=True)
    start = models.DateTimeField(null=True, blank=True)
    end = models.DateTimeField(null=True, blank=True)
    hours = models.FloatField(null=True, blank=True)
    reason = models.CharField(max_length=120, default="Unknown")

    # Cleaning outcome.
    is_valid = models.BooleanField(default=True, db_index=True)
    issues = models.JSONField(default=list)  # [{code, detail, action}, ...]
    raw = models.JSONField(default=dict)      # original row, verbatim

    class Meta:
        ordering = ["day_date", "start"]

    def __str__(self):
        state = "ok" if self.is_valid else "flagged"
        return f"[{self.source_row}] {self.day_date} {self.reason} ({state})"


class DatasetMeta(models.Model):
    """Remembers which dataset is currently loaded (singleton, id=1), so the UI
    shows the right source label even after a browser refresh."""

    source_name = models.CharField(max_length=255, default="Sample dataset")
    is_custom = models.BooleanField(default=False)

    @classmethod
    def set_active(cls, source_name, is_custom):
        obj, _ = cls.objects.update_or_create(
            id=1, defaults={"source_name": source_name, "is_custom": is_custom}
        )
        return obj

    @classmethod
    def active(cls):
        return cls.objects.filter(id=1).first()

    def __str__(self):
        return f"{self.source_name} ({'custom' if self.is_custom else 'default'})"


class ReasonGroup(models.Model):
    """User-defined grouping of raw reasons into higher-level buckets.

    Persisted so the grouping set in the UI survives reloads and applies across
    charts, streaks and efficiency. Each raw reason maps to at most one group.
    Empty table = no grouping (each reason is its own group).
    """

    reason = models.CharField(max_length=120, unique=True)
    group_label = models.CharField(max_length=120)

    class Meta:
        ordering = ["group_label", "reason"]

    def __str__(self):
        return f"{self.reason} -> {self.group_label}"
