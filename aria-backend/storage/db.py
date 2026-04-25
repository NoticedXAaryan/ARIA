from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable

from .models import NormalizedEvent


DEFAULT_DB_PATH = Path.home() / "AppData" / "Roaming" / "ARIA" / "aria.db"


class DB:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def initialize(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS events (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  external_id TEXT UNIQUE,
                  source TEXT NOT NULL,
                  type TEXT NOT NULL,
                  title TEXT,
                  start_ts INTEGER NOT NULL,
                  end_ts INTEGER,
                  metadata_json TEXT,
                  embedding_id TEXT,
                  created_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
                CREATE INDEX IF NOT EXISTS idx_events_start_ts ON events(start_ts);
                CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

                CREATE TABLE IF NOT EXISTS nudge_log (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  generated_at INTEGER NOT NULL,
                  delivered_at INTEGER,
                  urgency_score REAL NOT NULL,
                  context_json TEXT NOT NULL,
                  suggestion_text TEXT NOT NULL,
                  surface TEXT,
                  outcome TEXT,
                  snoozed_until INTEGER,
                  feedback_weight REAL
                );

                CREATE INDEX IF NOT EXISTS idx_nudge_log_generated_at ON nudge_log(generated_at);
                CREATE INDEX IF NOT EXISTS idx_nudge_log_outcome ON nudge_log(outcome);

                CREATE TABLE IF NOT EXISTS settings (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS habits (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  habit_type TEXT NOT NULL,
                  pattern_json TEXT NOT NULL,
                  confidence REAL NOT NULL,
                  observation_count INTEGER NOT NULL DEFAULT 0,
                  last_seen INTEGER NOT NULL,
                  is_active INTEGER NOT NULL DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS tasks (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  done INTEGER NOT NULL DEFAULT 0
                );
                """
            )
            defaults = {
                "interrupt_deep_focus": True,
                "interrupt_in_meeting": True,
                "max_nudges_per_day": 8,
                "snooze_default_minutes": 15,
                "openrouter_model": "google/gemini-2.0-flash-exp:free",
            }
            for key, value in defaults.items():
                conn.execute(
                    "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
                    (key, json.dumps(value)),
                )
            conn.commit()

    def insert_events(self, events: Iterable[NormalizedEvent]) -> int:
        rows = [
            (
                e.external_id,
                e.source,
                e.type,
                e.title,
                e.start_ts,
                e.end_ts,
                json.dumps(e.metadata_json),
                int(time.time()),
            )
            for e in events
        ]
        if not rows:
            return 0

        with self.connect() as conn:
            conn.executemany(
                """
                INSERT OR IGNORE INTO events
                (external_id, source, type, title, start_ts, end_ts, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            conn.commit()
            return conn.total_changes

    def get_upcoming_events(self, horizon_seconds: int = 7200) -> list[sqlite3.Row]:
        now_ts = int(time.time())
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT * FROM events
                    WHERE start_ts BETWEEN ? AND ?
                    ORDER BY start_ts ASC
                    """,
                    (now_ts, now_ts + horizon_seconds),
                )
            )

    def get_recent_note_events(self, lookback_seconds: int = 86400) -> list[sqlite3.Row]:
        now_ts = int(time.time())
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT * FROM events
                    WHERE source = 'notes' AND start_ts >= ?
                    ORDER BY start_ts DESC
                    """,
                    (now_ts - lookback_seconds,),
                )
            )

    def get_recent_emails(self, lookback_seconds: int = 86400) -> list[sqlite3.Row]:
        now_ts = int(time.time())
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT * FROM events
                    WHERE source = 'gmail' AND start_ts >= ?
                    ORDER BY start_ts DESC
                    """,
                    (now_ts - lookback_seconds,),
                )
            )

    def log_nudge(
        self,
        urgency_score: float,
        context_json: str,
        suggestion_text: str,
        surface: str = "popup",
        outcome: str | None = None,
    ) -> int:
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO nudge_log
                (generated_at, delivered_at, urgency_score, context_json, suggestion_text, surface, outcome)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(time.time()),
                    int(time.time()),
                    urgency_score,
                    context_json,
                    suggestion_text,
                    surface,
                    outcome,
                ),
            )
            conn.commit()
            return int(cur.lastrowid)

    def get_active_nudges(self) -> list[sqlite3.Row]:
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT id, suggestion_text, urgency_score, surface, snoozed_until
                    FROM nudge_log
                    WHERE outcome IS NULL OR outcome = 'snoozed'
                    ORDER BY generated_at DESC
                    """
                )
            )

    def get_nudge_history(self, page: int = 1, page_size: int = 20) -> list[sqlite3.Row]:
        offset = max(0, (page - 1) * page_size)
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT * FROM nudge_log
                    ORDER BY generated_at DESC
                    LIMIT ? OFFSET ?
                    """,
                    (page_size, offset),
                )
            )

    def update_nudge_feedback(self, nudge_id: int, outcome: str) -> None:
        with self.connect() as conn:
            conn.execute(
                "UPDATE nudge_log SET outcome = ? WHERE id = ?",
                (outcome, nudge_id),
            )
            conn.commit()

    def get_settings(self) -> dict[str, object]:
        with self.connect() as conn:
            rows = list(conn.execute("SELECT key, value FROM settings"))
        return {row["key"]: json.loads(row["value"]) for row in rows}

    def update_settings(self, updates: dict[str, object]) -> None:
        with self.connect() as conn:
            for key, value in updates.items():
                conn.execute(
                    "INSERT INTO settings(key, value) VALUES(?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (key, json.dumps(value)),
                )
            conn.commit()

    def add_task(self, title: str) -> int:
        with self.connect() as conn:
            cur = conn.execute(
                "INSERT INTO tasks(title, created_at, done) VALUES (?, ?, 0)",
                (title, int(time.time())),
            )
            conn.commit()
            return int(cur.lastrowid)

    def get_habits(self) -> list[sqlite3.Row]:
        with self.connect() as conn:
            return list(
                conn.execute(
                    "SELECT habit_type, pattern_json, confidence FROM habits WHERE is_active=1 ORDER BY confidence DESC"
                )
            )

    def upsert_habit(self, habit_type: str, pattern_json: dict, confidence: float) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO habits(habit_type, pattern_json, confidence, observation_count, last_seen, is_active)
                VALUES (?, ?, ?, 1, ?, 1)
                """,
                (habit_type, json.dumps(pattern_json), confidence, int(time.time())),
            )
            conn.commit()
