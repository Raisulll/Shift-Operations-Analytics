from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from shifts.cleaning import ingest_csv


class Command(BaseCommand):
    help = "Load and clean a shift CSV into the database (defaults to the bundled dataset)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default=settings.DEFAULT_DATASET_PATH,
            help="Path to the CSV to load. Defaults to settings.DEFAULT_DATASET_PATH.",
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing records before loading (default behaviour).",
        )
        parser.add_argument(
            "--if-empty",
            action="store_true",
            help="Only load when the database has no records yet. Used on deploy "
            "so a boot never overwrites data (e.g. an uploaded dataset) that "
            "already persists in Postgres.",
        )

    def handle(self, *args, **options):
        path = options["path"]

        if options["if_empty"]:
            from shifts.models import ShiftRecord

            if ShiftRecord.objects.exists():
                self.stdout.write("Records already present; skipping seed (--if-empty).")
                return

        try:
            summary = ingest_csv(path, replace=True)
        except FileNotFoundError:
            raise CommandError(f"Dataset not found: {path}")
        except ValueError as exc:
            raise CommandError(str(exc))

        # Mark the active source. The bundled dataset reads as "Sample dataset";
        # any other CLI-loaded file uses its filename.
        from pathlib import Path

        from shifts.models import DatasetMeta

        is_default = str(path) == str(settings.DEFAULT_DATASET_PATH)
        DatasetMeta.set_active(
            "Sample dataset" if is_default else Path(path).name, is_custom=False
        )

        self.stdout.write(self.style.SUCCESS(f"Loaded {path}"))
        self.stdout.write(
            f"  total={summary['total']}  valid={summary['valid']}  invalid={summary['invalid']}"
        )
        self.stdout.write("  issues detected:")
        if not summary["issue_counts"]:
            self.stdout.write("    (none)")
        for code, count in summary["issue_counts"].items():
            self.stdout.write(f"    {code:<18} {count}")
