from pathlib import Path

from storage.db import DB
from storage.models import NormalizedEvent


def test_insert_and_read_event(tmp_path: Path) -> None:
    db = DB(db_path=tmp_path / "aria.db")
    db.initialize()
    count = db.insert_events(
        [
            NormalizedEvent(
                external_id="evt-1",
                source="notes",
                type="note_update",
                title="hello",
                start_ts=123,
                end_ts=124,
                metadata_json={},
            )
        ]
    )
    assert count >= 1
    events = db.get_upcoming_events()
    assert isinstance(events, list)
