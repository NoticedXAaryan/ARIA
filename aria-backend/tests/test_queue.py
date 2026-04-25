import time
import pytest
from pathlib import Path
from storage.db import DB

def test_nudge_expiry(tmp_path: Path):
    db = DB(db_path=tmp_path / "aria.db")
    db.initialize()
    
    # Insert an old queued nudge (5 hours old)
    old_ts = int(time.time()) - 5 * 3600
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO nudge_log
            (generated_at, delivered_at, urgency_score, context_json, suggestion_text, surface, outcome)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (old_ts, None, 0.5, "{}", "Old nudge", "silent", "queued")
        )
        conn.commit()

    # Call the expiry logic directly
    expired_count = db.expire_queued_nudges(4 * 3600)
    assert expired_count == 1
    
    # Check outcome is updated correctly
    with db.connect() as conn:
        row = conn.execute("SELECT outcome FROM nudge_log").fetchone()
        assert row["outcome"] == "expired"
