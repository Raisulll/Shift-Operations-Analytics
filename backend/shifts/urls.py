from django.urls import path

from . import views

urlpatterns = [
    path("dataset", views.dataset, name="dataset"),
    path("dataset/upload", views.upload, name="dataset-upload"),
    path("dataset/reset", views.reset_dataset, name="dataset-reset"),
    path("dataset/export.csv", views.export_csv, name="dataset-export"),
    path("quality-report", views.quality_report, name="quality-report"),
    path("reasons", views.reasons, name="reasons"),
    path("grouping", views.grouping, name="grouping"),
    path("grouping/suggest", views.suggest_grouping, name="grouping-suggest"),
    path("analysis/efficiency", views.efficiency, name="efficiency"),
    path("analysis/streaks", views.streaks, name="streaks"),
    path("analysis/shift-chart", views.shift_chart, name="shift-chart"),
    path("analysis/insights", views.insights, name="insights"),
    path("analysis/ai-summary", views.ai_summary, name="ai-summary"),
    path("analysis/reliability", views.reliability, name="reliability"),
]
