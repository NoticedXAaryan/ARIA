import time

from engine.urgency_engine import evaluate_context


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
