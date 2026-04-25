from __future__ import annotations

import time
from typing import Any

from engine.behavior_model import BehaviorModel
from storage.db import DB


def build_context(db: DB, behavior_model: BehaviorModel | None = None) -> dict[str, Any]:
    """Build a unified context object by fusing calendar, notes, and behavior model signals.

    This is the L4 Context Fusion Core from the ARIA pipeline.
    Combines: current time + calendar lookahead + recent notes + behavior prediction + cognitive state.
    """
    upcoming = db.get_upcoming_events(horizon_seconds=7200)
    notes = db.get_recent_note_events(lookback_seconds=86400)
    now = int(time.time())

    upcoming_dicts = [dict(r) for r in upcoming]
    notes_dicts = [dict(r) for r in notes]

    next_meeting = next((row for row in upcoming_dicts if row.get("type") == "meeting"), None)
    calendar_load = sum(1 for row in upcoming_dicts if row.get("type") == "meeting")

    # Behavior model predictions
    cognitive_state = "normal"
    predicted_activity = {"predicted_next_activity": "focus", "confidence": 0.25}
    if behavior_model:
        behavior_model.train(upcoming_dicts)
        cognitive_state = behavior_model.classify_cognitive_state(upcoming_dicts)
        predicted_activity = behavior_model.predict(now)

    return {
        "now": now,
        "upcoming_events": upcoming_dicts,
        "recent_notes": notes_dicts,
        "next_meeting": next_meeting,
        "calendar_load_next_2h": calendar_load,
        "cognitive_state": cognitive_state,
        "predicted_activity": predicted_activity,
    }
