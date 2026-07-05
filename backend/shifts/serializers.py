from rest_framework import serializers

from .models import ShiftRecord


class ShiftRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftRecord
        fields = [
            "id",
            "source_row",
            "day_date",
            "start",
            "end",
            "hours",
            "reason",
            "is_valid",
            "issues",
            "raw",
        ]
