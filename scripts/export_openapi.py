"""Print the API's OpenAPI document (source of truth for the generated TypeScript client)."""

from __future__ import annotations

import json
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("LOG_LEVEL", "ERROR")

from server.main import create_app

json.dump(create_app().openapi(), sys.stdout, indent=2, sort_keys=True)
sys.stdout.write("\n")
