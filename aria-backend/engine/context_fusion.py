from __future__ import annotations

import time
from typing import Any

from storage.db import DB


def build_context(db: DB) -> dict[str, Any]:
    upcoming = db.get_upcoming_events(horizon_seconds=7200)
    notes = db.get_recent_note_events(lookback_seconds=86400)
    now = int(time.time())

    next_meeting = next((row for row in upcoming if row["type"] == "meeting"), None)
    calendar_load = sum(1 for row in upcoming if row["type"] == "meeting")

    return {
        "now": now,
        "upcoming_events": [dict(r) for r in upcoming],
        "recent_notes": [dict(r) for r in notes],
        "next_meeting": dict(next_meeting) if next_meeting else None,
        "calendar_load_next_2h": calendar_load,
    }
