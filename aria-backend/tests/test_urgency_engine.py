import time

from engine.urgency_engine import evaluate_context
from storage.db import DB


def test_meeting_no_note_generates_candidate() -> None:
    """Meeting within 30 min and no prep note should generate a nudge candidate."""
    now = int(time.time())
    starts_in_20_min = now + (20 * 60)  # 20 minutes from now
    context = {
        "next_meeting": {
            "start_ts": starts_in_20_min,
            "title": "Sprint Review",
            "external_id": "gcal:test-1",
            "type": "meeting",
        },
        "recent_notes": [],
        "calendar_load_next_2h": 1,
    }
    items = evaluate_context(context)
    assert len(items) == 1
    assert items[0].reason == "meeting_soon_no_prep"
    assert 0.0 < items[0].urgency_score <= 1.0
    assert "Sprint Review" not in items[0].suggestion_text or "prep" in items[0].suggestion_text.lower()


def test_meeting_with_prep_note_no_nudge() -> None:
    """Meeting within 30 min but prep note exists should NOT generate a nudge."""
    now = int(time.time())
    starts_in_20_min = now + (20 * 60)
    context = {
        "next_meeting": {
            "start_ts": starts_in_20_min,
            "title": "Sprint Review",
            "external_id": "gcal:test-2",
            "type": "meeting",
        },
        "recent_notes": [
            {"title": "sprint review prep", "source": "notes"},
        ],
        "calendar_load_next_2h": 1,
    }
    items = evaluate_context(context)
    assert len(items) == 0


def test_no_meeting_no_nudge() -> None:
    """No upcoming meeting should generate no nudge."""
    context = {
        "next_meeting": None,
        "recent_notes": [],
        "calendar_load_next_2h": 0,
    }
    items = evaluate_context(context)
    assert len(items) == 0


def test_high_load_affects_urgency() -> None:
    """High calendar load should increase impact weight in urgency calculation."""
    now = int(time.time())
    starts_in_15_min = now + (15 * 60)
    base_context = {
        "next_meeting": {
            "start_ts": starts_in_15_min,
            "title": "Team Sync",
            "external_id": "gcal:test-3",
            "type": "meeting",
        },
        "recent_notes": [],
    }
    # Normal load
    normal = evaluate_context({**base_context, "calendar_load_next_2h": 1})
    # High load (3+ meetings)
    high = evaluate_context({**base_context, "calendar_load_next_2h": 4})

    assert len(normal) == 1
    assert len(high) == 1
    # Both should produce valid urgency scores
    assert 0.0 < normal[0].urgency_score <= 1.0
    assert 0.0 < high[0].urgency_score <= 1.0


def test_evaluate_context_with_db_and_persist_stores_reason(tmp_path) -> None:
    """DB-backed evaluate + persist should not fail and should store candidate reason."""
    from engine.urgency_engine import persist_candidates

    db = DB(db_path=tmp_path / "aria.db")
    db.initialize()

    now = int(time.time())
    context = {
        "next_meeting": {
            "start_ts": now + (20 * 60),
            "title": "Sprint Review",
            "external_id": "gcal:test-db-1",
            "type": "meeting",
        },
        "recent_notes": [],
        "calendar_load_next_2h": 1,
    }

    items = evaluate_context(context, db=db)
    assert len(items) == 1

    nudge_ids = persist_candidates(db, items, surface="popup")
    assert len(nudge_ids) == 1

    with db.connect() as conn:
        row = conn.execute(
            "SELECT reason FROM nudge_log WHERE id = ?",
            (nudge_ids[0],),
        ).fetchone()
    assert row is not None
    assert row["reason"] == "meeting_soon_no_prep"
