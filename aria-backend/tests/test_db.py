from pathlib import Path
import time

from storage.db import DB
from storage.models import NormalizedEvent


def test_insert_and_read_event(tmp_path: Path) -> None:
    db = DB(db_path=tmp_path / "aria.db")
    db.initialize()
    now = int(time.time())
    count = db.insert_events(
        [
            NormalizedEvent(
                external_id="evt-1",
                source="notes",
                type="note_update",
                title="hello",
                start_ts=now + 60,
                end_ts=now + 120,
                metadata_json={"k": "v"},
            )
        ]
    )
    assert count == 1
    events = db.get_upcoming_events(horizon_seconds=300)
    assert len(events) == 1
    assert events[0]["external_id"] == "evt-1"
    assert events[0]["title"] == "hello"


def test_update_nudge_feedback_reports_missing_id(tmp_path: Path) -> None:
    db = DB(db_path=tmp_path / "aria.db")
    db.initialize()
    assert db.update_nudge_feedback(nudge_id=9999, outcome="accepted") is False


def test_pair_code_use_is_single_use(tmp_path: Path) -> None:
    db = DB(db_path=tmp_path / "aria.db")
    db.initialize()
    now = int(time.time())
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO pair_codes (code, created_at, expires_at, used) VALUES (?, ?, ?, 0)",
            ("123456", now, now + 300),
        )
        conn.commit()

    assert db.mark_pair_code_used("123456", now_ts=now) is True
    assert db.mark_pair_code_used("123456", now_ts=now) is False
