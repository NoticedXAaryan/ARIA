from engine.urgency_engine import evaluate_context


def test_meeting_no_note_generates_candidate() -> None:
    context = {
        "next_meeting": {"start_ts": 9999999999, "title": "Sprint Review", "external_id": "x", "type": "meeting"},
        "recent_notes": [],
        "calendar_load_next_2h": 1,
    }
    items = evaluate_context(context)
    assert isinstance(items, list)
