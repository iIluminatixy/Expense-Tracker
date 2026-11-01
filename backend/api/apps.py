"""
apps.py — AppConfig for the 'api' application.

Signals are imported here inside ready() to avoid double-import issues
that occur when models are imported at module level before the app registry
is fully populated.
"""

from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        # Import signal handlers so they are connected when Django starts up.
        import api.signals  # noqa: F401
